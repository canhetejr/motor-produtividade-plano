import { describe, it, expect } from 'vitest'
import { sanitizeFormula, escapeCsv } from './csv'

describe('sanitizeFormula', () => {
  it.each(['=SOMA(A1:A2)', '+1+1', '-1+1', '@SUM(1)'])(
    'prefixa apóstrofo quando o valor começa com %s',
    (input) => {
      expect(sanitizeFormula(input)).toBe(`'${input}`)
    }
  )

  it('não mexe em texto sem caractere de fórmula', () => {
    expect(sanitizeFormula('Reunião de equipe')).toBe('Reunião de equipe')
  })

  it('trata null/undefined como string vazia', () => {
    expect(sanitizeFormula(null)).toBe('')
    expect(sanitizeFormula(undefined)).toBe('')
  })
})

describe('escapeCsv', () => {
  it('coloca em aspas campo com vírgula', () => {
    expect(escapeCsv('a,b')).toBe('"a,b"')
  })

  it('escapa aspas internas duplicando', () => {
    expect(escapeCsv('disse "oi"')).toBe('"disse ""oi"""')
  })

  it('coloca em aspas campo com quebra de linha', () => {
    expect(escapeCsv('linha1\nlinha2')).toBe('"linha1\nlinha2"')
  })

  it('não mexe em texto sem caractere especial', () => {
    expect(escapeCsv('texto simples')).toBe('texto simples')
  })
})
