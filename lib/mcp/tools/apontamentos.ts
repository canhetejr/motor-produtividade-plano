import 'server-only'
import { z } from 'zod'
import { format, subDays } from 'date-fns'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { requireEscopo, type McpSessao } from '@/lib/mcp-auth'
import { carregarPerfilMcp, listarApontamentos, listarDemandasMinhas } from '@/lib/mcp/queries'
import { textoJson, erroFerramenta, mensagemDeErro } from '@/lib/mcp/tool-helpers'
import { hoje } from '@/lib/dates'
import { apontamentoSchema } from '@/lib/apontamento-schema'
import { registrarApontamentoCore } from '@/app/(app)/apontamento/actions'

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
    'apontamento_registrar',
    {
      title: 'Registrar apontamento',
      description:
        'Registra um apontamento de tempo para o colaborador autenticado numa demanda. Use a tool demandas_minhas (ou o resource vertice://demandas/minhas) antes, para obter um demanda_id válido.',
      inputSchema: {
        demanda_id: z.string().uuid().describe('UUID da demanda.'),
        quantidade: z.number().positive().describe('Quantidade lançada. Em demandas de bloco, pode ser fracionária (ex.: 0.5).'),
        tempo_manual_min: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Minutos manuais — só se aplica a demandas variáveis/"Outros".'),
        motivo: z.string().optional().describe('Motivo do lançamento, quando a demanda é "Outros".'),
        observacoes: z.string().max(2000).optional(),
      },
    },
    async ({ demanda_id, quantidade, tempo_manual_min, motivo, observacoes }) => {
      try {
        requireEscopo(sessao, 'apontamento:escrita')

        // Mesma validação de app/(app)/apontamento/actions.ts::createApontamento
        // (motivo/observações viram null quando vazios, tempo_manual_min passa
        // por parseTempo) — reaproveitada em vez de reimplementada, para que
        // as duas portas de entrada apliquem exatamente a mesma regra.
        const parsed = apontamentoSchema.safeParse({
          demanda_id,
          quantidade,
          tempo_manual_min: tempo_manual_min ?? null,
          motivo,
          observacoes,
        })
        if (!parsed.success) return erroFerramenta(parsed.error.issues[0].message)

        const perfil = await carregarPerfilMcp(sessao.supabase, sessao.colaboradorId)
        const resultado = await registrarApontamentoCore(sessao.supabase, { userId: sessao.colaboradorId, profile: perfil }, parsed.data)
        if (!resultado.ok) return erroFerramenta(resultado.error)
        return textoJson({ sucesso: true, mensagem: 'Apontamento registrado.' })
      } catch (err) {
        return erroFerramenta(mensagemDeErro(err, 'Falha ao registrar apontamento.'))
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
