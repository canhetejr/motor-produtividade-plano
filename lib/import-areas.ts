// Áreas citadas por uma planilha que ainda não existem no cadastro.
//
// Sem isto, importar um catálogo novo é um beco: cada linha falha com
// `Área "Auxiliar" não encontrada`, e a saída é sair da importação, cadastrar
// as áreas na mão uma a uma e voltar. O import passa a perguntar quais criar,
// que é a decisão que a pessoa tomaria de qualquer jeito — só que sem perder
// o arquivo no caminho.

/** Comparação de nome de área: sem caixa e sem espaço nas pontas, igual ao
 *  que as actions já fazem ao montar o mapa de áreas existentes. */
export function chaveArea(nome: string): string {
  return nome.trim().toLowerCase()
}

/**
 * Nomes de área que aparecem na planilha e não estão em `existentes`.
 *
 * Devolve na grafia da planilha (é ela que vai virar o cadastro) e na ordem
 * de aparição, sem repetir. Linha sem área é ignorada aqui: ela tem o seu
 * próprio erro, e oferecer a criação de uma área sem nome não faz sentido.
 */
export function areasFaltantes(
  linhas: Record<string, string>[],
  existentes: Iterable<string>
): string[] {
  const conhecidas = new Set<string>()
  for (const nome of existentes) conhecidas.add(chaveArea(nome))

  const faltantes: string[] = []
  const vistas = new Set<string>()
  for (const linha of linhas) {
    const nome = (linha.area ?? '').trim()
    if (nome === '') continue
    const chave = chaveArea(nome)
    if (conhecidas.has(chave) || vistas.has(chave)) continue
    vistas.add(chave)
    faltantes.push(nome)
  }
  return faltantes
}

/**
 * Lê a decisão que voltou do diálogo.
 *
 * `null` significa "ainda não perguntei" — é o que dispara a pergunta. Uma
 * lista vazia é uma resposta legítima ("importe sem criar nada"), e por isso
 * os dois casos não podem ser o mesmo valor.
 */
export function lerAreasAprovadas(bruto: unknown): Set<string> | null {
  if (typeof bruto !== 'string') return null
  try {
    const lista = JSON.parse(bruto)
    if (!Array.isArray(lista)) return null
    return new Set(lista.filter((n): n is string => typeof n === 'string').map(chaveArea))
  } catch {
    return null
  }
}
