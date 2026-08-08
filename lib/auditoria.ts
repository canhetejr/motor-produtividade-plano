import 'server-only'
import { createAdminClient } from '@/utils/supabase/admin'
import type { Json } from '@/lib/database.types'

import { NovoEvento } from '@/lib/auditoria-constants'
// Best-effort, mesmo padrão de criarNotificacao (lib/notifications.ts): uma
// falha ao registrar auditoria não deve derrubar a ação principal, só fica
// logada. Insert sempre via admin client — só service_role escreve.
//
// `organizacaoId` vem do chamador (session.profile.organizacao_id): a
// própria lib não tem sessão nem client escopado por RLS para redescobrir
// isso sozinha, e o admin client bypassa RLS de qualquer forma.
export async function registrarAuditoria(e: NovoEvento, organizacaoId: string) {
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('auditoria').insert({
      ator_id: e.atorId,
      acao: e.acao,
      entidade: e.entidade,
      entidade_id: e.entidadeId ?? null,
      dados_antes: (e.antes ?? null) as Json,
      dados_depois: (e.depois ?? null) as Json,
      organizacao_id: organizacaoId,
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

