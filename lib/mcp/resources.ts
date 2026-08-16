import 'server-only'
import { format, subDays } from 'date-fns'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { requireEscopo, type McpSessao } from '@/lib/mcp-auth'
import {
  carregarPerfilMcp,
  listarApontamentos,
  listarCartoesPendentes,
  listarDemandasMinhas,
  listarQuadrosAcessiveis,
} from '@/lib/mcp/queries'
import { hoje } from '@/lib/dates'

function conteudoJson(uri: string, dado: unknown) {
  return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(dado, null, 2) }] }
}

// Recortes fixos por identidade do token, sem parâmetro de negócio — o
// caso comum "meu dia/minha semana/meus pendentes" não exige que o agente
// formule argumento nenhum. Leitura parametrizada (período arbitrário,
// filtro) fica só nas tools (lib/mcp/tools), que é o mecanismo do
// protocolo para argumentos.
export function registrarResources(server: McpServer, sessao: McpSessao) {
  const identidade = { colaboradorId: sessao.colaboradorId, organizacaoId: sessao.organizacaoId }

  server.registerResource(
    'apontamentos-hoje',
    'vertice://apontamentos/hoje',
    { title: 'Meus apontamentos de hoje', description: 'Apontamentos de tempo do colaborador autenticado no dia de hoje.', mimeType: 'application/json' },
    async (uri) => {
      requireEscopo(sessao, 'apontamento:leitura')
      const hojeIso = hoje()
      const apontamentos = await listarApontamentos(identidade, { desde: hojeIso, ate: hojeIso })
      return conteudoJson(uri.toString(), apontamentos)
    }
  )

  server.registerResource(
    'apontamentos-semana-atual',
    'vertice://apontamentos/semana-atual',
    { title: 'Meus apontamentos da semana', description: 'Apontamentos de tempo do colaborador autenticado nos últimos 7 dias.', mimeType: 'application/json' },
    async (uri) => {
      requireEscopo(sessao, 'apontamento:leitura')
      const apontamentos = await listarApontamentos(identidade, {
        desde: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
        ate: hoje(),
      })
      return conteudoJson(uri.toString(), apontamentos)
    }
  )

  server.registerResource(
    'demandas-minhas',
    'vertice://demandas/minhas',
    { title: 'Minhas demandas', description: 'Demandas ativas da área do colaborador autenticado.', mimeType: 'application/json' },
    async (uri) => {
      requireEscopo(sessao, 'apontamento:leitura')
      const perfil = await carregarPerfilMcp(identidade)
      const demandas = await listarDemandasMinhas(identidade, { areaId: perfil.area_id })
      return conteudoJson(uri.toString(), demandas)
    }
  )

  server.registerResource(
    'quadros-meus',
    'vertice://quadros/meus',
    {
      title: 'Meus quadros',
      description: 'Quadros de kanban que o colaborador autenticado alcança, com as colunas de cada um.',
      mimeType: 'application/json',
    },
    async (uri) => {
      requireEscopo(sessao, 'kanban:leitura')
      return conteudoJson(uri.toString(), await listarQuadrosAcessiveis(identidade))
    }
  )

  server.registerResource(
    'cartoes-meus-pendentes',
    'vertice://cartoes/meus-pendentes',
    { title: 'Meus cartões pendentes', description: 'Cartões do kanban atribuídos ao colaborador autenticado, fora de etapa final.', mimeType: 'application/json' },
    async (uri) => {
      requireEscopo(sessao, 'kanban:leitura')
      const cartoes = await listarCartoesPendentes(identidade)
      return conteudoJson(uri.toString(), cartoes)
    }
  )
}
