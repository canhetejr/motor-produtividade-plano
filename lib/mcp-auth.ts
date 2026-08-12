import 'server-only'
import { randomBytes, createHash } from 'node:crypto'
import { createAdminClient } from '@/utils/supabase/admin'
import { createImpersonatedClient } from '@/utils/supabase/mcp'
import { assinarJwtImpersonado } from '@/lib/mcp-jwt'

export const PREFIXO_TOKEN_MCP = 'vrt_mcp_'

// Cresce conforme novas tools de escrita são adicionadas (docs/PLANO-MCP.md,
// fases 2+). requireEscopo() barra a tool antes de qualquer core rodar.
export type EscopoMcp = 'apontamento:leitura' | 'apontamento:escrita' | 'kanban:leitura' | 'kanban:escrita'

export const ESCOPOS_MCP_DISPONIVEIS: EscopoMcp[] = [
  'apontamento:leitura',
  'apontamento:escrita',
  'kanban:leitura',
  'kanban:escrita',
]

export type McpSessao = {
  tokenId: string
  colaboradorId: string
  organizacaoId: string
  escopos: string[]
  supabase: ReturnType<typeof createImpersonatedClient>
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Gera um novo segredo de token MCP. O valor em claro (`token`) só existe
 * neste retorno — a UI (app/(app)/perfil/mcp) precisa mostrá-lo ao
 * colaborador uma única vez; o banco só recebe o hash e o prefixo.
 */
export function gerarTokenMcp() {
  const segredo = randomBytes(32).toString('hex')
  const token = `${PREFIXO_TOKEN_MCP}${segredo}`
  return {
    token,
    tokenHash: hashToken(token),
    tokenPrefixo: token.slice(0, PREFIXO_TOKEN_MCP.length + 8),
  }
}

/**
 * Resolve um header `Authorization: Bearer <token>` numa sessão MCP: quem é
 * o colaborador, sua organização, os escopos autorizados, e um client
 * Supabase impersonado (não service role) pronto para as tools usarem.
 *
 * Único ponto do fluxo MCP que usa createAdminClient() — necessário porque,
 * neste momento, ainda não existe nenhuma sessão para RLS avaliar: é o
 * próprio token que prova a identidade do chamador. Allowlisted em
 * __tests__/isolamento/admin-client-estatico.test.ts (skill
 * vertice-isolamento, regra 5).
 */
export async function resolverMcpToken(authorizationHeader: string | null): Promise<McpSessao | null> {
  const token = authorizationHeader?.startsWith('Bearer ')
    ? authorizationHeader.slice('Bearer '.length).trim()
    : null
  if (!token || !token.startsWith(PREFIXO_TOKEN_MCP)) return null

  const admin = createAdminClient()
  const { data: registro, error } = await admin
    .from('mcp_tokens')
    .select('id, colaborador_id, organizacao_id, escopos, expira_em, revogado_em')
    .eq('token_hash', hashToken(token))
    .maybeSingle()

  if (error) {
    console.error('Falha ao resolver token MCP:', error)
    return null
  }
  if (!registro || registro.revogado_em) return null
  if (registro.expira_em && new Date(registro.expira_em).getTime() < Date.now()) return null

  // Best-effort: uma falha em atualizar o carimbo de uso não deve barrar a
  // chamada MCP em si.
  void admin
    .from('mcp_tokens')
    .update({ ultimo_uso_em: new Date().toISOString() })
    .eq('id', registro.id)
    .then(({ error: erroUltimoUso }) => {
      if (erroUltimoUso) console.error('Falha ao atualizar ultimo_uso_em do token MCP:', erroUltimoUso)
    })

  const jwt = assinarJwtImpersonado(registro.colaborador_id)

  return {
    tokenId: registro.id,
    colaboradorId: registro.colaborador_id,
    organizacaoId: registro.organizacao_id,
    escopos: registro.escopos,
    supabase: createImpersonatedClient(jwt),
  }
}

export class EscopoInsuficienteError extends Error {
  constructor(escopo: string) {
    super(`Token sem permissão: ${escopo}`)
    this.name = 'EscopoInsuficienteError'
  }
}

export function requireEscopo(sessao: McpSessao, escopo: EscopoMcp) {
  if (!sessao.escopos.includes(escopo)) throw new EscopoInsuficienteError(escopo)
}
