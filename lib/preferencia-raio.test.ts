import { describe, expect, it } from 'vitest'
import { lerPreferenciaRaio } from './preferencia-raio'

describe('lerPreferenciaRaio', () => {
  it('aceita a preferência arredondada salva', () => {
    expect(lerPreferenciaRaio('arredondado')).toBe('arredondado')
  })

  it('usa cantos retos como padrão e para valores inválidos', () => {
    expect(lerPreferenciaRaio(null)).toBe('reto')
    expect(lerPreferenciaRaio('qualquer')).toBe('reto')
  })
})
