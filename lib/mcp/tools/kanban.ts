import 'server-only'
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { requireEscopo, type McpSessao } from '@/lib/mcp-auth'
import { detalharCartao, listarCartoesPendentes, listarQuadrosAcessiveis } from '@/lib/mcp/queries'
import { comentarCartaoMcp, criarCartaoMcp, moverCartaoMcp } from '@/lib/mcp/mutations'
import { textoJson, erroFerramenta, mensagemDeErro } from '@/lib/mcp/tool-helpers'
import { chaveIdempotencia } from '@/lib/mcp/tools/idempotencia'
import type { PrioridadeCartao } from '@/lib/database.types'

export function registrarToolsKanban(server: McpServer, sessao: McpSessao) {
  const identidade = { colaboradorId: sessao.colaboradorId, organizacaoId: sessao.organizacaoId }
  const identidadeEscrita = {
    tokenId: sessao.tokenId,
    colaboradorId: sessao.colaboradorId,
    organizacaoId: sessao.organizacaoId,
  }

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
        return textoJson(await listarCartoesPendentes(identidade))
      } catch (err) {
        return erroFerramenta(mensagemDeErro(err, 'Falha ao listar cartões pendentes.'))
      }
    }
  )

  server.registerTool(
    'quadros_listar',
    {
      title: 'Meus quadros',
      description:
        'Lista os quadros de kanban que o colaborador autenticado alcança, com as colunas de cada um em ordem. ' +
        'Use para descobrir o `coluna_id` exigido por cartao_criar e cartao_mover.',
      inputSchema: {},
    },
    async () => {
      try {
        requireEscopo(sessao, 'kanban:leitura')
        return textoJson(await listarQuadrosAcessiveis(identidade))
      } catch (err) {
        return erroFerramenta(mensagemDeErro(err, 'Falha ao listar quadros.'))
      }
    }
  )

  server.registerTool(
    'cartao_detalhe',
    {
      title: 'Detalhe do cartão',
      description: 'Mostra um cartão do kanban: coluna e quadro atuais, prazo, prioridade, responsáveis e se já foi entregue.',
      inputSchema: { cartao_id: z.string().uuid().describe('Id do cartão.') },
    },
    async ({ cartao_id }) => {
      try {
        requireEscopo(sessao, 'kanban:leitura')
        const cartao = await detalharCartao(identidade, cartao_id)
        // Cartão de outra organização e cartão inexistente respondem igual —
        // a diferença revelaria que o id existe em algum lugar.
        if (!cartao) return erroFerramenta('Cartão não encontrado.')
        return textoJson(cartao)
      } catch (err) {
        return erroFerramenta(mensagemDeErro(err, 'Falha ao carregar o cartão.'))
      }
    }
  )

  server.registerTool(
    'cartao_criar',
    {
      title: 'Criar cartão',
      description:
        'Cria um cartão de kanban na coluna informada, tendo o colaborador autenticado como responsável. ' +
        'Use `quadros_listar` antes, para obter o `coluna_id`. Esta ferramenta ESCREVE — confirme título e coluna com a pessoa antes de chamar.',
      inputSchema: {
        coluna_id: z.string().uuid().describe('Id da coluna de destino, obtido em quadros_listar.'),
        titulo: z.string().trim().min(1).max(200).describe('Título do cartão.'),
        descricao: z.string().max(5000).optional().describe('Descrição em texto simples.'),
        // Espelha cartoes_prioridade_check no banco. Um valor a mais aqui
        // viraria erro de constraint no insert, não erro de validação.
        prioridade: z.enum(['baixa', 'media', 'alta']).optional().describe('Padrão: media.'),
        prazo: z.string().date().optional().describe('Prazo (AAAA-MM-DD).'),
        chave_idempotencia: z
          .string()
          .min(8)
          .max(120)
          .optional()
          .describe('Opcional. Repetir com a MESMA chave não cria um segundo cartão.'),
      },
    },
    async ({ coluna_id, titulo, descricao, prioridade, prazo, chave_idempotencia }) => {
      try {
        requireEscopo(sessao, 'kanban:escrita')
        const { resultado, repetido } = await criarCartaoMcp(identidadeEscrita, {
          colunaId: coluna_id,
          titulo,
          descricao: descricao ?? null,
          prioridade: (prioridade ?? 'media') as PrioridadeCartao,
          prazo: prazo ?? null,
          chaveIdempotencia: chaveIdempotencia(chave_idempotencia),
        })
        return textoJson({ cartao: resultado, repetido })
      } catch (err) {
        return erroFerramenta(mensagemDeErro(err, 'Falha ao criar o cartão.'))
      }
    }
  )

  server.registerTool(
    'cartao_mover',
    {
      title: 'Mover cartão',
      description:
        'Move um cartão para outra coluna DO MESMO quadro. As regras do quadro continuam valendo: pré-requisito não entregue, requisito obrigatório em aberto ou limite de WIP da coluna de destino recusam o movimento com a explicação. ' +
        'Esta ferramenta ESCREVE e dispara as automações do quadro — confirme com a pessoa antes de chamar.',
      inputSchema: {
        cartao_id: z.string().uuid().describe('Id do cartão a mover.'),
        coluna_destino_id: z.string().uuid().describe('Id da coluna de destino, no mesmo quadro.'),
        chave_idempotencia: z
          .string()
          .min(8)
          .max(120)
          .optional()
          .describe('Opcional. Repetir com a MESMA chave não move duas vezes.'),
      },
    },
    async ({ cartao_id, coluna_destino_id, chave_idempotencia }) => {
      try {
        requireEscopo(sessao, 'kanban:escrita')
        const { resultado, repetido } = await moverCartaoMcp(identidadeEscrita, {
          cartaoId: cartao_id,
          colunaDestinoId: coluna_destino_id,
          chaveIdempotencia: chaveIdempotencia(chave_idempotencia),
        })
        return textoJson({ cartao: resultado, repetido })
      } catch (err) {
        return erroFerramenta(mensagemDeErro(err, 'Falha ao mover o cartão.'))
      }
    }
  )

  server.registerTool(
    'cartao_comentar',
    {
      title: 'Comentar no cartão',
      description:
        'Publica um comentário no cartão, assinado pelo colaborador autenticado — as pessoas do quadro verão o comentário como dele. ' +
        'Esta ferramenta ESCREVE e o texto fica visível para a equipe: mostre o comentário à pessoa antes de publicar.',
      inputSchema: {
        cartao_id: z.string().uuid().describe('Id do cartão.'),
        conteudo: z.string().trim().min(1).max(5000).describe('Texto do comentário.'),
        chave_idempotencia: z
          .string()
          .min(8)
          .max(120)
          .optional()
          .describe('Opcional. Repetir com a MESMA chave não publica o comentário duas vezes.'),
      },
    },
    async ({ cartao_id, conteudo, chave_idempotencia }) => {
      try {
        requireEscopo(sessao, 'kanban:escrita')
        const { resultado, repetido } = await comentarCartaoMcp(identidadeEscrita, {
          cartaoId: cartao_id,
          conteudo,
          chaveIdempotencia: chaveIdempotencia(chave_idempotencia),
        })
        return textoJson({ comentario: resultado, repetido })
      } catch (err) {
        return erroFerramenta(mensagemDeErro(err, 'Falha ao publicar o comentário.'))
      }
    }
  )
}
