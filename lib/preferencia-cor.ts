/** Preferência estética local: cor de destaque da interface (botões, links,
 * bordas ativas e a logo), com o mesmo raciocínio de dispositivo-a-dispositivo
 * das outras preferências em `preferencia-raio.ts` e `preferencia-animacoes.ts`. */
export const CHAVE_COR = 'vertice:cor-primaria'

export const COR_PADRAO = '#D7F75B'

export const CORES_PRESET = [
  { nome: 'Tera Acid', valor: '#D7F75B' },
  { nome: 'Azul', valor: '#2563EB' },
  { nome: 'Verde', valor: '#059669' },
  { nome: 'Laranja', valor: '#EA580C' },
  { nome: 'Rosa', valor: '#DB2777' },
  { nome: 'Vermelho', valor: '#DC2626' },
] as const

const HEX_RE = /^#[0-9a-fA-F]{6}$/

export function lerPreferenciaCor(bruto: string | null): string {
  return bruto && HEX_RE.test(bruto) ? bruto : COR_PADRAO
}

/**
 * Retorna o texto (#101010 ou branco) com maior contraste WCAG sobre a cor.
 * A preferência aceita cores personalizadas; portanto, um corte por YIQ pode
 * escolher uma opção visivelmente pior em tons médios como verde e laranja.
 */
export function corDeContraste(hex: string): '#FFFFFF' | '#101010' {
  const canais = [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
  const luminancia = (rgb: number[]) => rgb
    .map((canal) => {
      const normalizado = canal / 255
      return normalizado <= 0.04045
        ? normalizado / 12.92
        : ((normalizado + 0.055) / 1.055) ** 2.4
    })
    .reduce((total, canal, indice) => total + canal * [0.2126, 0.7152, 0.0722][indice], 0)
  const fundo = luminancia(canais)
  const ink = luminancia([16, 16, 16])
  const contraste = (texto: number) => (Math.max(fundo, texto) + 0.05) / (Math.min(fundo, texto) + 0.05)

  return contraste(ink) >= contraste(1) ? '#101010' : '#FFFFFF'
}
