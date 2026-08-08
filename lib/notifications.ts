import 'server-only'
import { createAdminClient } from '@/utils/supabase/admin'
import { enviarPush } from '@/lib/push'

type NovaNotificacao = {
  destinatarioId: string
  tipo: string
  titulo: string
  mensagem?: string
  link?: string
}

// Os 3 tipos de notificação do fluxo de aprovação de demandas — controlados
// por colaboradores.notif_solicitacoes (tela de Perfil).
const TIPOS_SOLICITACAO = new Set(['solicitacao_pendente', 'solicitacao_aprovada', 'solicitacao_rejeitada'])

// Best-effort: falha ao notificar não deve derrubar a ação principal
// (criar/aprovar/rejeitar solicitação), só fica logada.
//
// `organizacaoId` vem do chamador (session.profile.organizacao_id) — este
// client é service role e bypassa RLS, então sem o filtro explícito a busca
// de destinatário/gestores em notificarGestores() varreria todas as
// organizações, não só a de quem disparou a notificação.
export async function criarNotificacao(n: NovaNotificacao, organizacaoId: string) {
  const admin = createAdminClient()

  if (TIPOS_SOLICITACAO.has(n.tipo)) {
    const { data: destinatario } = await admin
      .from('colaboradores')
      .select('notif_solicitacoes')
      .eq('id', n.destinatarioId)
      .eq('organizacao_id', organizacaoId)
      .single()
    if (destinatario?.notif_solicitacoes === false) return
  }

  const { error } = await admin.from('notificacoes').insert({
    destinatario_id: n.destinatarioId,
    tipo: n.tipo,
    titulo: n.titulo,
    mensagem: n.mensagem ?? null,
    link: n.link ?? null,
    organizacao_id: organizacaoId,
  })
  if (error) {
    console.error('Falha ao criar notificação: code=%s message=%s', error.code, error.message)
    // Sem a linha no banco, o push mostraria um aviso que o sino não confirma.
    return
  }

  // O push é um segundo canal do MESMO aviso, não um aviso a mais: sai depois
  // de a notificação existir no banco, e falhar aqui não desfaz nada. Quem não
  // autorizou push simplesmente não tem inscrição, e enviarPush devolve zero.
  try {
    await enviarPush(n.destinatarioId, {
      titulo: n.titulo,
      mensagem: n.mensagem ?? '',
      link: n.link ?? '/',
    })
  } catch (err) {
    console.error('Falha ao enviar push:', err)
  }
}

export async function notificarGestores(n: Omit<NovaNotificacao, 'destinatarioId'>, organizacaoId: string) {
  const admin = createAdminClient()
  // Sem o filtro de organização, isto notificaria o gestor de TODAS as
  // empresas a cada solicitação — o client de service role bypassa RLS e
  // não tem outra rede de proteção.
  const { data: gestores, error } = await admin
    .from('colaboradores')
    .select('id')
    .eq('role', 'gestor')
    .eq('ativo', true)
    .eq('notif_solicitacoes', true)
    .eq('organizacao_id', organizacaoId)

  if (error) {
    console.error('Falha ao buscar gestores para notificar: code=%s message=%s', error.code, error.message)
    return
  }

  await Promise.all(
    (gestores ?? []).map((g) => criarNotificacao({ ...n, destinatarioId: g.id }, organizacaoId))
  )
}
