import 'server-only'
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { requireEscopo, type McpSessao } from '@/lib/mcp-auth'
import { listarCartoesPendentes } from '@/lib/mcp/queries'
import { textoJson, erroFerramenta, mensagemDeErro } from '@/lib/mcp/tool-helpers'
import { moverCartaoCore } from '@/app/(app)/kanban/actions'

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
        const cartoes = await listarCartoesPendentes(sessao.supabase, { colaboradorId: sessao.colaboradorId })
        return textoJson(cartoes)
      } catch (err) {
        return erroFerramenta(mensagemDeErro(err, 'Falha ao listar cartões pendentes.'))
      }
    }
  )

  server.registerTool(
    'cartao_mover',
    {
      title: 'Mover cartão',
      description:
        'Move um cartão do kanban para outra coluna do mesmo quadro. Dispara os mesmos comentário de sistema, automações e sincronização de calendário que uma movimentação feita na interface — a origem via agente não é um caminho silencioso.',
      inputSchema: {
        cartao_id: z.string().uuid().describe('UUID do cartão.'),
        coluna_destino_id: z.string().uuid().describe('UUID da coluna de destino, no mesmo quadro do cartão.'),
        quadro_id: z.string().uuid().describe('UUID do quadro ao qual o cartão pertence.'),
      },
    },
    async ({ cartao_id, coluna_destino_id, quadro_id }) => {
      try {
        requireEscopo(sessao, 'kanban:escrita')
        const resultado = await moverCartaoCore(
          sessao.supabase,
          { userId: sessao.colaboradorId, organizacaoId: sessao.organizacaoId },
          // ordens vazio: a tool não tem contexto de arrasto visual — o
          // cartão muda de coluna, mas não reordena os demais dela. A UI
          // continua sendo o caminho para reordenar manualmente.
          { cartaoId: cartao_id, colunaDestinoId: coluna_destino_id, quadroId: quadro_id, ordens: [] }
        )
        if (!resultado.ok) return erroFerramenta(resultado.error)
        return textoJson({ sucesso: true, mensagem: 'Cartão movido.' })
      } catch (err) {
        return erroFerramenta(mensagemDeErro(err, 'Falha ao mover o cartão.'))
      }
    }
  )
}
