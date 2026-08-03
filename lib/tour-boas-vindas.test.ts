import { describe, it, expect } from 'vitest'
import { tourJaVisto, PASSOS_TOUR } from './tour-boas-vindas'

describe('tourJaVisto', () => {
  it('nao visto por padrao', () => {
    expect(tourJaVisto(null)).toBe(false)
  })

  it('reconhece o marcador de visto', () => {
    expect(tourJaVisto('1')).toBe(true)
  })

  it('trata valor inesperado como nao visto', () => {
    // Pode ter sido gravado por uma versao anterior ou editado a mao.
    expect(tourJaVisto('sim')).toBe(false)
    expect(tourJaVisto('')).toBe(false)
  })
})

describe('PASSOS_TOUR', () => {
  it('tem pelo menos um passo', () => {
    expect(PASSOS_TOUR.length).toBeGreaterThan(0)
  })

  it('cada passo tem destino real, nao vazio', () => {
    for (const passo of PASSOS_TOUR) {
      expect(passo.href.startsWith('/')).toBe(true)
      expect(passo.titulo.length).toBeGreaterThan(0)
    }
  })
})
