import { describe, expect, it } from 'vitest'
import { COR_PADRAO, corDeContraste, lerPreferenciaCor } from './preferencia-cor'

describe('preferência de cor primária', () => {
  it('usa o acid da Tera quando não há preferência salva', () => {
    expect(COR_PADRAO).toBe('#D7F75B')
    expect(lerPreferenciaCor(null)).toBe('#D7F75B')
  })

  it('preserva uma preferência hexadecimal válida', () => {
    expect(lerPreferenciaCor('#2563EB')).toBe('#2563EB')
  })

  it('usa ink Tera sobre o acid padrão', () => {
    expect(corDeContraste(COR_PADRAO)).toBe('#101010')
  })

  it('mantém a escolha de contraste para cores personalizadas', () => {
    expect(corDeContraste('#2563EB')).toBe('#FFFFFF')
  })

  it('escolhe o texto mais legível para cada preset disponível', () => {
    expect(corDeContraste('#2563EB')).toBe('#FFFFFF')
    expect(corDeContraste('#059669')).toBe('#101010')
    expect(corDeContraste('#EA580C')).toBe('#101010')
    expect(corDeContraste('#DB2777')).toBe('#FFFFFF')
    expect(corDeContraste('#DC2626')).toBe('#FFFFFF')
    expect(corDeContraste('#777777')).toBe('#FFFFFF')
  })

  it('volta ao padrão Tera para uma preferência inválida', () => {
    expect(lerPreferenciaCor('roxo')).toBe('#D7F75B')
  })
})
