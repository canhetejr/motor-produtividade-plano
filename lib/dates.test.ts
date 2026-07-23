import { describe, it, expect } from 'vitest'
import {
  diasUteisEntre,
  diasUteisAnteriores,
  inicioSemana,
  inicioMes,
  ehDiaUtil,
  formatarDataBR,
  formatarDataCompletaBR,
  saudacao,
} from './dates'

// Datas de referência: 2026-07-22 é quarta-feira (usado nos crons/relatórios
// desta sessão), então 20/07 é segunda e 17/07 é sexta da semana anterior.

describe('diasUteisEntre', () => {
  it('conta dias úteis num intervalo fechado, excluindo fim de semana', () => {
    expect(diasUteisEntre('2026-07-20', '2026-07-24')).toBe(5) // seg a sex
  })

  it('atravessa um fim de semana sem contar sábado/domingo', () => {
    expect(diasUteisEntre('2026-07-17', '2026-07-20')).toBe(2) // sex + seg
  })

  it('retorna 0 se start > end', () => {
    expect(diasUteisEntre('2026-07-24', '2026-07-20')).toBe(0)
  })
})

describe('diasUteisAnteriores', () => {
  it('pula fim de semana ao contar pra trás, em ordem cronológica', () => {
    expect(diasUteisAnteriores(2, '2026-07-20')).toEqual(['2026-07-16', '2026-07-17'])
  })

  it('não inclui o próprio ref', () => {
    expect(diasUteisAnteriores(1, '2026-07-22')).not.toContain('2026-07-22')
  })
})

describe('inicioSemana', () => {
  it('acha a segunda-feira da semana de uma data no meio da semana', () => {
    expect(inicioSemana('2026-07-22')).toBe('2026-07-20')
  })

  it('numa segunda-feira retorna ela mesma', () => {
    expect(inicioSemana('2026-07-20')).toBe('2026-07-20')
  })
})

describe('inicioMes', () => {
  it('acha o dia 1 do mês', () => {
    expect(inicioMes('2026-07-22')).toBe('2026-07-01')
  })
})

describe('ehDiaUtil', () => {
  it('sábado e domingo não são dia útil', () => {
    expect(ehDiaUtil('2026-07-25')).toBe(false)
    expect(ehDiaUtil('2026-07-26')).toBe(false)
  })

  it('segunda a sexta são dia útil', () => {
    expect(ehDiaUtil('2026-07-20')).toBe(true)
    expect(ehDiaUtil('2026-07-24')).toBe(true)
  })
})

describe('formatarDataBR / formatarDataCompletaBR', () => {
  it('formata sem shift de fuso (parseISO de data pura é meia-noite local)', () => {
    expect(formatarDataBR('2026-07-22')).toBe('22/07')
    expect(formatarDataCompletaBR('2026-07-22')).toBe('22/07/2026')
  })
})

describe('saudacao', () => {
  it('bom dia antes do meio-dia', () => {
    expect(saudacao(new Date('2026-07-22T09:00:00-03:00'))).toBe('Bom dia')
  })

  it('boa tarde entre meio-dia e 18h', () => {
    expect(saudacao(new Date('2026-07-22T14:00:00-03:00'))).toBe('Boa tarde')
  })

  it('boa noite a partir das 18h', () => {
    expect(saudacao(new Date('2026-07-22T20:00:00-03:00'))).toBe('Boa noite')
  })
})
