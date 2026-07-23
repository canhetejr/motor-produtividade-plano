import { describe, it, expect } from 'vitest'
import { prepararDemanda } from './demandas'

type Input = { tempo_padrao_min: number | null; variavel: boolean; blocos_totais: number; finita: boolean }

describe('prepararDemanda', () => {
  it('variável força tempo=null, blocos=1, finita=false, mesmo se vierem preenchidos', () => {
    const result = prepararDemanda<Input>({
      tempo_padrao_min: 999,
      variavel: true,
      blocos_totais: 5,
      finita: true,
    })
    expect(result).toEqual({
      data: { tempo_padrao_min: null, variavel: true, blocos_totais: 1, finita: false },
    })
  })

  it('demanda fixa em blocos (>1) sem tempo padrão é barrada', () => {
    const result = prepararDemanda<Input>({
      tempo_padrao_min: null,
      variavel: false,
      blocos_totais: 4,
      finita: false,
    })
    expect(result).toEqual({ error: 'Demanda dividida em blocos precisa de um tempo padrão definido.' })
  })

  it('demanda fixa com 1 bloco não exige tempo padrão', () => {
    const result = prepararDemanda<Input>({
      tempo_padrao_min: null,
      variavel: false,
      blocos_totais: 1,
      finita: false,
    })
    expect('error' in result).toBe(false)
  })

  it('finita sem estar dividida em mais de 1 bloco é barrada', () => {
    const result = prepararDemanda<Input>({
      tempo_padrao_min: 30,
      variavel: false,
      blocos_totais: 1,
      finita: true,
    })
    expect(result).toEqual({ error: 'Demanda finita precisa estar dividida em mais de 1 bloco.' })
  })

  it('finita com blocos > 1 e tempo padrão definido passa normalizada', () => {
    const result = prepararDemanda<Input>({
      tempo_padrao_min: 240,
      variavel: false,
      blocos_totais: 4,
      finita: true,
    })
    expect(result).toEqual({
      data: { tempo_padrao_min: 240, variavel: false, blocos_totais: 4, finita: true },
    })
  })
})
