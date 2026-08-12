import { describe, expect, it } from 'vitest'

import { destinoInternoSeguro } from './auth-redirect'

describe('destinoInternoSeguro', () => {
  const origin = 'https://vertice.teralabs.cloud'

  it('preserva um caminho interno permitido', () => {
    expect(destinoInternoSeguro('/minha-semana?modo=lote', origin, '/perfil')).toBe('/minha-semana?modo=lote')
  })

  it.each([
    '//evil.example',
    '/\\evil.example',
    '\\evil.example',
    'https://evil.example',
    'javascript:alert(1)',
  ])('recusa destino externo ou ambíguo: %s', (entrada) => {
    expect(destinoInternoSeguro(entrada, origin, '/perfil')).toBe('/perfil')
  })
})
