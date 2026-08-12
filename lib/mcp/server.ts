import 'server-only'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { McpSessao } from '@/lib/mcp-auth'
import { registrarToolsApontamentos } from '@/lib/mcp/tools/apontamentos'
import { registrarToolsKanban } from '@/lib/mcp/tools/kanban'
import { registrarResources } from '@/lib/mcp/resources'

/**
 * Monta um McpServer novo por chamada, escopado à sessão resolvida do token
 * (lib/mcp-auth.ts). Sem estado entre requisições — cada POST em
 * app/api/mcp/route.ts refaz o handshake, o que é aceitável em modo
 * stateless (sessionIdGenerator: undefined) e evita reter o client
 * impersonado (com JWT de ~90s) além do necessário.
 */
export function criarServidorMcp(sessao: McpSessao): McpServer {
  const server = new McpServer({ name: 'vertice', version: '0.1.0' })
  registrarToolsApontamentos(server, sessao)
  registrarToolsKanban(server, sessao)
  registrarResources(server, sessao)
  return server
}
