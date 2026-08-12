import 'server-only'
import { z } from 'zod'
import { format, subDays } from 'date-fns'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { requireEscopo, type McpSessao } from '@/lib/mcp-auth'
import { carregarPerfilMcp, listarApontamentos, listarDemandasMinhas } from '@/lib/mcp/queries'
import { textoJson, erroFerramenta, mensagemDeErro } from '@/lib/mcp/tool-helpers'
import { hoje } from '@/lib/dates'

export function registrarToolsApontamentos(server: McpServer, sessao: McpSessao) {
  server.registerTool(
    'apontamentos_listar',
    {
      title: 'Listar apontamentos',
      description:
        'Lista os apontamentos de tempo do colaborador autenticado em um período. Sem parâmetros, devolve os últimos 7 dias.',
      inputSchema: {
        desde: z.string().date().optional().describe('Data inicial (AAAA-MM-DD). Padrão: 7 dias atrás.'),
        ate: z.string().date().optional().describe('Data final (AAAA-MM-DD). Padrão: hoje.'),
      },
    },
    async ({ desde, ate }) => {
      try {
        requireEscopo(sessao, 'apontamento:leitura')
        const ateIso = ate ?? hoje()
        const desdeIso = desde ?? format(subDays(new Date(), 7), 'yyyy-MM-dd')
        const apontamentos = await listarApontamentos(sessao.supabase, {
          colaboradorId: sessao.colaboradorId,
          desde: desdeIso,
          ate: ateIso,
        })
        return textoJson({ periodo: { desde: desdeIso, ate: ateIso }, apontamentos })
      } catch (err) {
        return erroFerramenta(mensagemDeErro(err, 'Falha ao listar apontamentos.'))
      }
    }
  )

  server.registerTool(
    'demandas_minhas',
    {
      title: 'Minhas demandas',
      description:
        'Lista as demandas ativas da área do colaborador autenticado — use antes de registrar um apontamento, para escolher um demanda_id válido.',
      inputSchema: {},
    },
    async () => {
      try {
        requireEscopo(sessao, 'apontamento:leitura')
        const perfil = await carregarPerfilMcp(sessao.supabase, sessao.colaboradorId)
        const demandas = await listarDemandasMinhas(sessao.supabase, { areaId: perfil.area_id })
        return textoJson(demandas)
      } catch (err) {
        return erroFerramenta(mensagemDeErro(err, 'Falha ao listar demandas.'))
      }
    }
  )
}
