'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireGestor, requireAdmin, isAdmin } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { registrarAuditoria } from '@/lib/auditoria'
import { verificarSenhaVazada, mensagemDeRecusa } from '@/lib/senha-vazada'
import { lerLinhasPlanilha, type LinhaImportResultado } from '@/lib/import-planilha'
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
  password: passwordSchema,
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
    return { ok: false, error: 'Falha ao atualizar o colaborador.' }
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
  password: string
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
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: dados.email,
    password: dados.password,
    email_confirm: true,
  })

  if (authError || !created.user) {
    console.error('Erro ao criar usuário:', authError)
    return { ok: false, error: authError?.message ?? 'Falha ao criar usuário no Auth.' }
  }

  const { error: dbError } = await admin.from('colaboradores').insert({
    id: created.user.id,
    nome: dados.nome,
    area_id: dados.area_id,
    carga_horaria_min: dados.carga_horaria_min,
    role: dados.role,
    ativo: true,
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

  const recusaSenha = mensagemDeRecusa(await verificarSenhaVazada(parsed.data.password))
  if (recusaSenha) return { ok: false, error: recusaSenha }

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

  let linhas: Record<string, string>[]
  try {
    linhas = await lerLinhasPlanilha(file)
  } catch (err) {
    console.error('Erro ao ler planilha de colaboradores:', err)
    return { ok: false, error: 'Não foi possível ler o arquivo. Confira se é um CSV ou XLSX válido.' }
  }
  if (linhas.length === 0) {
    return {
      ok: false,
      error: 'Nenhuma linha encontrada (confira o cabeçalho: nome, email, senha, area, carga_horaria_min, role).',
    }
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

  await registrarAuditoria({
    atorId: user.id,
    acao: 'colaborador.reset_senha',
    entidade: 'colaboradores',
    entidadeId: id,
  }, profile.organizacao_id)

  return { ok: true }
}

