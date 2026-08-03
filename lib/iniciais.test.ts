import { describe, it, expect } from 'vitest'
import { iniciaisDe } from './iniciais'

describe('iniciaisDe', () => {
  it('usa primeira e ultima palavra', () => {
    // O sobrenome distingue mais que o nome do meio.
    expect(iniciaisDe('Ana Paula da Silva')).toBe('AS')
    expect(iniciaisDe('Luiz Canhete')).toBe('LC')
  })

  it('usa duas letras quando ha uma palavra so', () => {
    expect(iniciaisDe('Madonna')).toBe('MA')
  })

  it('tolera espaco duplicado e nas pontas', () => {
    // A versao reescrita a mao quebrava aqui: split(' ') gera string vazia e
    // n[0] vira undefined.
    expect(iniciaisDe('  Ana   Silva  ')).toBe('AS')
  })

  it('nao quebra com nome ausente ou vazio', () => {
    expect(iniciaisDe(null)).toBe('?')
    expect(iniciaisDe(undefined)).toBe('?')
    expect(iniciaisDe('')).toBe('?')
    expect(iniciaisDe('   ')).toBe('?')
  })

  it('devolve maiuscula mesmo com entrada minuscula', () => {
    expect(iniciaisDe('ana silva')).toBe('AS')
  })

  it('preserva acento', () => {
    expect(iniciaisDe('Ávila Ângelo')).toBe('ÁÂ')
  })

  it('lida com uma letra so', () => {
    expect(iniciaisDe('A')).toBe('A')
  })
})
