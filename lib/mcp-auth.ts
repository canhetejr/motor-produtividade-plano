import 'server-only'
import { randomBytes, createHash } from 'node:crypto'
import { createAdminClient } from '@/utils/supabase/admin'

export const PREFIXO_TOKEN_MCP = 'vrt_mcp_'

// Reexportado de lib/mcp-escopos.ts, que não é server-only: o componente de
// cliente da tela de tokens precisa dos mesmos valores, e importá-los daqui
// levaria o client de service role para o bundle do navegador.
export {
  ESCOPOS_MCP_DISPONIVEIS,
  ESCOPOS_MCP_ESCRITA,
  ehEscopoDeEscrita,
  type EscopoMcp,
} from '@/lib/mcp-escopos'
import type { EscopoMcp } from '@/lib/mcp-escopos'

// Identidade resolvida do token — nunca carrega um client Supabase. Quem
// precisa ler dado usa lib/mcp/queries.ts, que recebe colaboradorId/
// organizacaoId e filtra explicitamente por eles; nenhuma tool tem acesso a
// um `.from()` livre.
export type McpSessao = {
  tokenId: string
  colaboradorId: string
  organizacaoId: string
  escopos: string[]
}

const STATUS_ORGANIZACAO_ATIVOS = new Set(['trialing', 'ativa'])

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Gera um novo segredo de token MCP. O valor em claro (`token`) só existe
 * neste retorno — a UI (app/(app)/perfil/mcp-tokens-manager.tsx) precisa
 * mostrá-lo ao colaborador uma única vez; o banco só recebe o hash e o
 * prefixo.
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
 * Resolve um header `Authorization: Bearer <token>` na identidade
 * autorizada a agir via MCP: colaborador, organização e escopos.
 *
 * O projeto assina sessões com JWT Signing Keys assimétricas (ECC P-256) —
 * não existe segredo simétrico disponível para assinar um JWT de
 * impersonação (o "Legacy JWT Secret" só verifica tokens antigos, nunca
 * deveria assinar um novo). Sem sessão para RLS avaliar, toda leitura do
 * MCP roda via service role — deliberadamente confinado a este arquivo e a
 * lib/mcp/queries.ts (allowlisted em
 * __tests__/isolamento/admin-client-estatico.test.ts), nunca exposto a uma
 * tool. `org_atual()` normalmente barra colaborador inativo/organização
 * suspensa de graça via RLS; como aqui não há RLS em jogo, este guard
 * reproduz a mesma checagem à mão.
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

  // Mesmo embed usado em lib/auth.ts::getProfile(), inclusive a FK nomeada:
  // `colaboradores` tem duas relações com `organizacoes` desde a migration
  // 20260812200000, e sem o nome o PostgREST recusa com PGRST201 — aqui isso
  // faria todo token MCP válido ser tratado como inválido. Confirma, num único
  // round-trip, que o colaborador do token continua ativo e que a
  // organização segue trialing/ativa. organizacao_id vem do próprio
  // registro do token (fonte confiável), não de entrada do chamador.
  const { data: colaborador } = await admin
    .from('colaboradores')
    .select('ativo, organizacoes!colaboradores_organizacao_id_fkey(status)')
    .eq('id', registro.colaborador_id)
    .eq('organizacao_id', registro.organizacao_id)
    .maybeSingle()

  if (!colaborador?.ativo) return null
  const statusOrganizacao = (colaborador.organizacoes as unknown as { status: string } | null)?.status
  if (!statusOrganizacao || !STATUS_ORGANIZACAO_ATIVOS.has(statusOrganizacao)) return null

  // Best-effort: uma falha em atualizar o carimbo de uso não deve barrar a
  // chamada MCP em si.
  void admin
    .from('mcp_tokens')
    .update({ ultimo_uso_em: new Date().toISOString() })
    .eq('id', registro.id)
    .then(({ error: erroUltimoUso }) => {
      if (erroUltimoUso) console.error('Falha ao atualizar ultimo_uso_em do token MCP:', erroUltimoUso)
    })

  return {
    tokenId: registro.id,
    colaboradorId: registro.colaborador_id,
    organizacaoId: registro.organizacao_id,
    escopos: registro.escopos,
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
