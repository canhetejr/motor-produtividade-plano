'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireGestor, requireAdmin, isAdmin } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { registrarAuditoria } from '@/lib/auditoria'
import { verificarSenhaVazada, mensagemDeRecusa } from '@/lib/senha-vazada'
import { lerPlanilha, faltandoColunas, type LinhaImportResultado } from '@/lib/import-planilha'
import { resolverSenhaInicial } from '@/lib/senha-inicial-padrao'
import { mensagemDeErroDaPropriedade } from '@/lib/organizacao-dono'
import type { ActionResult } from '@/lib/action-result'

const perfilSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome'),
  area_id: z.string().uuid('Selecione uma área'),
  carga_horaria_min: z.coerce
    .number()
    .int('Carga horária deve ser em minutos inteiros')
    .positive('Carga horária deve ser maior que zero'),
  role: z.enum(['colaborador', 'gestor'], { message: 'Perfil inválido' }),
})

const passwordSchema = z.string().min(6, 'Senha temporária deve ter ao menos 6 caracteres')

// Separação de privilégio (bloco 33): promover alguém a gestor é conceder o
// poder de editar todo o catálogo e toda a equipe. Passou a ser exclusivo do
// admin — antes qualquer gestor criava outro gestor, e não havia teto nenhum.
const APENAS_ADMIN_PAPEL =
  'Só um admin pode conceder ou remover o papel de gestor. Fale com o administrador do sistema.'
const APENAS_ADMIN_ALVO =
  'Este colaborador é admin do sistema — só outro admin pode alterá-lo.'

const novoColaboradorSchema = perfilSchema.extend({
  email: z.string().trim().email('Informe um e-mail válido'),
  password: passwordSchema.optional(),
})

export async function updateColaborador(id: string, formData: FormData): Promise<ActionResult> {
  const { user, profile } = await requireGestor()
  const supabase = await createClient()

  const parsed = perfilSchema
    .extend({ ativo: z.boolean() })
    .safeParse({
      nome: formData.get('nome'),
      area_id: formData.get('area_id'),
      carga_horaria_min: formData.get('carga_horaria_min'),
      role: formData.get('role'),
      ativo: formData.get('ativo') === 'on',
    })

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  // Estado anterior pra auditoria (carga horária/área/ativo são os campos
  // que docs/MELHORIAS-FUTURAS.md pedia pra rastrear "quem mudou e quando").
  const { data: antes } = await supabase
    .from('colaboradores')
    .select('nome, area_id, carga_horaria_min, role, ativo, admin')
    .eq('id', id)
    .single()

  // O trigger trg_colaboradores_proteger_admin recusaria estes dois casos de
  // qualquer forma — a checagem aqui existe só para dar uma mensagem que
  // explica o motivo, em vez do texto cru da exceção do Postgres.
  if (antes && !(await isAdmin())) {
    if (antes.admin) {
      return { ok: false, error: APENAS_ADMIN_ALVO }
    }
    if (parsed.data.role !== antes.role) {
      return { ok: false, error: APENAS_ADMIN_PAPEL }
    }
  }

  const { error } = await supabase.from('colaboradores').update(parsed.data).eq('id', id)
  if (error) {
    console.error('Erro ao atualizar colaborador:', error)
    // trg_colaboradores_proteger_dono (20260812200000) recusa desativar quem é
    // dono da empresa. Sem a tradução, quem tenta recebe "Falha ao atualizar"
    // e não descobre que o caminho é transferir a propriedade antes.
    return {
      ok: false,
      error: mensagemDeErroDaPropriedade(error.message) ?? 'Falha ao atualizar o colaborador.',
    }
  }

  await registrarAuditoria({
    atorId: user.id,
    acao: 'colaborador.atualizar',
    entidade: 'colaboradores',
    entidadeId: id,
    antes,
    depois: parsed.data,
  }, profile.organizacao_id)

  revalidatePath('/catalogo')
  revalidatePath('/gestao/catalogo')
  revalidatePath('/minhas-demandas')
  return { ok: true }
}

type DadosNovaConta = {
  nome: string
  email: string
  password?: string
  area_id: string
  carga_horaria_min: number
  role: 'colaborador' | 'gestor'
}

// admin.auth.admin.createUser + INSERT em colaboradores rodam com service
// role, que bypassa RLS — o organizacao_id não vem de nenhum default seguro
// aqui, tem que ser passado explicitamente a partir de quem chamou a action
// (profile.organizacao_id do gestor/admin autenticado).

// Núcleo de "criar uma conta de colaborador" (Auth + linha em colaboradores,
// com rollback da conta órfã se o insert falhar) — usado tanto pelo
// cadastro manual (createColaborador) quanto pelo import em massa
// (importarColaboradoresCSV), pra não duplicar a lógica de rollback.
async function criarContaColaborador(
  admin: ReturnType<typeof createAdminClient>,
  dados: DadosNovaConta,
  organizacaoId: string
): Promise<ActionResult> {
  const { data: senhaPadrao, error: senhaPadraoError } = dados.password
    ? { data: null, error: null }
    : await admin.rpc('obter_senha_inicial_padrao', { p_organizacao_id: organizacaoId })
  if (senhaPadraoError) return { ok: false, error: 'Não foi possível obter a senha padrão configurada.' }
  const senhaResolvida = resolverSenhaInicial(dados.password, senhaPadrao)
  if ('erro' in senhaResolvida) return { ok: false, error: senhaResolvida.erro ?? 'Senha inicial inválida.' }

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: dados.email,
    password: senhaResolvida.senha,
    email_confirm: true,
  })

  if (authError || !created.user) {
    console.error('Erro ao criar usuário:', authError)
    // O texto do provedor é em inglês e vaza detalhe interno. E-mail repetido
    // é o erro mais provável aqui — sobretudo no import em massa, em que a
    // planilha costuma trazer gente que já tem conta.
    if (authError?.message?.includes('already been registered')) {
      return { ok: false, error: 'Já existe uma conta com esse e-mail.' }
    }
    return { ok: false, error: 'Falha ao criar a conta de acesso.' }
  }

  const { error: dbError } = await admin.from('colaboradores').insert({
    id: created.user.id,
    nome: dados.nome,
    area_id: dados.area_id,
    carga_horaria_min: dados.carga_horaria_min,
    role: dados.role,
    ativo: true,
    // Conta criada pelo gestor começa com senha temporária e só ganha acesso
    // normal depois de a própria pessoa defini-la no primeiro login.
    troca_senha_obrigatoria: true,
    organizacao_id: organizacaoId,
  })

  if (dbError) {
    console.error('Erro ao salvar perfil:', dbError)
    // desfaz a conta órfã para permitir nova tentativa com o mesmo e-mail
    await admin.auth.admin.deleteUser(created.user.id)
    return { ok: false, error: 'Falha ao salvar o perfil do colaborador. Tente novamente.' }
  }

  return { ok: true }
}

export async function createColaborador(formData: FormData): Promise<ActionResult> {
  const { user, profile } = await requireGestor()

  const parsed = novoColaboradorSchema.safeParse({
    nome: formData.get('nome'),
    email: formData.get('email'),
    password: formData.get('password'),
    area_id: formData.get('area_id'),
    carga_horaria_min: formData.get('carga_horaria_min'),
    role: formData.get('role'),
  })

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  if (parsed.data.role === 'gestor' && !(await isAdmin())) {
    return { ok: false, error: APENAS_ADMIN_PAPEL }
  }

  if (parsed.data.password) {
    const recusaSenha = mensagemDeRecusa(await verificarSenhaVazada(parsed.data.password))
    if (recusaSenha) return { ok: false, error: recusaSenha }
  }

  let admin
  try {
    admin = createAdminClient()
  } catch {
    return {
      ok: false,
      error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor — necessária para criar contas.',
    }
  }

  const result = await criarContaColaborador(admin, parsed.data, profile.organizacao_id)
  if (!result.ok) return result

  await registrarAuditoria({
    atorId: user.id,
    acao: 'colaborador.criar',
    entidade: 'colaboradores',
    // Nunca logar a senha temporária no rastro de auditoria.
    depois: {
      nome: parsed.data.nome,
      email: parsed.data.email,
      area_id: parsed.data.area_id,
      carga_horaria_min: parsed.data.carga_horaria_min,
      role: parsed.data.role,
    },
  }, profile.organizacao_id)

  revalidatePath('/catalogo')
  revalidatePath('/gestao/catalogo')
  revalidatePath('/minhas-demandas')
  return { ok: true }
}

// Import em massa: linhas esperadas com cabeçalho "nome,email,senha,area,
// carga_horaria_min,role" (CSV ou XLSX, ver lib/import-planilha.ts). Sem
// transação única de propósito — cada linha cria uma conta Auth própria,
// então travar tudo por causa de uma linha inválida forçaria refazer contas
// já criadas com sucesso. O relatório por linha aponta o que corrigir.
export async function importarColaboradoresCSV(
  formData: FormData
): Promise<ActionResult<{ relatorio: LinhaImportResultado[] }>> {
  const { user, profile } = await requireGestor()

  const file = formData.get('arquivo')
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Selecione um arquivo CSV ou XLSX.' }
  }

  let planilha
  try {
    planilha = await lerPlanilha(file)
  } catch (err) {
    console.error('Erro ao ler planilha de colaboradores:', err)
    return { ok: false, error: 'Não foi possível ler o arquivo. Confira se é um CSV ou XLSX válido.' }
  }
  const { linhas } = planilha
  if (linhas.length === 0) {
    return {
      ok: false,
      error: 'Nenhuma linha encontrada (confira o cabeçalho: nome, email, senha, area, carga_horaria_min, role).',
    }
  }
  // Sem 'senha' na lista: ela é opcional (cai na senha inicial padrão da
  // organização), e exigi-la no cabeçalho recusaria uma planilha válida.
  const semColunas = faltandoColunas(planilha, ['nome', 'email', 'area'])
  if (semColunas) return { ok: false, error: semColunas }

  let admin
  try {
    admin = createAdminClient()
  } catch {
    return {
      ok: false,
      error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor — necessária para criar contas.',
    }
  }

  // Service role bypassa RLS: filtro de organização explícito, senão a
  // busca por nome de área vazaria de outros clientes.
  const { data: areas } = await admin
    .from('areas')
    .select('id, nome')
    .eq('organizacao_id', profile.organizacao_id)
  const areaPorNome = new Map((areas ?? []).map((a) => [a.nome.trim().toLowerCase(), a.id]))

  // O import cria contas com service role, que ignora RLS e não passa pelo
  // trigger (que é BEFORE UPDATE, e aqui é INSERT). Sem esta checagem a
  // planilha seria o caminho mais fácil para um gestor fabricar outro gestor.
  const podePromover = await isAdmin()

  const relatorio: LinhaImportResultado[] = []

  for (let i = 0; i < linhas.length; i++) {
    const linhaNum = i + 2 // +1 pelo cabeçalho, +1 porque planilha é base 1
    const raw = linhas[i]
    const nome = raw.nome ?? ''

    const areaId = areaPorNome.get((raw.area ?? '').trim().toLowerCase())
    if (!areaId) {
      relatorio.push({ linha: linhaNum, nome, status: 'erro', motivo: `Área "${raw.area ?? ''}" não encontrada.` })
      continue
    }

    const roleRaw = (raw.role ?? '').trim().toLowerCase()
    if (roleRaw === 'gestor' && !podePromover) {
      relatorio.push({ linha: linhaNum, nome, status: 'erro', motivo: APENAS_ADMIN_PAPEL })
      continue
    }

    const parsed = novoColaboradorSchema.safeParse({
      nome,
      email: raw.email,
      password: raw.senha || raw.password,
      area_id: areaId,
      carga_horaria_min: raw.carga_horaria_min || 480,
      role: roleRaw === 'gestor' ? 'gestor' : 'colaborador',
    })
    if (!parsed.success) {
      relatorio.push({ linha: linhaNum, nome, status: 'erro', motivo: parsed.error.issues[0].message })
      continue
    }

    const result = await criarContaColaborador(admin, parsed.data, profile.organizacao_id)
    relatorio.push(
      result.ok
        ? { linha: linhaNum, nome, status: 'ok' }
        : { linha: linhaNum, nome, status: 'erro', motivo: result.error }
    )
  }

  const totalCriados = relatorio.filter((r) => r.status === 'ok').length
  if (totalCriados > 0) {
    await registrarAuditoria({
      atorId: user.id,
      acao: 'colaborador.importar_csv',
      entidade: 'colaboradores',
      depois: { total_processados: linhas.length, total_criados: totalCriados },
    }, profile.organizacao_id)
  }

  revalidatePath('/catalogo')
  revalidatePath('/gestao/catalogo')
  revalidatePath('/minhas-demandas')
  return { ok: true, data: { relatorio } }
}

// Sem cadastro público e sem e-mail de recuperação de senha — se alguém
// esquecer a senha, o admin redefine por aqui.
//
// Admin-only desde o bloco 33: redefinir senha é tomada de conta, não gestão
// de equipe. Enquanto era um poder de gestor, qualquer gestor podia assumir a
// conta do admin e herdar tudo — a separação de privilégio não valeria nada.
export async function resetColaboradorPassword(id: string, formData: FormData): Promise<ActionResult> {
  const { user, profile } = await requireAdmin()

  const parsed = passwordSchema.safeParse(formData.get('password'))
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  // Vale também para senha temporária definida pelo gestor: é justamente a que
  // costuma ser fraca e reutilizada.
  const recusa = mensagemDeRecusa(await verificarSenhaVazada(parsed.data))
  if (recusa) return { ok: false, error: recusa }

  let admin
  try {
    admin = createAdminClient()
  } catch {
    return {
      ok: false,
      error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor — necessária para redefinir senha.',
    }
  }

  const { error } = await admin.auth.admin.updateUserById(id, { password: parsed.data })
  if (error) {
    console.error('Erro ao redefinir senha:', error)
    return { ok: false, error: error.message || 'Falha ao redefinir a senha.' }
  }

  // Mantém a regra de primeiro acesso no mesmo escopo organizacional do admin
  // que executou o reset; service role exige este filtro manual.
  const { error: flagError } = await admin
    .from('colaboradores')
    .update({ troca_senha_obrigatoria: true })
    .eq('id', id)
    .eq('organizacao_id', profile.organizacao_id)
  if (flagError) {
    console.error('Erro ao marcar troca obrigatória de senha:', flagError)
    return { ok: false, error: 'Senha redefinida, mas não foi possível exigir a troca no próximo acesso.' }
  }

  await registrarAuditoria({
    atorId: user.id,
    acao: 'colaborador.reset_senha',
    entidade: 'colaboradores',
    entidadeId: id,
  }, profile.organizacao_id)

  return { ok: true }
}


// Exclusão definitiva. Até aqui a única saída era `ativo = false`, e o pedido
// é justamente não acumular uma lista de inativos que nunca mais volta.
//
// Dois passos que não cabem na mesma transação: a RPC apaga o registro de
// negócio (arquivando os apontamentos em apontamentos_arquivados antes), e só
// depois a conta do Auth é removida — auth.users vive fora do alcance do SQL
// da aplicação. Se o segundo passo falhar, sobra um auth.users sem
// colaborador: sem perfil, requireUser() já derruba o login, então o pior
// caso é uma conta órfã e inerte, não um acesso vivo.
const ERROS_EXCLUSAO_COLABORADOR: Record<string, string> = {
  NAO_AUTORIZADO: 'Só um admin pode excluir colaboradores.',
  COLABORADOR_NAO_ENCONTRADO: 'Colaborador não encontrado.',
  NAO_PODE_EXCLUIR_A_SI: 'Você não pode excluir a própria conta.',
  NAO_PODE_EXCLUIR_DONO:
    'Este colaborador é o dono da empresa. Transfira a propriedade em Gestão › Acessos antes de excluir.',
  ULTIMO_ADMIN: 'Este é o último admin da empresa. Promova outra pessoa a admin antes de excluir.',
}

export async function excluirColaborador(id: string): Promise<ActionResult<{ arquivados: number }>> {
  const { user, profile } = await requireAdmin()
  const supabase = await createClient()

  const { data: antes } = await supabase
    .from('colaboradores')
    .select('nome, role, admin, area_id, carga_horaria_min, ativo')
    .eq('id', id)
    .single()

  const { data: arquivados, error } = await supabase.rpc('excluir_colaborador_definitivo', {
    p_colaborador_id: id,
  })
  if (error) {
    console.error('Erro ao excluir colaborador:', error)
    return {
      ok: false,
      error: ERROS_EXCLUSAO_COLABORADOR[error.message] ?? 'Falha ao excluir o colaborador.',
    }
  }

  let avisoAuth: string | null = null
  try {
    const admin = createAdminClient()
    const { error: authError } = await admin.auth.admin.deleteUser(id)
    if (authError) {
      console.error('Erro ao remover conta de acesso do colaborador excluído:', authError)
      avisoAuth = 'O cadastro foi excluído, mas a conta de acesso não pôde ser removida. Avise o suporte.'
    }
  } catch (err) {
    console.error('Erro ao remover conta de acesso do colaborador excluído:', err)
    avisoAuth = 'O cadastro foi excluído, mas a conta de acesso não pôde ser removida. Avise o suporte.'
  }

  await registrarAuditoria({
    atorId: user.id,
    acao: 'colaborador.excluir',
    entidade: 'colaboradores',
    entidadeId: id,
    antes,
    depois: { apontamentos_arquivados: arquivados ?? 0, conta_auth_removida: avisoAuth === null },
  }, profile.organizacao_id)

  revalidatePath('/colaboradores')
  revalidatePath('/gestao/equipe')
  revalidatePath('/gestao/acessos')
  revalidatePath('/dashboard')

  if (avisoAuth) return { ok: false, error: avisoAuth }
  return { ok: true, data: { arquivados: arquivados ?? 0 } }
}
