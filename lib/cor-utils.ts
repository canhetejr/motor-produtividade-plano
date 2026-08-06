/** Conversões de hex compartilhadas pelos appliers de cor e pelo fundo de
 * partículas — o resto da lógica de cada preferência fica em seu próprio
 * módulo (`preferencia-cor.ts`, `preferencia-cor-secundaria.ts`). */

export function hexParaRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

/** "r, g, b" — formato que `rgba(...)` do canvas espera. */
export function hexParaRgbCss(hex: string): string {
  return hexParaRgb(hex).join(', ')
}

/** Variante mais escura de uma cor, para usar como borda/traço quando só há
 * uma cor de base escolhida pelo usuário (equivalente ao --mint-deep fixo
 * em relação ao --v-mint). */
export function escurecer(hex: string, fator = 0.82): string {
  const [r, g, b] = hexParaRgb(hex)
  const canal = (v: number) => Math.max(0, Math.round(v * fator)).toString(16).padStart(2, '0')
  return `#${canal(r)}${canal(g)}${canal(b)}`
}
