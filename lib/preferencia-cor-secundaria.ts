/** Preferência estética local: segunda cor de destaque da interface —
 * calendário de ritmo de trabalho, indicadores de meta atingida e os nós do
 * fundo de partículas. Mesmo padrão de `preferencia-cor.ts`, independente
 * dela (ver comentário em `globals.css` sobre por que isso não é --success). */
export const CHAVE_COR_SECUNDARIA = 'vertice:cor-secundaria'

export const COR_SECUNDARIA_PADRAO = '#D7F75B'

export const CORES_SECUNDARIAS_PRESET = [
  { nome: 'Tera Acid', valor: '#D7F75B' },
  { nome: 'Ciano', valor: '#22D3EE' },
  { nome: 'Âmbar', valor: '#F59E0B' },
  { nome: 'Lima', valor: '#A3E635' },
  { nome: 'Rosa', valor: '#F472B6' },
  { nome: 'Coral', valor: '#FB7185' },
] as const

const HEX_RE = /^#[0-9a-fA-F]{6}$/

export function lerPreferenciaCorSecundaria(bruto: string | null): string {
  return bruto && HEX_RE.test(bruto) ? bruto : COR_SECUNDARIA_PADRAO
}
