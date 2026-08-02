import { describe, it, expect } from 'vitest'
import {
  decorrido,
  iniciar,
  pausar,
  estaRodando,
  formatarRelogio,
  paraMinutos,
  lerEstado,
  PARADO,
} from './cronometro'

const T0 = 1_700_000_000_000

describe('decorrido', () => {
  it('vale zero parado e sem acúmulo', () => {
    expect(decorrido(PARADO, T0)).toBe(0)
  })

  it('conta o trecho em andamento', () => {
    expect(decorrido({ iniciadoEm: T0, acumulado: 0 }, T0 + 90_000)).toBe(90)
  })

  it('soma o acumulado ao trecho em andamento', () => {
    expect(decorrido({ iniciadoEm: T0, acumulado: 100 }, T0 + 50_000)).toBe(150)
  })

  it('devolve só o acumulado quando pausado', () => {
    expect(decorrido({ iniciadoEm: null, acumulado: 42 }, T0 + 999_999)).toBe(42)
  })

  it('não devolve tempo negativo se o relógio andar para trás', () => {
    // Ajuste de NTP, troca de fuso, ou o usuário mexendo na data do aparelho.
    expect(decorrido({ iniciadoEm: T0, acumulado: 10 }, T0 - 60_000)).toBe(10)
  })
})

describe('iniciar e pausar', () => {
  it('inicia parado e passa a rodar', () => {
    const e = iniciar(PARADO, T0)
    expect(estaRodando(e)).toBe(true)
  })

  it('iniciar de novo não reinicia a contagem', () => {
    // Dois cliques rápidos no play não podem zerar o que já correu.
    const e = iniciar({ iniciadoEm: T0, acumulado: 30 }, T0 + 10_000)
    expect(e.iniciadoEm).toBe(T0)
    expect(e.acumulado).toBe(30)
  })

  it('pausar move o decorrido para o acumulado', () => {
    const e = pausar({ iniciadoEm: T0, acumulado: 10 }, T0 + 20_000)
    expect(e).toEqual({ iniciadoEm: null, acumulado: 30 })
  })

  it('pausar já pausado não muda nada', () => {
    const parado = { iniciadoEm: null, acumulado: 30 }
    expect(pausar(parado, T0 + 99_999)).toEqual(parado)
  })

  it('ciclo iniciar-pausar-iniciar preserva o total', () => {
    let e = iniciar(PARADO, T0)
    e = pausar(e, T0 + 60_000) // 60s
    e = iniciar(e, T0 + 600_000) // retomou muito depois
    // O intervalo pausado não conta.
    expect(decorrido(e, T0 + 630_000)).toBe(90)
  })
})

describe('formatarRelogio', () => {
  it('formata com dois dígitos em cada campo', () => {
    expect(formatarRelogio(0)).toBe('00:00:00')
    expect(formatarRelogio(65)).toBe('00:01:05')
    expect(formatarRelogio(3661)).toBe('01:01:01')
  })

  it('passa de 24 horas sem estourar', () => {
    expect(formatarRelogio(90_000)).toBe('25:00:00')
  })
})

describe('paraMinutos', () => {
  it('arredonda para o minuto mais próximo', () => {
    expect(paraMinutos(90)).toBe(2)
    expect(paraMinutos(89)).toBe(1)
  })

  it('nunca devolve zero quando houve contagem', () => {
    // Registrar "0 min" de trabalho feito é pior que registrar 1.
    expect(paraMinutos(5)).toBe(1)
    expect(paraMinutos(29)).toBe(1)
  })

  it('devolve zero só quando não houve contagem', () => {
    expect(paraMinutos(0)).toBe(0)
  })
})

describe('lerEstado', () => {
  it('devolve parado sem nada salvo', () => {
    expect(lerEstado(null)).toEqual(PARADO)
  })

  it('não quebra com JSON inválido', () => {
    expect(lerEstado('{quebrado')).toEqual(PARADO)
  })

  it('descarta acumulado negativo', () => {
    expect(lerEstado('{"iniciadoEm":null,"acumulado":-5}')).toEqual(PARADO)
  })

  it('descarta iniciadoEm que não é instante válido', () => {
    expect(lerEstado('{"iniciadoEm":"ontem","acumulado":10}')).toEqual({
      iniciadoEm: null,
      acumulado: 10,
    })
  })

  it('preserva um estado válido', () => {
    expect(lerEstado(JSON.stringify({ iniciadoEm: T0, acumulado: 7 }))).toEqual({
      iniciadoEm: T0,
      acumulado: 7,
    })
  })
})
