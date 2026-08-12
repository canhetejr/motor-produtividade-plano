/**
 * Converte uma entrada não confiável de `next` em um caminho interno seguro.
 *
 * `new URL()` trata barras invertidas como separadores em URLs especiais;
 * portanto `startsWith('/')` não basta: `/\\host` pode virar outro origin.
 */
export function destinoInternoSeguro(entrada: string | null, origin: string, padrao: string): string {
  if (!entrada || entrada.includes('\\')) return padrao

  try {
    const destino = new URL(entrada, origin)
    if (destino.origin !== origin || !destino.pathname.startsWith('/')) return padrao
    return `${destino.pathname}${destino.search}${destino.hash}`
  } catch {
    return padrao
  }
}
