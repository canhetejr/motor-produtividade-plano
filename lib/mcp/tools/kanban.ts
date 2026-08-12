import 'server-only'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { requireEscopo, type McpSessao } from '@/lib/mcp-auth'
import { listarCartoesPendentes } from '@/lib/mcp/queries'
import { textoJson, erroFerramenta, mensagemDeErro } from '@/lib/mcp/tool-helpers'

export function registrarToolsKanban(server: McpServer, sessao: McpSessao) {
  server.registerTool(
    'cartoes_meus_pendentes',
    {
      title: 'Meus cartões pendentes',
      description:
        'Lista os cartões do kanban atribuídos ao colaborador autenticado que ainda não estão em uma etapa final, em todos os quadros de que participa.',
      inputSchema: {},
    },
    async () => {
      try {
        requireEscopo(sessao, 'kanban:leitura')
        const cartoes = await listarCartoesPendentes({
          colaboradorId: sessao.colaboradorId,
          organizacaoId: sessao.organizacaoId,
        })
        return textoJson(cartoes)
      } catch (err) {
        return erroFerramenta(mensagemDeErro(err, 'Falha ao listar cartões pendentes.'))
      }
    }
  )
}
