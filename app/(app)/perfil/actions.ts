'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { registrarAuditoria } from '@/lib/auditoria'
import { verificarSenhaVazada, mensagemDeRecusa } from '@/lib/senha-vazada'
import type { Database } from '@/lib/database.types'
import type { ActionResult } from '@/lib/action-result'

type ColaboradorUpdate = Database['public']['Tables']['colaboradores']['Update']

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
  const { user } = await requireUser()

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
    })
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
  })

  revalidatePath('/', 'layout')
  return { ok: true }
}

const AVATAR_MAX_BYTES = 2 * 1024 * 1024
const AVATAR_TIPOS = new Set(['image/png', 'image/jpeg', 'image/webp'])

export async function updateMeuAvatar(formData: FormData): Promise<ActionResult> {
  const { user } = await requireUser()

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

  // Mesmo path sempre ("{id}/avatar", sem extensão) + upsert: sobrescreve o
  // arquivo anterior em vez de acumular versões órfãs no bucket.
  const path = `${user.id}/avatar`
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
    })
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

const passwordSchema = z.string().min(6, 'Senha deve ter ao menos 6 caracteres')

// Autoatendimento de senha: usa a própria sessão via auth.updateUser, sem
// precisar de service role — diferente de resetColaboradorPassword, que é o
// gestor redefinindo a senha de outra pessoa.
export async function updateMinhaSenha(formData: FormData): Promise<ActionResult> {
  const { user } = await requireUser()
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

  await registrarAuditoria({
    atorId: user.id,
    acao: 'perfil.atualizar_senha',
    entidade: 'colaboradores',
    entidadeId: user.id,
  })

  return { ok: true }
}

