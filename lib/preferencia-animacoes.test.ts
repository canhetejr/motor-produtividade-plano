import { describe, it, expect } from 'vitest'
import { lerPreferencia, deveAnimar, preferenciaPadrao } from './preferencia-animacoes'

describe('preferenciaPadrao', () => {
  it('liga por padrao quando nao ha pedido de menos movimento', () => {
    expect(preferenciaPadrao(false)).toBe('ligado')
  })

  it('desliga por padrao com prefers-reduced-motion', () => {
    // Acessibilidade, nao estetica: para parte das pessoas movimento de fundo
    // causa desconforto real.
    expect(preferenciaPadrao(true)).toBe('desligado')
  })
})

describe('lerPreferencia', () => {
  it('respeita o valor salvo', () => {
    expect(lerPreferencia('desligado', false)).toBe('desligado')
    expect(lerPreferencia('ligado', true)).toBe('ligado')
  })

  it('cai no padrao sem nada salvo', () => {
    expect(lerPreferencia(null, false)).toBe('ligado')
    expect(lerPreferencia(null, true)).toBe('desligado')
  })

  it('cai no padrao com valor invalido', () => {
    // Pode ter sido editado a mao ou gravado por versao anterior.
    expect(lerPreferencia('talvez', false)).toBe('ligado')
    expect(lerPreferencia('', true)).toBe('desligado')
  })
})

describe('deveAnimar', () => {
  it('a escolha explicita vence o prefers-reduced-motion', () => {
    // Quem liga sabendo que o sistema pede menos movimento esta dizendo algo
    // mais especifico que a configuracao geral do sistema.
    expect(deveAnimar('ligado', true)).toBe(true)
    expect(deveAnimar('desligado', false)).toBe(false)
  })

  it('sem escolha, o sistema manda', () => {
    expect(deveAnimar(null, true)).toBe(false)
    expect(deveAnimar(null, false)).toBe(true)
  })
})
