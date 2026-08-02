import { describe, it, expect } from 'vitest'
import { diasAte, faixaDe, agruparPorFaixa, hojeEmSaoPaulo } from './semana'

describe('diasAte', () => {
  it('conta zero no próprio dia', () => {
    expect(diasAte('2026-08-02', '2026-08-02')).toBe(0)
  })

  it('atravessa a virada de mês', () => {
    expect(diasAte('2026-09-01', '2026-08-31')).toBe(1)
    expect(diasAte('2026-08-31', '2026-09-01')).toBe(-1)
  })

  it('atravessa a virada de ano', () => {
    expect(diasAte('2027-01-01', '2026-12-31')).toBe(1)
  })

  it('lida com ano bissexto', () => {
    expect(diasAte('2028-03-01', '2028-02-28')).toBe(2)
  })

  it('não erra por um dia na virada do horário de verão', () => {
    // O Brasil não tem mais horário de verão, mas o cálculo é em UTC justamente
    // para não depender disso: 20/10 a 21/10 é sempre 1 dia.
    expect(diasAte('2026-10-21', '2026-10-20')).toBe(1)
  })
})

describe('faixaDe', () => {
  const hoje = '2026-08-02'

  it('classifica cada faixa pela borda', () => {
    expect(faixaDe('2026-08-01', hoje)).toBe('atrasado')
    expect(faixaDe('2026-08-02', hoje)).toBe('hoje')
    expect(faixaDe('2026-08-03', hoje)).toBe('amanha')
    expect(faixaDe('2026-08-09', hoje)).toBe('esta_semana') // exatamente 7 dias
    expect(faixaDe('2026-08-10', hoje)).toBe('depois') // 8 dias
  })
})

describe('agruparPorFaixa', () => {
  const hoje = '2026-08-02'
  const cartoes = [
    { id: 'a', prazo: '2026-07-30' },
    { id: 'b', prazo: '2026-08-02' },
    { id: 'c', prazo: '2026-08-02' },
    { id: 'd', prazo: '2026-12-01' },
  ]

  it('devolve as faixas na ordem de urgência', () => {
    const faixas = agruparPorFaixa(cartoes, hoje)
    expect(faixas.map((f) => f.chave)).toEqual(['atrasado', 'hoje', 'depois'])
  })

  it('omite faixa vazia em vez de criar seção sem conteúdo', () => {
    const faixas = agruparPorFaixa(cartoes, hoje)
    expect(faixas.some((f) => f.chave === 'amanha')).toBe(false)
  })

  it('não perde nem duplica cartão', () => {
    const faixas = agruparPorFaixa(cartoes, hoje)
    const ids = faixas.flatMap((f) => f.cartoes.map((c) => c.id)).sort()
    expect(ids).toEqual(['a', 'b', 'c', 'd'])
  })

  it('devolve lista vazia sem cartão nenhum', () => {
    expect(agruparPorFaixa([], hoje)).toEqual([])
  })
})

describe('hojeEmSaoPaulo', () => {
  it('usa o fuso de São Paulo, e não o UTC', () => {
    // 03:00 UTC de 3 de agosto ainda é 2 de agosto em São Paulo (UTC-3).
    expect(hojeEmSaoPaulo(new Date('2026-08-03T02:00:00Z'))).toBe('2026-08-02')
  })

  it('devolve no formato YYYY-MM-DD', () => {
    expect(hojeEmSaoPaulo(new Date('2026-08-02T15:00:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
