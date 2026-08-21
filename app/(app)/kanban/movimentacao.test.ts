// As Server Actions de mover, reordenar e criar card sem banco.
//
// O que precisa valer INDEPENDENTE do estado do Postgres: a mutação central é
// UMA chamada de RPC (e não uma sequência de updates que pode parar no meio),
// e nenhum efeito externo — automação, Google Agenda — acontece antes de a
// RPC confirmar. A prova com banco de verdade, incluindo as corridas, está em
// __tests__/kanban/movimentacao-atomica.integration.test.ts.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const PERFIL = { id: 'colab-a', organizacao_id: 'org-a', role: 'gestor' as const }

const rpc = vi.fn()
const from = vi.fn()

vi.mock('@/lib/auth', () => ({
  requireUser: vi.fn(async () => ({ user: { id: 'colab-a' }, profile: PERFIL })),
  requireGestor: vi.fn(async () => ({ user: { id: 'colab-a' }, profile: PERFIL })),
  requireAdmin: vi.fn(async () => ({ user: { id: 'colab-a' }, profile: PERFIL })),
}))
vi.mock('@/utils/supabase/server', () => ({ createClient: vi.fn(async () => ({ rpc, from })) }))
vi.mock('@/utils/supabase/admin', () => ({ createAdminClient: vi.fn(() => ({ rpc, from })) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
// Efeitos com testes próprios e dependência de rede: aqui interessa SE eles
// são chamados, não o que fazem.
vi.mock('@/lib/automacoes', () => ({ dispararEvento: vi.fn(async () => {}) }))
vi.mock('@/lib/google-calendar', () => ({
  agendarSincronizacaoGoogle: vi.fn(),
  removerEventosGoogleDoCartao: vi.fn(async () => {}),
}))
vi.mock('@/lib/auditoria', () => ({ registrarAuditoria: vi.fn(async () => {}) }))
vi.mock('@/lib/notifications', () => ({ criarNotificacao: vi.fn(async () => {}) }))

import { dispararEvento } from '@/lib/automacoes'
import { agendarSincronizacaoGoogle } from '@/lib/google-calendar'
import { criarCartao, moverCartao, reordenarColunas } from './actions'

const CARTAO = '11111111-1111-4111-8111-111111111111'
const COLUNA_ORIGEM = '22222222-2222-4222-8222-222222222222'
const COLUNA_DESTINO = '33333333-3333-4333-8333-333333333333'
const QUADRO = '44444444-4444-4444-8444-444444444444'
const OUTRO_CARTAO = '55555555-5555-4555-8555-555555555555'

const MOVIMENTO_OK = {
  movido: true,
  cartaoId: CARTAO,
  codigo: 'VRT-000001',
  titulo: 'Card',
  quadroId: QUADRO,
  colunaOrigemId: COLUNA_ORIGEM,
  colunaOrigemNome: 'A Fazer',
  colunaDestinoId: COLUNA_DESTINO,
  colunaDestinoNome: 'Em Andamento',
  ehSubtarefa: false,
  entregue: false,
}

const ORDENS = [
  { colunaId: COLUNA_DESTINO, cartaoIds: [CARTAO] },
  { colunaId: COLUNA_ORIGEM, cartaoIds: [OUTRO_CARTAO] },
]

beforeEach(() => {
  rpc.mockReset()
  from.mockReset()
  vi.mocked(dispararEvento).mockClear()
  vi.mocked(agendarSincronizacaoGoogle).mockClear()
})

describe('moverCartao', () => {
  it('faz a mutação inteira numa RPC só, sem update de posição por fora', async () => {
    rpc.mockResolvedValue({ data: MOVIMENTO_OK, error: null })

    const resultado = await moverCartao(CARTAO, COLUNA_DESTINO, ORDENS, QUADRO)

    expect(resultado).toEqual({ ok: true })
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('kanban_mover_cartao', {
      p_cartao_id: CARTAO,
      p_coluna_destino_id: COLUNA_DESTINO,
      p_ordens: ORDENS,
    })
    // `from` era o caminho dos N updates paralelos e do comentário de sistema.
    // Os dois agora vivem dentro da transação da RPC.
    expect(from).not.toHaveBeenCalled()
  })

  it('dispara automação e Google só depois de a RPC confirmar', async () => {
    rpc.mockResolvedValue({ data: MOVIMENTO_OK, error: null })

    await moverCartao(CARTAO, COLUNA_DESTINO, ORDENS, QUADRO)

    expect(vi.mocked(dispararEvento).mock.calls.map(([c]) => c.evento)).toEqual([
      'cartao_saiu_etapa',
      'cartao_entrou_etapa',
    ])
    expect(agendarSincronizacaoGoogle).toHaveBeenCalledWith(CARTAO)
  })

  // O caso que motiva o arquivo: automação e evento de agenda não têm
  // desfazer. Se disparassem antes do commit, um WIP estourado deixaria para
  // trás trabalho de um movimento que nunca aconteceu.
  it('não dispara nada quando a RPC recusa, e traduz a regra do banco', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'WIP_EXCEDIDO:3', code: 'P0001' } })

    const resultado = await moverCartao(CARTAO, COLUNA_DESTINO, ORDENS, QUADRO)

    expect(resultado).toEqual({
      ok: false,
      error: 'A coluna de destino já atingiu o limite de 3 cards em andamento.',
    })
    expect(dispararEvento).not.toHaveBeenCalled()
    expect(agendarSincronizacaoGoogle).not.toHaveBeenCalled()
  })

  it('mantém a reordenação dentro da mesma coluna sem efeito externo nenhum', async () => {
    rpc.mockResolvedValue({
      data: { ...MOVIMENTO_OK, movido: false, colunaDestinoId: COLUNA_ORIGEM, colunaDestinoNome: 'A Fazer' },
      error: null,
    })

    const resultado = await moverCartao(CARTAO, COLUNA_ORIGEM, [ORDENS[1]], QUADRO)

    expect(resultado).toEqual({ ok: true })
    expect(dispararEvento).not.toHaveBeenCalled()
    expect(agendarSincronizacaoGoogle).not.toHaveBeenCalled()
  })

  it('recusa ordem malformada antes de chegar ao banco', async () => {
    const resultado = await moverCartao(CARTAO, COLUNA_DESTINO, [
      { colunaId: 'nao-e-uuid', cartaoIds: [CARTAO] },
    ], QUADRO)

    expect(resultado.ok).toBe(false)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('dispara o evento de subtarefa entregue com o estado devolvido pela RPC', async () => {
    rpc.mockResolvedValue({ data: { ...MOVIMENTO_OK, ehSubtarefa: true, entregue: true }, error: null })

    await moverCartao(CARTAO, COLUNA_DESTINO, ORDENS, QUADRO)

    expect(vi.mocked(dispararEvento).mock.calls.map(([c]) => c.evento)).toEqual([
      'subtarefa_saiu_etapa',
      'subtarefa_entrou_etapa',
      'subtarefa_entregue',
    ])
  })
})

describe('reordenarColunas', () => {
  it('manda a lista completa para a RPC, em vez de um update por coluna', async () => {
    rpc.mockResolvedValue({ data: 3, error: null })

    const ordem = [COLUNA_ORIGEM, COLUNA_DESTINO, QUADRO]
    const resultado = await reordenarColunas(QUADRO, ordem)

    expect(resultado).toEqual({ ok: true })
    expect(rpc).toHaveBeenCalledWith('kanban_reordenar_colunas', {
      p_quadro_id: QUADRO,
      p_coluna_ids: ordem,
    })
    expect(from).not.toHaveBeenCalled()
  })

  it('traduz a recusa de coluna fora do quadro', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'COLUNA_INVALIDA:quadro', code: 'P0001' } })

    const resultado = await reordenarColunas(QUADRO, [COLUNA_ORIGEM])

    expect(resultado).toEqual({
      ok: false,
      error: 'A etapa escolhida não existe mais neste quadro. Atualize a página e tente de novo.',
    })
  })
})

describe('criarCartao', () => {
  function formulario(campos: Record<string, string>) {
    const form = new FormData()
    for (const [chave, valor] of Object.entries(campos)) form.append(chave, valor)
    return form
  }

  it('cria card e responsáveis pela mesma RPC', async () => {
    // A validação de responsáveis/demanda continua na action e lê o banco:
    // aqui ela recebe as listas vazias que um card sem responsável produz.
    from.mockReturnValue({
      select: () => ({ eq: () => ({ in: async () => ({ data: [], error: null }) }) }),
    })
    rpc.mockResolvedValue({
      data: {
        id: CARTAO,
        codigo: 'VRT-000010',
        referencia: 'VRT-000010',
        titulo: 'Novo card',
        posicao: 4,
        colunaId: COLUNA_DESTINO,
        colunaNome: 'Em Andamento',
        quadroId: QUADRO,
      },
      error: null,
    })

    const resultado = await criarCartao(COLUNA_DESTINO, QUADRO, formulario({ titulo: 'Novo card' }))

    expect(resultado).toEqual({ ok: true, data: { id: CARTAO } })
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc.mock.calls[0][0]).toBe('kanban_criar_cartao')
    expect(rpc.mock.calls[0][1]).toMatchObject({
      p_quadro_id: QUADRO,
      p_coluna_id: COLUNA_DESTINO,
      p_responsaveis: [],
    })
    expect(rpc.mock.calls[0][1].p_dados).toMatchObject({ titulo: 'Novo card', prioridade: 'media' })
    expect(agendarSincronizacaoGoogle).toHaveBeenCalledWith(CARTAO)
  })

  it('não agenda Google quando a RPC recusa', async () => {
    from.mockReturnValue({
      select: () => ({ eq: () => ({ in: async () => ({ data: [], error: null }) }) }),
    })
    rpc.mockResolvedValue({ data: null, error: { message: 'NAO_AUTORIZADO:quadro', code: 'P0001' } })

    const resultado = await criarCartao(COLUNA_DESTINO, QUADRO, formulario({ titulo: 'Novo card' }))

    expect(resultado).toEqual({ ok: false, error: 'Você não participa deste quadro.' })
    expect(agendarSincronizacaoGoogle).not.toHaveBeenCalled()
  })
})
