import { describe, it, expect, vi, beforeEach } from 'vitest'

// O executor é 'server-only' (vitest.config.ts resolve pro stub vazio) e toca
// e-mail, Google Calendar e leitura de variáveis do card. Nada disso é o que
// está sendo testado aqui: o alvo é o CONTROLE DE FLUXO — quem roda, quem é
// cortado, o que encadeia.
vi.mock('@/lib/google-calendar', () => ({ agendarSincronizacaoGoogle: vi.fn() }))
vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn(async () => ({ sent: true })),
  layoutEmail: (_t: string, corpo: string) => corpo,
}))
vi.mock('@/lib/variaveis-cartao', () => ({ valoresDoCartao: vi.fn(async () => ({})) }))

import { dispararEvento } from './automacoes'
import { PROFUNDIDADE_MAXIMA } from './automacoes-catalogo'

type Acao = { id: string; ordem: number; tipo: string; config: Record<string, unknown> }
type AutomacaoFake = {
  id: string
  nome: string
  quadro_id: string
  evento: string
  evento_config: Record<string, unknown> | null
  ativa: boolean
  posicao: number
  automacoes_acoes: Acao[]
}
type Execucao = { automacao_id: string; cartao_id: string; status: string; erro: string | null; executado_em: string }

type Estado = {
  automacoes: AutomacaoFake[]
  cartoes: Record<string, Record<string, unknown>>
  colunas: Record<string, Record<string, unknown>>
  execucoes: Execucao[]
  /** Toda troca de coluna aplicada — é como se observa o encadeamento. */
  movimentos: { cartaoId: string; para: string }[]
}

/**
 * Supabase falso que APLICA os updates. Um mock que só devolve `{ error: null }`
 * não serviria: sem o card mudando de coluna de verdade, um ciclo A→B→A nunca
 * se fecharia e o teste de loop passaria por acidente.
 */
function criarSupabaseFake(estado: Estado) {
  let relogio = 0
  const agora = () => new Date(Date.UTC(2026, 7, 18, 12, 0, relogio++)).toISOString()

  function from(tabela: string) {
    const filtros: Record<string, unknown> = {}
    let op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select'
    let payload: Record<string, unknown> | null = null
    let contando = false

    const resolver = (unico: boolean): Promise<{ data: unknown; error: null; count?: number }> => {
      if (op === 'insert' && tabela === 'automacoes_execucoes') {
        const p = payload as unknown as Omit<Execucao, 'executado_em'>
        estado.execucoes.push({ ...p, executado_em: agora() })
        return Promise.resolve({ data: null, error: null })
      }
      if (op === 'insert' || op === 'upsert' || op === 'delete') {
        return Promise.resolve({ data: null, error: null })
      }

      if (op === 'update' && tabela === 'cartoes') {
        const id = filtros.id as string
        const antes = estado.cartoes[id]
        Object.assign(antes, payload)
        if (payload && 'coluna_id' in payload) {
          estado.movimentos.push({ cartaoId: id, para: payload.coluna_id as string })
        }
        return Promise.resolve({ data: null, error: null })
      }
      if (op === 'update') return Promise.resolve({ data: null, error: null })

      // --- selects ---
      if (tabela === 'automacoes') {
        const linhas = estado.automacoes
          .filter((a) => a.quadro_id === filtros.quadro_id && a.evento === filtros.evento && a.ativa === filtros.ativa)
          .sort((a, b) => a.posicao - b.posicao)
        return Promise.resolve({ data: linhas, error: null })
      }
      if (tabela === 'automacoes_execucoes') {
        const ids = (filtros.automacao_id__in ?? []) as string[]
        const desde = filtros.executado_em__gte as string | undefined
        const linhas = estado.execucoes.filter(
          (e) =>
            ids.includes(e.automacao_id) &&
            e.cartao_id === filtros.cartao_id &&
            e.status === filtros.status &&
            (!desde || e.executado_em >= desde)
        )
        return Promise.resolve({ data: linhas, error: null })
      }
      if (tabela === 'cartoes') {
        if (contando) return Promise.resolve({ data: null, error: null, count: 0 })
        const linha = estado.cartoes[filtros.id as string] ?? null
        return Promise.resolve({ data: unico ? linha : [linha], error: null })
      }
      if (tabela === 'colunas') {
        const linha = estado.colunas[filtros.id as string] ?? null
        return Promise.resolve({ data: unico ? linha : [linha], error: null })
      }
      if (tabela === 'organizacoes') {
        return Promise.resolve({ data: { email_remetente_nome: null }, error: null })
      }
      return Promise.resolve({ data: unico ? null : [], error: null })
    }

    const q = {
      select: (_c?: string, opts?: { count?: string; head?: boolean }) => {
        op = 'select'
        contando = !!opts?.count
        return q
      },
      insert: (p: Record<string, unknown>) => ((op = 'insert'), (payload = p), q),
      update: (p: Record<string, unknown>) => ((op = 'update'), (payload = p), q),
      upsert: (p: Record<string, unknown>) => ((op = 'upsert'), (payload = p), q),
      delete: () => ((op = 'delete'), q),
      eq: (c: string, v: unknown) => ((filtros[c] = v), q),
      in: (c: string, v: unknown[]) => ((filtros[`${c}__in`] = v), q),
      gte: (c: string, v: unknown) => ((filtros[`${c}__gte`] = v), q),
      is: (c: string, v: unknown) => ((filtros[`${c}__is`] = v), q),
      order: () => q,
      single: () => resolver(true),
      maybeSingle: () => resolver(true),
      then: (ok: (r: unknown) => unknown, falha?: (e: unknown) => unknown) => resolver(false).then(ok, falha),
    }
    return q
  }

  return { from } as unknown as Parameters<typeof dispararEvento>[0]['supabase']
}

function automacao(over: Partial<AutomacaoFake> & { id: string; evento: string; automacoes_acoes: Acao[] }): AutomacaoFake {
  return {
    nome: over.id,
    quadro_id: 'q1',
    evento_config: {},
    ativa: true,
    posicao: 0,
    ...over,
  }
}

const acao = (tipo: string, config: Record<string, unknown> = {}): Acao => ({ id: `a-${tipo}`, ordem: 0, tipo, config })

let estado: Estado

beforeEach(() => {
  estado = {
    automacoes: [],
    cartoes: { c1: { id: 'c1', coluna_id: 'colA', cartao_pai_id: null, demanda_id: null } },
    colunas: {
      colA: { id: 'colA', nome: 'A', quadro_id: 'q1', etapa_final: false },
      colB: { id: 'colB', nome: 'B', quadro_id: 'q1', etapa_final: false },
      colFinal: { id: 'colFinal', nome: 'Entregue', quadro_id: 'q1', etapa_final: true },
    },
    execucoes: [],
    movimentos: [],
  }
})

const base = () => ({
  supabase: criarSupabaseFake(estado),
  cartaoId: 'c1',
  quadroId: 'q1',
  atorId: 'u1',
  organizacaoId: 'org1',
})

describe('executor de automações — controle de fluxo', () => {
  describe('trava anti-loop', () => {
    it('corta o ciclo A→B→A na repetição, sem esgotar a profundidade', async () => {
      // Duas automações que se devolvem: entrar em B manda pra A, entrar em A
      // manda pra B. Sem corte por ciclo, isso só pararia no teto de
      // profundidade — depois de mover o card várias vezes à toa.
      estado.automacoes = [
        automacao({ id: 'A', evento: 'cartao_entrou_etapa', evento_config: { colunaId: 'colA' }, automacoes_acoes: [acao('mover_cartao', { colunaId: 'colB' })] }),
        automacao({ id: 'B', evento: 'cartao_entrou_etapa', evento_config: { colunaId: 'colB' }, automacoes_acoes: [acao('mover_cartao', { colunaId: 'colA' })] }),
      ]

      await dispararEvento({ ...base(), evento: 'cartao_entrou_etapa', dados: { colunaId: 'colA' } })

      const cortadas = estado.execucoes.filter((e) => e.status === 'cortado')
      expect(cortadas.length).toBeGreaterThan(0)
      expect(cortadas[0].erro).toMatch(/ciclo/i)
      // O ciclo fecha na 3ª tentativa de mover (A→B, B→A, e aí A repetiria):
      // o corte por ciclo chega antes do teto de profundidade.
      expect(estado.movimentos.length).toBeLessThanOrEqual(PROFUNDIDADE_MAXIMA)
    })

    it('automação que dispara a si mesma roda uma vez só', async () => {
      // "Ao entrar em qualquer etapa, mova para B" — ao mover pra B, o próprio
      // evento de entrada volta a casar com ela.
      estado.automacoes = [
        automacao({ id: 'A', evento: 'cartao_entrou_etapa', automacoes_acoes: [acao('mover_cartao', { colunaId: 'colB' })] }),
      ]

      await dispararEvento({ ...base(), evento: 'cartao_entrou_etapa', dados: { colunaId: 'colA' } })

      expect(estado.movimentos).toEqual([{ cartaoId: 'c1', para: 'colB' }])
      expect(estado.execucoes.filter((e) => e.status === 'ok')).toHaveLength(1)
      expect(estado.execucoes.some((e) => e.status === 'cortado' && /ciclo/i.test(e.erro ?? ''))).toBe(true)
    })

    it('automações irmãs no mesmo evento não bloqueiam uma à outra', async () => {
      // A cadeia é por CAMINHO. Duas automações que respondem ao mesmo evento
      // rodam as duas — só a repetição dentro de um mesmo encadeamento é ciclo.
      estado.automacoes = [
        automacao({ id: 'A', posicao: 0, evento: 'cartao_aprovado', automacoes_acoes: [acao('marcar_urgente')] }),
        automacao({ id: 'B', posicao: 1, evento: 'cartao_aprovado', automacoes_acoes: [acao('marcar_urgente')] }),
      ]

      await dispararEvento({ ...base(), evento: 'cartao_aprovado' })

      expect(estado.execucoes.filter((e) => e.status === 'ok').map((e) => e.automacao_id)).toEqual(['A', 'B'])
    })
  })

  describe('encadeamento de mover_cartao', () => {
    it('não propaga o dedupe do cron para o evento encadeado', async () => {
      // Regressão: o cron dispara "sla_estourado" com âncora de dedupe; a ação
      // move o card. O "entrou na etapa" que nasce daí É pontual — herdar a
      // âncora fazia a automação de entrada ser pulada em silêncio se ela já
      // tivesse rodado para este card desde a âncora.
      estado.automacoes = [
        automacao({ id: 'SLA', evento: 'sla_estourado', automacoes_acoes: [acao('mover_cartao', { colunaId: 'colB' })] }),
        automacao({ id: 'ENTRADA', evento: 'cartao_entrou_etapa', evento_config: { colunaId: 'colB' }, automacoes_acoes: [acao('marcar_urgente')] }),
      ]
      // ENTRADA já rodou com sucesso depois da âncora.
      estado.execucoes.push({
        automacao_id: 'ENTRADA',
        cartao_id: 'c1',
        status: 'ok',
        erro: null,
        executado_em: new Date(Date.UTC(2026, 7, 18, 11, 0, 0)).toISOString(),
      })

      await dispararEvento({
        ...base(),
        evento: 'sla_estourado',
        dados: { colunaId: 'colA' },
        dedupeDesde: new Date(Date.UTC(2026, 7, 18, 10, 0, 0)).toISOString(),
      })

      const okDeEntrada = estado.execucoes.filter((e) => e.automacao_id === 'ENTRADA' && e.status === 'ok')
      expect(okDeEntrada.length).toBe(2) // a antiga + a desta cadeia
    })

    it('o dedupe ainda vale para o evento do cron em si', async () => {
      estado.automacoes = [
        automacao({ id: 'SLA', evento: 'sla_estourado', automacoes_acoes: [acao('marcar_urgente')] }),
      ]
      estado.execucoes.push({
        automacao_id: 'SLA',
        cartao_id: 'c1',
        status: 'ok',
        erro: null,
        executado_em: new Date(Date.UTC(2026, 7, 18, 11, 0, 0)).toISOString(),
      })

      await dispararEvento({
        ...base(),
        evento: 'sla_estourado',
        dedupeDesde: new Date(Date.UTC(2026, 7, 18, 10, 0, 0)).toISOString(),
      })

      // Nenhuma execução nova: a varredura seguinte do cron não redispara.
      expect(estado.execucoes).toHaveLength(1)
    })

    it('mover uma subtarefa dispara os eventos de subtarefa, não os de card', async () => {
      estado.cartoes.c1.cartao_pai_id = 'pai1'
      estado.automacoes = [
        automacao({ id: 'MOVE', evento: 'cartao_aprovado', automacoes_acoes: [acao('mover_cartao', { colunaId: 'colB' })] }),
        automacao({ id: 'SUB', evento: 'subtarefa_entrou_etapa', evento_config: { colunaId: 'colB' }, automacoes_acoes: [acao('marcar_urgente')] }),
        automacao({ id: 'CARD', evento: 'cartao_entrou_etapa', evento_config: { colunaId: 'colB' }, automacoes_acoes: [acao('marcar_urgente')] }),
      ]

      await dispararEvento({ ...base(), evento: 'cartao_aprovado' })

      const rodaram = estado.execucoes.filter((e) => e.status === 'ok').map((e) => e.automacao_id)
      expect(rodaram).toContain('SUB')
      expect(rodaram).not.toContain('CARD')
    })

    it('mover subtarefa para etapa final dispara "subtarefa entregue"', async () => {
      estado.cartoes.c1.cartao_pai_id = 'pai1'
      estado.automacoes = [
        automacao({ id: 'MOVE', evento: 'cartao_aprovado', automacoes_acoes: [acao('mover_cartao', { colunaId: 'colFinal' })] }),
        automacao({ id: 'ENTREGUE', evento: 'subtarefa_entregue', automacoes_acoes: [acao('marcar_urgente')] }),
      ]

      await dispararEvento({ ...base(), evento: 'cartao_aprovado' })

      expect(estado.execucoes.filter((e) => e.status === 'ok').map((e) => e.automacao_id)).toContain('ENTREGUE')
    })

    it('mover para a etapa em que o card já está é no-op', async () => {
      estado.automacoes = [
        automacao({ id: 'MOVE', evento: 'cartao_aprovado', automacoes_acoes: [acao('mover_cartao', { colunaId: 'colA' })] }),
      ]

      await dispararEvento({ ...base(), evento: 'cartao_aprovado' })

      expect(estado.movimentos).toHaveLength(0)
      expect(estado.execucoes.filter((e) => e.status === 'ok')).toHaveLength(1)
    })
  })

  describe('isolamento de falha', () => {
    it('ação mal configurada vira execução com erro legível, sem derrubar o resto', async () => {
      estado.automacoes = [
        automacao({ id: 'QUEBRADA', posicao: 0, evento: 'cartao_aprovado', automacoes_acoes: [acao('mover_cartao', {})] }),
        automacao({ id: 'BOA', posicao: 1, evento: 'cartao_aprovado', automacoes_acoes: [acao('marcar_urgente')] }),
      ]

      await dispararEvento({ ...base(), evento: 'cartao_aprovado' })

      const quebrada = estado.execucoes.find((e) => e.automacao_id === 'QUEBRADA')!
      expect(quebrada.status).toBe('erro')
      expect(quebrada.erro).toMatch(/destino/i)
      // Uma automação quebrada não pode calar as outras do quadro.
      expect(estado.execucoes.find((e) => e.automacao_id === 'BOA')?.status).toBe('ok')
    })

    it('dispararEvento nunca propaga exceção para quem causou o evento', async () => {
      // A ação do usuário já aconteceu; automação é conveniência e não pode
      // desfazê-la. Aqui o próprio client falha ao carregar as automações.
      const supabaseQuebrado = {
        from: () => {
          throw new Error('conexão caiu')
        },
      } as unknown as Parameters<typeof dispararEvento>[0]['supabase']

      await expect(
        dispararEvento({ ...base(), supabase: supabaseQuebrado, evento: 'cartao_aprovado' })
      ).resolves.toBeUndefined()
    })
  })
})
