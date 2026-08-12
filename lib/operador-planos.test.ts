import { describe, expect, it } from 'vitest'
import { validarDadosPlano } from './operador-planos'

describe('validarDadosPlano', () => {
  it('normaliza um plano operacional válido antes de qualquer mutação', () => {
    expect(
      validarDadosPlano({
        codigo: '  equipe-pro  ',
        nome: '  Equipe Pro ',
        assentosInclusos: '25',
        precoMensalCentavos: '12990',
        ordem: '20',
      })
    ).toEqual({
      ok: true,
      data: {
        codigo: 'equipe-pro',
        nome: 'Equipe Pro',
        assentosInclusos: 25,
        precoMensalCentavos: 12990,
        ordem: 20,
      },
    })
  })
})
