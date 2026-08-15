import 'server-only'
import { randomBytes, createHash } from 'node:crypto'
import { createAdminClient } from '@/utils/supabase/admin'

export const PREFIXO_TOKEN_WEBHOOK = 'vrt_wh_'

export type WebhookFormularioSessao = {
  webhookId: string
  formularioId: string
  quadroId: string
  organizacaoId: string
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Gera um novo segredo de webhook. O valor em claro (`token`) só existe
 * neste retorno — a UI (formularios-manager.tsx) mostra uma única vez; o
 * banco só recebe o hash e o prefixo. Mesmo esquema de lib/mcp-auth.ts.
 */
export function gerarTokenWebhook() {
  const segredo = randomBytes(32).toString('hex')
  const token = `${PREFIXO_TOKEN_WEBHOOK}${segredo}`
  return {
    token,
    tokenHash: hashToken(token),
    tokenPrefixo: token.slice(0, PREFIXO_TOKEN_WEBHOOK.length + 8),
  }
}

/**
 * Resolve um header `Authorization: Bearer <token>` no formulário/quadro
 * autorizado a receber o POST. Sem sessão pra RLS avaliar (é o próprio
 * token que prova quem chama, igual a resolverMcpToken), então roda via
 * service role — confinado a este arquivo.
 */
export async function resolverWebhookFormulario(
  authorizationHeader: string | null
): Promise<WebhookFormularioSessao | null> {
  const token = authorizationHeader?.startsWith('Bearer ')
    ? authorizationHeader.slice('Bearer '.length).trim()
    : null
  if (!token || !token.startsWith(PREFIXO_TOKEN_WEBHOOK)) return null

  const admin = createAdminClient()
  const { data: registro, error } = await admin
    .from('formularios_webhooks')
    .select('id, formulario_id, quadro_id, organizacao_id, ativo, revogado_em')
    .eq('token_hash', hashToken(token))
    .maybeSingle()

  if (error) {
    console.error('Falha ao resolver webhook de formulário:', error)
    return null
  }
  if (!registro || !registro.ativo || registro.revogado_em) return null

  // Best-effort, mesmo padrão de resolverMcpToken: uma falha ao atualizar o
  // carimbo de uso não deve barrar a chamada em si.
  void admin
    .from('formularios_webhooks')
    .update({ ultimo_uso_em: new Date().toISOString() })
    .eq('id', registro.id)
    .then(({ error: erroUltimoUso }) => {
      if (erroUltimoUso) console.error('Falha ao atualizar ultimo_uso_em do webhook:', erroUltimoUso)
    })

  return {
    webhookId: registro.id,
    formularioId: registro.formulario_id,
    quadroId: registro.quadro_id,
    organizacaoId: registro.organizacao_id,
  }
}
