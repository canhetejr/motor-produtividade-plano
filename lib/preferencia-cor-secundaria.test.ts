import { describe, expect, it } from 'vitest'
import { COR_SECUNDARIA_PADRAO, lerPreferenciaCorSecundaria } from './preferencia-cor-secundaria'

describe('preferência de cor secundária', () => {
  it('usa o acid da Tera quando não há preferência salva', () => {
    expect(COR_SECUNDARIA_PADRAO).toBe('#D7F75B')
    expect(lerPreferenciaCorSecundaria(null)).toBe('#D7F75B')
  })

  it('preserva uma preferência hexadecimal válida', () => {
    expect(lerPreferenciaCorSecundaria('#F59E0B')).toBe('#F59E0B')
  })

  it('volta ao padrão Tera para uma preferência inválida', () => {
    expect(lerPreferenciaCorSecundaria('menta')).toBe('#D7F75B')
  })
})
