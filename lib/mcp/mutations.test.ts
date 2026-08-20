// Escrita MCP sem banco. Cobre o que precisa valer INDEPENDENTE do estado do
// Postgres: a idempotência não pode criar duas linhas, a chave não pode ficar
// queimada quando a regra de negócio recusa, e nenhum caminho de escrita pode
// aceitar um id de outra organização.
//
// A prova com banco real (organização A não escreve em B) vive em
// __tests__/isolamento/mcp-real.integration.test.ts — aqui o mock de
// createAdminClient reproduz só a fronteira, para que estes casos rodem em
// qualquer `npm test`, sem credencial.
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/supabase/admin', () => ({ createAdminClient: vi.fn() }))
// Trilhas e efeitos colaterais têm testes próprios e dependem de rede/e-mail:
// aqui interessa que a escrita principal aconteça (ou não), não o que ela
// dispara depois.
vi.mock('@/lib/auditoria', () => ({ registrarAuditoria: vi.fn(async () => {}) }))
vi.mock('@/lib/automacoes', () => ({ dispararEvento: vi.fn(async () => {}) }))
vi.mock('@/lib/google-calendar', () => ({ agendarSincronizacaoGoogle: vi.fn() }))

import { createAdminClient } from '@/utils/supabase/admin'
import { registrarAuditoria } from '@/lib/auditoria'
import { agendarSincronizacaoGoogle } from '@/lib/google-calendar'
import { agendarSincronizacaoBestEffort, comentarCartaoMcp, criarCartaoMcp, moverCartaoMcp, registrarApontamentoMcp } from '@/lib/mcp/mutations'
import { ErroDeDominioMcp } from '@/lib/mcp/erros'

const IDENTIDADE = { tokenId: 'tok-a', colaboradorId: 'colab-a', organizacaoId: 'org-a' }

type Resposta = { data?: unknown; error?: unknown; count?: number }

type Config = {
  /** Resposta por `${tabela}.${operacao}`, ex.: 'mcp_escritas.insert'. */
  respostas: Record<string, Resposta>
  rpc?: Record<string, Resposta>
}

type Chamada = { tabela: string; operacao: string; filtros: [string, unknown][]; payload?: unknown }

/**
 * Stub encadeável do client Supabase: qualquer método intermediário devolve o
 * próprio builder e os terminais (`single`, `maybeSingle`, `then`) resolvem a
 * resposta configurada. Grava toda chamada para que os testes possam afirmar
 * QUAIS filtros foram aplicados — é o ponto do arquivo: um `.eq` de
 * organizacao_id que suma é o bug que não dá erro.
 */
function criarAdminMock(config: Config) {
  const chamadas: Chamada[] = []
  const rpcs: { nome: string; args: unknown }[] = []

  const from = (tabela: string) => {
    const chamada: Chamada = { tabela, operacao: 'select', filtros: [] }
    chamadas.push(chamada)

    const builder: Record<string, unknown> = {}
    const resolver = () => {
      const r = config.respostas[`${tabela}.${chamada.operacao}`] ?? {}
      return { data: r.data ?? null, error: r.error ?? null, count: r.count ?? 0 }
    }

    for (const metodo of ['insert', 'update', 'delete', 'upsert']) {
      builder[metodo] = (payload: unknown) => {
        chamada.operacao = metodo
        chamada.payload = payload
        return builder
      }
    }
    for (const metodo of ['select', 'order', 'limit', 'in', 'is']) {
      builder[metodo] = () => builder
    }
    builder.eq = (coluna: string, valor: unknown) => {
      chamada.filtros.push([coluna, valor])
      return builder
    }
    builder.single = async () => resolver()
    builder.maybeSingle = async () => resolver()
    // `await` direto no builder (sem terminal), como em `.delete().eq(...)`.
    builder.then = (resolve: (r: ReturnType<typeof resolver>) => unknown) => Promise.resolve(resolve(resolver()))

    return builder
  }

  const rpc = async (nome: string, args: unknown) => {
    rpcs.push({ nome, args })
    const r = config.rpc?.[nome] ?? {}
    return { data: r.data ?? null, error: r.error ?? null }
  }

  return { cliente: { from, rpc } as unknown as ReturnType<typeof createAdminClient>, chamadas, rpcs }
}

function filtrosDe(chamadas: Chamada[], tabela: string, operacao: string) {
  return chamadas.filter((c) => c.tabela === tabela && c.operacao === operacao).map((c) => c.filtros)
}

beforeEach(() => {
  vi.mocked(createAdminClient).mockReset()
  vi.mocked(registrarAuditoria).mockClear()
})

describe('agendarSincronizacaoBestEffort', () => {
  it('fica em silêncio quando after não tem request scope', () => {
    const agendar = vi.mocked(agendarSincronizacaoGoogle)
    agendar.mockImplementationOnce(() => {
      throw new Error('`after` was called outside a request scope.')
    })
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})

    agendarSincronizacaoBestEffort('cartao-1')

    expect(erro).not.toHaveBeenCalled()
    erro.mockRestore()
  })
})

describe('registrarApontamentoMcp', () => {
  const paramsBase = {
    demandaId: 'dem-a',
    quantidade: 1,
    tempoManualMin: null,
    motivo: null,
    observacoes: null,
    chaveIdempotencia: 'chave-fixa-1',
  }

  it('deriva o colaborador da sessão e nunca de parâmetro da tool', async () => {
    const mock = criarAdminMock({
      respostas: { 'mcp_escritas.insert': { data: { id: 'esc-1' } } },
      rpc: {
        registrar_apontamento_para: {
          data: { id: 'ap-1', data: '2026-08-15', demanda_id: 'dem-a', quantidade: 1, tempo_manual_min: null },
        },
      },
    })
    vi.mocked(createAdminClient).mockReturnValue(mock.cliente)

    const { resultado, repetido } = await registrarApontamentoMcp(IDENTIDADE, paramsBase)

    expect(repetido).toBe(false)
    expect(resultado.id).toBe('ap-1')
    expect(mock.rpcs[0]).toMatchObject({
      nome: 'registrar_apontamento_para',
      args: { p_colaborador_id: 'colab-a', p_demanda_id: 'dem-a' },
    })
  })

  it('traduz o código de regra do banco em mensagem que o agente pode agir', async () => {
    const mock = criarAdminMock({
      respostas: { 'mcp_escritas.insert': { data: { id: 'esc-2' } } },
      rpc: { registrar_apontamento_para: { error: { message: 'TEMPO_OBRIGATORIO', code: 'P0001' } } },
    })
    vi.mocked(createAdminClient).mockReturnValue(mock.cliente)

    await expect(registrarApontamentoMcp(IDENTIDADE, paramsBase)).rejects.toThrow(ErroDeDominioMcp)
    await expect(registrarApontamentoMcp(IDENTIDADE, paramsBase)).rejects.toThrow('Informe o tempo gasto')
  })

  it('apaga a reserva quando a regra de negócio recusa, para a chave não ficar queimada', async () => {
    const mock = criarAdminMock({
      respostas: { 'mcp_escritas.insert': { data: { id: 'esc-3' } } },
      rpc: { registrar_apontamento_para: { error: { message: 'DEMANDA_INATIVA', code: 'P0001' } } },
    })
    vi.mocked(createAdminClient).mockReturnValue(mock.cliente)

    await expect(registrarApontamentoMcp(IDENTIDADE, paramsBase)).rejects.toThrow()
    expect(filtrosDe(mock.chamadas, 'mcp_escritas', 'delete')).toEqual([[['id', 'esc-3']]])
    expect(registrarAuditoria).not.toHaveBeenCalled()
  })

  it('chave repetida devolve o resultado da primeira chamada sem escrever de novo', async () => {
    const mock = criarAdminMock({
      respostas: {
        'mcp_escritas.insert': { error: { code: '23505', message: 'duplicate key' } },
        'mcp_escritas.select': { data: { resultado: { id: 'ap-1', quantidade: 1 } } },
      },
    })
    vi.mocked(createAdminClient).mockReturnValue(mock.cliente)

    const { resultado, repetido } = await registrarApontamentoMcp(IDENTIDADE, paramsBase)

    expect(repetido).toBe(true)
    expect(resultado).toEqual({ id: 'ap-1', quantidade: 1 })
    // O ponto todo: nenhuma chamada ao RPC de escrita na repetição.
    expect(mock.rpcs).toEqual([])
    expect(registrarAuditoria).not.toHaveBeenCalled()
  })

  it('recusa quando a primeira chamada com a mesma chave ainda está em andamento', async () => {
    const mock = criarAdminMock({
      respostas: {
        'mcp_escritas.insert': { error: { code: '23505', message: 'duplicate key' } },
        'mcp_escritas.select': { data: { resultado: {} } },
      },
    })
    vi.mocked(createAdminClient).mockReturnValue(mock.cliente)

    await expect(registrarApontamentoMcp(IDENTIDADE, paramsBase)).rejects.toThrow('ainda está em andamento')
    expect(mock.rpcs).toEqual([])
  })
})

describe('escrita no kanban: filtro de organização', () => {
  it('cartao_criar recusa coluna que não é da organização do token', async () => {
    const mock = criarAdminMock({
      respostas: {
        'mcp_escritas.insert': { data: { id: 'esc-4' } },
        // Coluna de outra organização: o filtro por organizacao_id não acha
        // a linha, e a tool responde igual ao caso "não existe".
        'colunas.select': { data: null },
      },
    })
    vi.mocked(createAdminClient).mockReturnValue(mock.cliente)

    await expect(
      criarCartaoMcp(IDENTIDADE, {
        colunaId: 'col-de-outra-org',
        titulo: 'x',
        descricao: null,
        prioridade: 'media',
        prazo: null,
        chaveIdempotencia: 'chave-fixa-2',
      })
    ).rejects.toThrow('Coluna não encontrada')

    expect(filtrosDe(mock.chamadas, 'colunas', 'select')).toEqual([
      [
        ['id', 'col-de-outra-org'],
        ['organizacao_id', 'org-a'],
      ],
    ])
  })

  it('cartao_criar recusa quadro de que o colaborador não participa', async () => {
    const mock = criarAdminMock({
      respostas: {
        'mcp_escritas.insert': { data: { id: 'esc-5' } },
        'colunas.select': { data: { id: 'col-1', nome: 'A Fazer', quadro_id: 'qua-1', etapa_final: false } },
      },
      rpc: { pode_acessar_quadro: { data: false } },
    })
    vi.mocked(createAdminClient).mockReturnValue(mock.cliente)

    await expect(
      criarCartaoMcp(IDENTIDADE, {
        colunaId: 'col-1',
        titulo: 'x',
        descricao: null,
        prioridade: 'media',
        prazo: null,
        chaveIdempotencia: 'chave-fixa-3',
      })
    ).rejects.toThrow('não participa do quadro')

    expect(mock.rpcs[0]).toMatchObject({
      nome: 'pode_acessar_quadro',
      args: { p_quadro_id: 'qua-1', p_colaborador_id: 'colab-a' },
    })
  })

  it('cartao_criar grava o cartão na organização do token e com a pessoa como responsável', async () => {
    const mock = criarAdminMock({
      respostas: {
        'mcp_escritas.insert': { data: { id: 'esc-6' } },
        'colunas.select': { data: { id: 'col-1', nome: 'A Fazer', quadro_id: 'qua-1', etapa_final: false } },
        'cartoes.select': { count: 2 },
        'cartoes.insert': { data: { id: 'car-1', codigo: 'ABC-3', titulo: 'x' } },
        'cartoes_responsaveis.insert': {},
      },
      rpc: { pode_acessar_quadro: { data: true } },
    })
    vi.mocked(createAdminClient).mockReturnValue(mock.cliente)

    const { resultado } = await criarCartaoMcp(IDENTIDADE, {
      colunaId: 'col-1',
      titulo: 'x',
      descricao: null,
      prioridade: 'media',
      prazo: null,
      chaveIdempotencia: 'chave-fixa-4',
    })

    expect(resultado).toMatchObject({ id: 'car-1', codigo: 'ABC-3', quadroId: 'qua-1' })
    expect(mock.chamadas.find((c) => c.tabela === 'cartoes' && c.operacao === 'insert')?.payload).toMatchObject({
      organizacao_id: 'org-a',
      criado_por: 'colab-a',
      posicao: 2,
    })
    expect(mock.chamadas.find((c) => c.tabela === 'cartoes_responsaveis')?.payload).toMatchObject({
      colaborador_id: 'colab-a',
      organizacao_id: 'org-a',
    })
    expect(registrarAuditoria).toHaveBeenCalledWith(
      expect.objectContaining({ acao: 'mcp.cartao.criar', entidadeId: 'car-1' }),
      'org-a'
    )
  })

  it('cartao_mover recusa destino em outro quadro', async () => {
    const colunas = [
      { id: 'col-1', nome: 'A Fazer', quadro_id: 'qua-1', etapa_final: false },
      { id: 'col-9', nome: 'Outro quadro', quadro_id: 'qua-2', etapa_final: false },
    ]
    let vez = 0
    const mock = criarAdminMock({
      respostas: {
        'mcp_escritas.insert': { data: { id: 'esc-7' } },
        'cartoes.select': { data: { id: 'car-1', codigo: 'ABC-1', titulo: 'x', coluna_id: 'col-1' } },
        get 'colunas.select'() {
          return { data: colunas[Math.min(vez++, 1)] }
        },
      },
      rpc: { pode_acessar_quadro: { data: true } },
    })
    vi.mocked(createAdminClient).mockReturnValue(mock.cliente)

    await expect(
      moverCartaoMcp(IDENTIDADE, { cartaoId: 'car-1', colunaDestinoId: 'col-9', chaveIdempotencia: 'chave-fixa-5' })
    ).rejects.toThrow('outro quadro')
  })

  it('cartao_comentar recusa cartão que não é da organização do token', async () => {
    const mock = criarAdminMock({
      respostas: {
        'mcp_escritas.insert': { data: { id: 'esc-8' } },
        'cartoes.select': { data: null },
      },
    })
    vi.mocked(createAdminClient).mockReturnValue(mock.cliente)

    await expect(
      comentarCartaoMcp(IDENTIDADE, { cartaoId: 'car-de-outra-org', conteudo: 'oi', chaveIdempotencia: 'chave-fixa-6' })
    ).rejects.toThrow('Cartão não encontrado')

    expect(filtrosDe(mock.chamadas, 'cartoes', 'select')).toEqual([
      [
        ['id', 'car-de-outra-org'],
        ['organizacao_id', 'org-a'],
      ],
    ])
  })
})
