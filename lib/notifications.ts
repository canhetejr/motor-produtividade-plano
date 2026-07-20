import 'server-only'
import { createAdminClient } from '@/utils/supabase/admin'

type NovaNotificacao = {
  destinatarioId: string
  tipo: string
  titulo: string
  mensagem?: string
  link?: string
}

// Best-effort: falha ao notificar não deve derrubar a ação principal
// (criar/aprovar/rejeitar solicitação), só fica logada.
export async function criarNotificacao(n: NovaNotificacao) {
  const admin = createAdminClient()
  const { error } = await admin.from('notificacoes').insert({
    destinatario_id: n.destinatarioId,
    tipo: n.tipo,
    titulo: n.titulo,
    mensagem: n.mensagem ?? null,
    link: n.link ?? null,
  })
  if (error) {
    console.error('Falha ao criar notificação: code=%s message=%s', error.code, error.message)
  }
}

export async function notificarGestores(n: Omit<NovaNotificacao, 'destinatarioId'>) {
  const admin = createAdminClient()
  const { data: gestores, error } = await admin
    .from('colaboradores')
    .select('id')
    .eq('role', 'gestor')
    .eq('ativo', true)

  if (error) {
    console.error('Falha ao buscar gestores para notificar: code=%s message=%s', error.code, error.message)
    return
  }

  await Promise.all((gestores ?? []).map((g) => criarNotificacao({ ...n, destinatarioId: g.id })))
}
