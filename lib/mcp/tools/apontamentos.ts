import 'server-only'
import { z } from 'zod'
import { format, subDays } from 'date-fns'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { requireEscopo, type McpSessao } from '@/lib/mcp-auth'
import { carregarPerfilMcp, listarApontamentos, listarDemandasMinhas } from '@/lib/mcp/queries'
import { registrarApontamentoMcp } from '@/lib/mcp/mutations'
import { textoJson, erroFerramenta, mensagemDeErro } from '@/lib/mcp/tool-helpers'
import { chaveIdempotencia } from '@/lib/mcp/tools/idempotencia'
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
        const apontamentos = await listarApontamentos(
          { colaboradorId: sessao.colaboradorId, organizacaoId: sessao.organizacaoId },
          { desde: desdeIso, ate: ateIso }
        )
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
        'Lista as demandas ativas da área do colaborador autenticado — use antes de registrar um apontamento, para descobrir o id da demanda e se ela é variável (exige tempo e motivo).',
      inputSchema: {},
    },
    async () => {
      try {
        requireEscopo(sessao, 'apontamento:leitura')
        const identidade = { colaboradorId: sessao.colaboradorId, organizacaoId: sessao.organizacaoId }
        const perfil = await carregarPerfilMcp(identidade)
        const demandas = await listarDemandasMinhas(identidade, { areaId: perfil.area_id })
        return textoJson(demandas)
      } catch (err) {
        return erroFerramenta(mensagemDeErro(err, 'Falha ao listar demandas.'))
      }
    }
  )

  server.registerTool(
    'apontamento_registrar',
    {
      title: 'Registrar apontamento',
      description:
        'Registra um apontamento de tempo HOJE, em nome do colaborador autenticado. ' +
        'Lançamento retroativo não é possível por aqui: outra data exige o fluxo de correção com aprovação do gestor, na interface do Vértice. ' +
        'Para demanda variável, `tempo_manual_min` e `motivo` são obrigatórios; para as demais, informe apenas a quantidade de blocos. ' +
        'Use `demandas_minhas` antes, para obter o `demanda_id`. Esta ferramenta ESCREVE — confirme os dados com a pessoa antes de chamar.',
      inputSchema: {
        demanda_id: z.string().uuid().describe('Id da demanda, obtido em demandas_minhas.'),
        quantidade: z
          .number()
          .positive()
          .describe('Quantidade de blocos. Aceita fração (0.5) em demandas que trabalham com meio bloco.'),
        tempo_manual_min: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Minutos gastos. Obrigatório em demanda variável ("Outros"); ignorado nas demais.'),
        motivo: z
          .enum(['Reunião', 'Treinamento', 'Suporte a colega', 'Retrabalho', 'Imprevisto', 'Outro'])
          .optional()
          .describe('Obrigatório em demanda variável. Com "Outro", descreva em observacoes.'),
        observacoes: z.string().max(2000).optional().describe('Texto livre; obrigatório quando motivo = "Outro".'),
        chave_idempotencia: z
          .string()
          .min(8)
          .max(120)
          .optional()
          .describe(
            'Opcional. Repetir a chamada com a MESMA chave não cria um segundo apontamento: devolve o resultado da primeira. Use ao reenviar depois de um erro de rede.'
          ),
      },
    },
    async ({ demanda_id, quantidade, tempo_manual_min, motivo, observacoes, chave_idempotencia }) => {
      try {
        requireEscopo(sessao, 'apontamento:escrita')
        const { resultado, repetido } = await registrarApontamentoMcp(
          { tokenId: sessao.tokenId, colaboradorId: sessao.colaboradorId, organizacaoId: sessao.organizacaoId },
          {
            demandaId: demanda_id,
            quantidade,
            tempoManualMin: tempo_manual_min ?? null,
            motivo: motivo ?? null,
            observacoes: observacoes ?? null,
            chaveIdempotencia: chaveIdempotencia(chave_idempotencia),
          }
        )
        return textoJson({ apontamento: resultado, repetido })
      } catch (err) {
        return erroFerramenta(mensagemDeErro(err, 'Falha ao registrar apontamento.'))
      }
    }
  )
}
