import { describe, it, expect } from 'vitest'
import {
  tamanhoEmDias,
  janelaAnterior,
  comparavel,
  variacao,
  formatarVariacao,
} from './comparativo'

describe('tamanhoEmDias', () => {
  it('conta as duas pontas', () => {
    // 10 a 16 é uma semana: sete dias, não seis.
    expect(tamanhoEmDias({ inicio: '2026-08-10', fim: '2026-08-16' })).toBe(7)
  })

  it('vale 1 para um único dia', () => {
    expect(tamanhoEmDias({ inicio: '2026-08-10', fim: '2026-08-10' })).toBe(1)
  })

  it('atravessa a virada de mês', () => {
    expect(tamanhoEmDias({ inicio: '2026-08-30', fim: '2026-09-02' })).toBe(4)
  })
})

describe('janelaAnterior', () => {
  it('é contígua, sem sobreposição nem buraco', () => {
    const anterior = janelaAnterior({ inicio: '2026-08-10', fim: '2026-08-16' })
    expect(anterior).toEqual({ inicio: '2026-08-03', fim: '2026-08-09' })
  })

  it('preserva o tamanho da janela', () => {
    const atual = { inicio: '2026-08-01', fim: '2026-08-31' }
    expect(tamanhoEmDias(janelaAnterior(atual))).toBe(tamanhoEmDias(atual))
  })

  it('atravessa a virada de ano', () => {
    const anterior = janelaAnterior({ inicio: '2027-01-01', fim: '2027-01-07' })
    expect(anterior).toEqual({ inicio: '2026-12-25', fim: '2026-12-31' })
  })

  it('atravessa fevereiro em ano bissexto', () => {
    const anterior = janelaAnterior({ inicio: '2028-03-01', fim: '2028-03-02' })
    expect(anterior).toEqual({ inicio: '2028-02-28', fim: '2028-02-29' })
  })
})

describe('comparavel', () => {
  it('aceita janela inteiramente dentro do dado carregado', () => {
    expect(comparavel({ inicio: '2026-07-01', fim: '2026-07-31' }, '2026-02-01')).toBe(true)
  })

  it('recusa janela que começa antes do dado disponível', () => {
    // Comparar os últimos 180 dias exigiria 360 — a queda apareceria como
    // resultado, quando é só falta de registro.
    expect(comparavel({ inicio: '2026-01-01', fim: '2026-06-30' }, '2026-02-01')).toBe(false)
  })

  it('aceita quando começa exatamente no primeiro dia disponível', () => {
    expect(comparavel({ inicio: '2026-02-01', fim: '2026-03-01' }, '2026-02-01')).toBe(true)
  })
})

describe('variacao', () => {
  it('calcula alta e queda', () => {
    expect(variacao(120, 100)).toBeCloseTo(0.2)
    expect(variacao(80, 100)).toBeCloseTo(-0.2)
  })

  it('vale zero quando não mudou', () => {
    expect(variacao(100, 100)).toBe(0)
  })

  it('devolve null quando não há base de comparação', () => {
    // Dividir por zero daria Infinity, e "subiu ∞%" não informa nada.
    expect(variacao(50, 0)).toBeNull()
  })

  it('devolve -100% quando zerou', () => {
    expect(variacao(0, 100)).toBe(-1)
  })
})

describe('formatarVariacao', () => {
  it('põe sinal na alta e mantém o da queda', () => {
    expect(formatarVariacao(0.12)).toBe('+12%')
    expect(formatarVariacao(-0.04)).toBe('-4%')
  })

  it('não põe sinal no zero', () => {
    expect(formatarVariacao(0)).toBe('0%')
  })

  it('arredonda para inteiro', () => {
    expect(formatarVariacao(0.126)).toBe('+13%')
  })

  it('propaga a ausência de base', () => {
    expect(formatarVariacao(null)).toBeNull()
  })
})
