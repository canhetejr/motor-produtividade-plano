import { describe, expect, it } from 'vitest'
import { CHANGELOG, entradasDoChangelog, VERSAO_ATUAL } from './changelog'

describe('changelog por público', () => {
  it('entrega ao colaborador apenas as novidades destinadas à equipe', () => {
    const entradas = entradasDoChangelog('equipe')

    expect(entradas.length).toBeGreaterThan(0)
    expect(entradas.every((entrada) => entrada.publico === 'equipe')).toBe(true)
    expect(entradas.map((entrada) => entrada.id)).not.toContain('operacao-coolify-e-crons')
  })

  it('entrega à gestão tanto novidades da equipe quanto mudanças administrativas', () => {
    const entradas = entradasDoChangelog('gestao')

    expect(entradas).toHaveLength(CHANGELOG.length)
    expect(entradas.map((entrada) => entrada.id)).toContain('operacao-coolify-e-crons')
  })
})

describe('versões de release', () => {
  it('exige versão semântica em toda entrada e expõe a versão mais recente', () => {
    expect(CHANGELOG.every((entrada) => /^\d+\.\d+\.\d+$/.test(entrada.versao))).toBe(true)
    expect(VERSAO_ATUAL).toBe(CHANGELOG[0].versao)
  })
})
