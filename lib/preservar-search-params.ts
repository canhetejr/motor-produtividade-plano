export type SearchParams = Record<string, string | string[] | undefined>

export function comSearchParams(caminho: string, searchParams: SearchParams): string {
  const query = new URLSearchParams()
  for (const [chave, valor] of Object.entries(searchParams)) {
    if (Array.isArray(valor)) valor.forEach((item) => query.append(chave, item))
    else if (valor !== undefined) query.set(chave, valor)
  }
  const sufixo = query.toString()
  return sufixo ? caminho + '?' + sufixo : caminho
}
