import { describe, it, expect } from 'vitest'
import { montarAchados, HORA_COBRANCA_APONTAMENTO, type DadosDiagnostico } from './admin-diagnostico'

const limpo: DadosDiagnostico = {
  cartoesSemDemanda: 0,
  quadrosSemEtapaFinal: [],
  quadrosSemMembros: [],
  demandasSemTempoPadrao: [],
  sessoesEstouradas: [],
  sessoesAbertas: 0,
  naoApontaramHoje: [],
  ehDiaUtil: true,
  horaMaringa: 16,
}

const ids = (d: Partial<DadosDiagnostico>) => montarAchados({ ...limpo, ...d }).map((a) => a.id)

describe('montarAchados', () => {
  it('não inventa achado quando está tudo certo', () => {
    expect(montarAchados(limpo)).toEqual([])
  })

  it('acusa cartão sem demanda como alta — é o que fura o índice', () => {
    const [a] = montarAchados({ ...limpo, cartoesSemDemanda: 6 })
    expect(a.id).toBe('cartoes-sem-demanda')
    expect(a.severidade).toBe('alta')
    expect(a.quantidade).toBe(6)
  })

  it('acusa quadro sem etapa final e nomeia o quadro', () => {
    const [a] = montarAchados({ ...limpo, quadrosSemEtapaFinal: ['teste'] })
    expect(a.id).toBe('quadros-sem-etapa-final')
    expect(a.exemplos).toEqual(['teste'])
  })

  it('ordena por gravidade e, dentro dela, pelo tamanho do problema', () => {
    const r = montarAchados({
      ...limpo,
      demandasSemTempoPadrao: ['A', 'B', 'C'], // media, 3
      cartoesSemDemanda: 1, // alta, 1
      quadrosSemEtapaFinal: ['X', 'Y'], // alta, 2
    })
    expect(r.map((a) => a.id)).toEqual([
      'quadros-sem-etapa-final',
      'cartoes-sem-demanda',
      'demandas-sem-tempo',
    ])
  })

  describe('cronômetro esquecido', () => {
    it('acusa sessão que já passou da carga de quem abriu', () => {
      const [a] = montarAchados({
        ...limpo,
        sessoesEstouradas: [{ colaborador: 'Ana', horas: 14.5, cargaHoras: 8 }],
      })
      expect(a.id).toBe('sessoes-estouradas')
      expect(a.severidade).toBe('alta')
      // O exemplo precisa dizer de quem é e quanto já correu, senão o admin
      // não sabe a quem pedir para pausar.
      expect(a.exemplos?.[0]).toContain('Ana')
      expect(a.exemplos?.[0]).toContain('14h')
    })

    it('não acusa quando não há sessão estourada, mesmo com timers rodando', () => {
      expect(ids({ sessoesAbertas: 5 })).toEqual([])
    })
  })

  describe('"ainda não apontou" — a regra que decide se o painel vira ruído', () => {
    it('fica quieto de manhã, quando ainda é normal não ter apontado', () => {
      expect(ids({ naoApontaramHoje: ['Ana', 'Bruno'], horaMaringa: 9 })).toEqual([])
    })

    it('aparece depois da hora de cobrança', () => {
      expect(ids({ naoApontaramHoje: ['Ana'], horaMaringa: HORA_COBRANCA_APONTAMENTO })).toEqual([
        'nao-apontaram',
      ])
    })

    it('fica quieto em fim de semana, mesmo tarde', () => {
      expect(ids({ naoApontaramHoje: ['Ana'], horaMaringa: 20, ehDiaUtil: false })).toEqual([])
    })

    it('entra como informativo, não como alarme', () => {
      const [a] = montarAchados({ ...limpo, naoApontaramHoje: ['Ana'], horaMaringa: 18 })
      expect(a.severidade).toBe('baixa')
    })
  })

  it('trunca a lista de exemplos mas mantém a contagem cheia', () => {
    const [a] = montarAchados({
      ...limpo,
      demandasSemTempoPadrao: ['A', 'B', 'C', 'D', 'E', 'F'],
    })
    expect(a.quantidade).toBe(6)
    expect(a.exemplos).toHaveLength(4)
  })

  // Concatenar sufixo de plural gerava "6 cartãoes" e "12 pessoas ainda não
  // apontou" — passava no tsc e só apareceu rodando contra dados reais.
  it('pluraliza em português correto', () => {
    const t = (d: Partial<DadosDiagnostico>) => montarAchados({ ...limpo, ...d })[0].titulo
    expect(t({ cartoesSemDemanda: 1 })).toBe('1 cartão sem demanda vinculada')
    expect(t({ cartoesSemDemanda: 6 })).toBe('6 cartões sem demanda vinculada')
    expect(t({ naoApontaramHoje: ['A'] })).toBe('1 pessoa ainda não apontou hoje')
    expect(t({ naoApontaramHoje: ['A', 'B'] })).toBe('2 pessoas ainda não apontaram hoje')
    expect(t({ quadrosSemMembros: ['q'] })).toBe('1 quadro ativo sem membros')
    expect(t({ quadrosSemMembros: ['q', 'r'] })).toBe('2 quadros ativos sem membros')
    expect(t({ demandasSemTempoPadrao: ['d'] })).toBe('1 demanda ativa sem tempo padrão')
    expect(t({ sessoesEstouradas: [{ colaborador: 'A', horas: 9, cargaHoras: 8 }] })).toBe(
      '1 cronômetro esquecido rodando'
    )
  })

  it('nenhum título fica com plural concatenado errado', () => {
    const todos = montarAchados({
      cartoesSemDemanda: 2,
      quadrosSemEtapaFinal: ['a', 'b'],
      quadrosSemMembros: ['c', 'd'],
      demandasSemTempoPadrao: ['e', 'f'],
      sessoesEstouradas: [
        { colaborador: 'A', horas: 9, cargaHoras: 8 },
        { colaborador: 'B', horas: 10, cargaHoras: 8 },
      ],
      sessoesAbertas: 2,
      naoApontaramHoje: ['A', 'B'],
      ehDiaUtil: true,
      horaMaringa: 18,
    })
    for (const a of todos) {
      expect(a.titulo).not.toMatch(/ãoe?s\b/) // "cartãoes", "botãoes"
      expect(a.titulo).not.toMatch(/\bativas? ativos?\b/)
    }
  })

  it('todo achado diz a consequência e onde resolver', () => {
    // Um painel que aponta problema sem dizer o que quebra nem o que fazer
    // treina quem olha a ignorá-lo.
    const todos = montarAchados({
      cartoesSemDemanda: 1,
      quadrosSemEtapaFinal: ['q'],
      quadrosSemMembros: ['q2'],
      demandasSemTempoPadrao: ['d'],
      sessoesEstouradas: [{ colaborador: 'Ana', horas: 12, cargaHoras: 8 }],
      sessoesAbertas: 1,
      naoApontaramHoje: ['Ana'],
      ehDiaUtil: true,
      horaMaringa: 18,
    })
    expect(todos).toHaveLength(6)
    for (const a of todos) {
      expect(a.consequencia.length).toBeGreaterThan(20)
      expect(a.comoResolver.length).toBeGreaterThan(20)
    }
  })
})
