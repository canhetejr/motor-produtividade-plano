import 'server-only'
import { createAdminClient } from '@/utils/supabase/admin'

type NovoEvento = {
  atorId: string
  acao: string
  entidade: string
  entidadeId?: string
  antes?: unknown
  depois?: unknown
}

// Best-effort, mesmo padrão de criarNotificacao (lib/notifications.ts): uma
// falha ao registrar auditoria não deve derrubar a ação principal, só fica
// logada. Insert sempre via admin client — só service_role escreve.
export async function registrarAuditoria(e: NovoEvento) {
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('auditoria').insert({
      ator_id: e.atorId,
      acao: e.acao,
      entidade: e.entidade,
      entidade_id: e.entidadeId ?? null,
      dados_antes: e.antes ?? null,
      dados_depois: e.depois ?? null,
    })
    if (error) {
      console.error('Falha ao registrar auditoria: code=%s message=%s', error.code, error.message)
    }
  } catch (err) {
    // createAdminClient() lança se SUPABASE_SERVICE_ROLE_KEY não estiver
    // configurada — não deve derrubar a ação principal por isso.
    console.error('Falha ao registrar auditoria:', err)
  }
}
