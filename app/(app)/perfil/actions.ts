'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { registrarAuditoria } from '@/lib/auditoria'
import { verificarSenhaVazada, mensagemDeRecusa } from '@/lib/senha-vazada'
import { validarNovoEmail, mensagemDeErroDaTrocaDeEmail } from '@/lib/troca-email'
import type { Database } from '@/lib/database.types'
import type { ActionResult } from '@/lib/action-result'

type ColaboradorUpdate = Database['public']['Tables']['colaboradores']['Update']

// Mesmo fallback de lib/email.ts. O link de confirmação vai por e-mail e é
// clicado fora do app: uma URL relativa não funcionaria, e sem o fallback o
// e-mail sairia apontando para "undefined/auth/confirmar" num ambiente onde a
// variável não estivesse configurada.
const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL ?? 'https://vertice.teralabs.cloud').replace(/\/$/, '')

// Única policy de UPDATE em colaboradores é gestor-only
// (colaboradores_update_gestor) — colaborador não pode se auto-editar via
// RLS. Em vez de abrir uma policy de auto-edição (que exigiria também
// restringir por coluna via GRANT pra não deixar auto-promover
// role/area_id/carga_horaria_min), essas ações usam o client admin travado
// em `.eq('id', user.id)` vindo da sessão — mesmo padrão de
// createColaborador/resetColaboradorPassword — só pra colunas específicas.
async function atualizarProprioRegistro(userId: string, patch: ColaboradorUpdate): Promise<ActionResult> {
  let admin
  try {
    admin = createAdminClient()
  } catch {
    return {
      ok: false,
      error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor — necessária para atualizar o perfil.',
    }
  }

  const { error } = await admin.from('colaboradores').update(patch).eq('id', userId)
  if (error) {
    console.error('Erro ao atualizar o próprio perfil: code=%s message=%s', error.code, error.message)
    return { ok: false, error: 'Falha ao atualizar o perfil.' }
  }

  // Nome/avatar aparecem na sidebar (fora do escopo de /perfil) — revalida
  // tudo pra não deixar o layout desatualizado até a próxima navegação forçada.
  revalidatePath('/', 'layout')
  return { ok: true }
}

const nomeSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome'),
})

export async function updateMeuNome(formData: FormData): Promise<ActionResult> {
  const { user, profile } = await requireUser()

  const parsed = nomeSchema.safeParse({ nome: formData.get('nome') })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const res = await atualizarProprioRegistro(user.id, { nome: parsed.data.nome })
  if (res.ok) {
    await registrarAuditoria({
      atorId: user.id,
      acao: 'perfil.atualizar_nome',
      entidade: 'colaboradores',
      entidadeId: user.id,
      depois: { nome: parsed.data.nome },
    }, profile.organizacao_id)
  }
  return res
}

const dadosGestorSchema = z.object({
  area_id: z.string().uuid().nullable(),
  carga_horaria_min: z.coerce
    .number()
    .int('Carga horária deve ser em minutos inteiros')
    .positive('Carga horária deve ser maior que zero'),
})

// Diferente do nome (universal), área/carga só ficam editáveis pelo próprio
// perfil quando role = gestor — pra colaborador, essas colunas continuam
// exclusivas do gestor via /catalogo. Um gestor já pode editar essas mesmas
// colunas em si mesmo através da aba Colaboradores (RLS não distingue "o
// próprio" gestor de "outro" colaborador), então isso é só um atalho: usa o
// client normal, sem precisar do admin, porque colaboradores_update_gestor
// já libera pra quem tem role = gestor.
export async function updateMeusDadosGestor(formData: FormData): Promise<ActionResult> {
  const { user, profile } = await requireUser()
  if (profile.role !== 'gestor') {
    return { ok: false, error: 'Apenas gestores podem editar esses dados pelo próprio perfil.' }
  }

  const parsed = dadosGestorSchema.safeParse({
    area_id: formData.get('area_id') || null,
    carga_horaria_min: formData.get('carga_horaria_min'),
  })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { error } = await supabase
    .from('colaboradores')
    .update({ area_id: parsed.data.area_id, carga_horaria_min: parsed.data.carga_horaria_min })
    .eq('id', user.id)

  if (error) {
    console.error('Erro ao atualizar dados do próprio perfil (gestor): code=%s message=%s', error.code, error.message)
    return { ok: false, error: 'Falha ao atualizar os dados.' }
  }

  await registrarAuditoria({
    atorId: user.id,
    acao: 'colaborador.atualizar',
    entidade: 'colaboradores',
    entidadeId: user.id,
    depois: parsed.data,
  }, profile.organizacao_id)

  revalidatePath('/', 'layout')
  return { ok: true }
}

const AVATAR_MAX_BYTES = 2 * 1024 * 1024
const AVATAR_TIPOS = new Set(['image/png', 'image/jpeg', 'image/webp'])

export async function updateMeuAvatar(formData: FormData): Promise<ActionResult> {
  const { user, profile } = await requireUser()

  const file = formData.get('avatar')
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Selecione uma imagem.' }
  }
  if (!AVATAR_TIPOS.has(file.type)) {
    return { ok: false, error: 'Use uma imagem PNG, JPEG ou WebP.' }
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return { ok: false, error: 'Imagem muito grande (máximo 2MB).' }
  }

  let admin
  try {
    admin = createAdminClient()
  } catch {
    return {
      ok: false,
      error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor — necessária para atualizar o perfil.',
    }
  }

  // Mesmo path sempre ("{org_id}/{id}/avatar", sem extensão) + upsert:
  // sobrescreve o arquivo anterior em vez de acumular versões órfãs no
  // bucket. org_id vem da sessão (não é escolha do cliente) — avatares
  // antigos em "{id}/avatar" não são migrados nesta leva, de propósito: sem
  // valor em reescrever histórico só para não deixar rastro.
  const path = `${profile.organizacao_id}/${user.id}/avatar`
  const { error: uploadError } = await admin.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (uploadError) {
    console.error('Erro ao enviar avatar:', uploadError.message)
    return { ok: false, error: 'Falha ao enviar a imagem.' }
  }

  const { data: publicUrlData } = admin.storage.from('avatars').getPublicUrl(path)
  // Cache-busting: o path não muda entre uploads, então sem isso o browser
  // continuaria mostrando a imagem antiga em cache.
  const avatarUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`

  const res = await atualizarProprioRegistro(user.id, { avatar_url: avatarUrl })
  if (res.ok) {
    await registrarAuditoria({
      atorId: user.id,
      acao: 'perfil.atualizar_avatar',
      entidade: 'colaboradores',
      entidadeId: user.id,
    }, profile.organizacao_id)
  }
  return res
}

const notifPrefsSchema = z.object({
  notif_lembrete_diario: z.boolean(),
  notif_solicitacoes: z.boolean(),
  notif_alerta_queda: z.boolean(),
  notif_relatorio_semanal: z.boolean(),
})

export async function updateMinhasNotificacoes(formData: FormData): Promise<ActionResult> {
  const { user } = await requireUser()

  const parsed = notifPrefsSchema.safeParse({
    notif_lembrete_diario: formData.get('notif_lembrete_diario') === 'on',
    notif_solicitacoes: formData.get('notif_solicitacoes') === 'on',
    notif_alerta_queda: formData.get('notif_alerta_queda') === 'on',
    notif_relatorio_semanal: formData.get('notif_relatorio_semanal') === 'on',
  })
  if (!parsed.success) return { ok: false, error: 'Dados inválidos.' }

  return atualizarProprioRegistro(user.id, parsed.data)
}

/**
 * Pede a troca do próprio e-mail.
 *
 * `auth.updateUser({ email })` não troca nada na hora: ele registra o pedido
 * em `auth.users.new_email` e dispara o e-mail de confirmação. A sessão atual
 * continua válida o tempo todo — o endereço só muda quando o link é clicado.
 *
 * Chamar de novo sobrescreve um pedido pendente, então "reenviar" e "corrigir
 * o endereço" são a mesma operação e não precisam de caminho próprio.
 */
export async function solicitarTrocaEmail(formData: FormData): Promise<ActionResult> {
  const { user, profile } = await requireUser()
  const supabase = await createClient()

  const validado = validarNovoEmail(formData.get('email'), user.email ?? '')
  if (!validado.ok) return { ok: false, error: validado.erro }

  const { error } = await supabase.auth.updateUser(
    { email: validado.email },
    { emailRedirectTo: `${appUrl()}/auth/confirmar?next=/perfil` }
  )
  if (error) {
    // Nunca logar o endereço pedido: se a troca falhou por já existir conta,
    // o log viraria uma forma de descobrir quem tem conta no Vértice.
    console.error('Erro ao pedir troca de e-mail: status=%s message=%s', error.status, error.message)
    return { ok: false, error: mensagemDeErroDaTrocaDeEmail(error.message) }
  }

  // Auditado como *pedido*, não como troca: neste ponto nada mudou ainda. O
  // endereço novo entra no registro porque é o que permite reconstruir quem
  // pediu o quê caso a conta seja disputada depois.
  await registrarAuditoria(
    {
      atorId: user.id,
      acao: 'perfil.solicitar_troca_email',
      entidade: 'auth',
      entidadeId: user.id,
      antes: { email: user.email ?? null },
      depois: { email_pendente: validado.email },
    },
    profile.organizacao_id
  )

  revalidatePath('/perfil')
  return { ok: true }
}

const passwordSchema = z.string().min(6, 'Senha deve ter ao menos 6 caracteres')

// Autoatendimento de senha: usa a própria sessão via auth.updateUser, sem
// precisar de service role — diferente de resetColaboradorPassword, que é o
// gestor redefinindo a senha de outra pessoa.
export async function updateMinhaSenha(formData: FormData): Promise<ActionResult> {
  const { user, profile } = await requireUser()
  const supabase = await createClient()

  const parsed = passwordSchema.safeParse(formData.get('password'))
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  // Definir a senha é o único momento em que dá para recusar uma que já vazou.
  const recusa = mensagemDeRecusa(await verificarSenhaVazada(parsed.data))
  if (recusa) return { ok: false, error: recusa }

  const { error } = await supabase.auth.updateUser({ password: parsed.data })
  if (error) {
    console.error('Erro ao atualizar a própria senha:', error.message)
    return { ok: false, error: error.message || 'Falha ao atualizar a senha.' }
  }

  // A senha só deixa de ser provisória depois que o Auth aceitou a nova. O
  // update usa service role com o id vindo da sessão, pois a RLS não permite
  // que a própria pessoa altere outras colunas do perfil.
  const liberacao = await atualizarProprioRegistro(user.id, { troca_senha_obrigatoria: false })
  if (!liberacao.ok) {
    return { ok: false, error: 'Senha atualizada, mas não foi possível liberar o acesso. Tente novamente.' }
  }

  await registrarAuditoria({
    atorId: user.id,
    acao: 'perfil.atualizar_senha',
    entidade: 'colaboradores',
    entidadeId: user.id,
  }, profile.organizacao_id)

  return { ok: true }
}


/**
 * Liga e desliga o segundo fator da própria conta.
 *
 * Só a própria: um gestor não deve poder desligar o segundo fator de outra
 * pessoa por aqui — seria a forma mais direta de contornar a proteção que ela
 * escolheu.
 */
export async function alternarMfaEmail(ativo: boolean): Promise<ActionResult> {
  const { user, profile } = await requireUser()
  const supabase = await createClient()

  const { error } = await supabase
    .from('colaboradores')
    .update({ mfa_email_ativo: ativo })
    .eq('id', user.id)

  if (error) {
    console.error('Falha ao alternar MFA: code=%s message=%s', error.code, error.message)
    return { ok: false, error: 'Não foi possível alterar a verificação em duas etapas.' }
  }

  await registrarAuditoria({
    atorId: user.id,
    acao: ativo ? 'perfil.mfa_ativado' : 'perfil.mfa_desativado',
    entidade: 'colaboradores',
    entidadeId: user.id,
  }, profile.organizacao_id)

  return { ok: true }
}
