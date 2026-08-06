/** Preferência estética local: cor de destaque da interface (botões, links,
 * bordas ativas e a logo), com o mesmo raciocínio de dispositivo-a-dispositivo
 * das outras preferências em `preferencia-raio.ts` e `preferencia-animacoes.ts`. */
export const CHAVE_COR = 'vertice:cor-primaria'

export const COR_PADRAO = '#820AD1'

export const CORES_PRESET = [
  { nome: 'Roxo Vértice', valor: '#820AD1' },
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
 * Preto ou branco — o que der mais contraste sobre a cor escolhida.
 *
 * Fórmula YIQ (aproximação de luminância perceptual): rápida e suficiente
 * aqui porque a escolha é binária, não precisa do rigor de contraste WCAG
 * usado nos tokens fixos de `globals.css`.
 */
export function corDeContraste(hex: string): '#FFFFFF' | '#130B33' {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const yiq = (r * 299 + g * 587 + b * 114) / 1000
  return yiq >= 150 ? '#130B33' : '#FFFFFF'
}
