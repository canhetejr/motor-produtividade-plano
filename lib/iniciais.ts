/**
 * Iniciais para avatar.
 *
 * Vive em lib/ porque a mesma função estava reescrita em cinco telas, e uma
 * delas quebrava com nome de uma palavra só ou com espaço duplicado — falha que
 * só aparece com o dado real de alguém.
 */
export function iniciaisDe(nome: string | null | undefined): string {
  if (!nome) return '?'
  const partes = nome
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 0)

  if (partes.length === 0) return '?'
  // Primeira e última: "Ana Paula da Silva" vira "AS", não "AP" — o sobrenome
  // distingue mais que o nome do meio.
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}
