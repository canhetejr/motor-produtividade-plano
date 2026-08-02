import { htmlParaTexto } from './rich-text-texto'

/**
 * Menções `@nome` em comentário de card.
 *
 * O comentário é HTML vindo do editor rich text, então o texto puro é extraído
 * antes: sem isso, `<strong>@ana</strong>` não casaria, e o nome dentro de um
 * atributo (`<a title="@ana">`) casaria por engano.
 */

/** Um nome de menção termina no primeiro caractere que não pode fazer parte de nome. */
const PADRAO_MENCAO = /@([\p{L}][\p{L}\p{M}'.-]*(?:\s+[\p{L}][\p{L}\p{M}'.-]*)*)/gu

function normalizar(valor: string): string {
  return valor
    .normalize('NFD')
    // Remove os diacríticos combinantes: "José" e "Jose" têm que casar, senão a
    // menção depende de a pessoa acertar o acento.
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
}

/**
 * Resolve as menções de um comentário contra a lista de membros do quadro.
 *
 * Casa o nome mais longo possível: com "Ana" e "Ana Paula" na equipe, escrever
 * `@Ana Paula` menciona a Ana Paula, não a Ana seguida da palavra "Paula".
 * Devolve ids únicos — mencionar duas vezes não gera duas notificações.
 */
export function resolverMencoes(
  conteudoHtml: string,
  membros: Array<{ id: string; nome: string }>
): string[] {
  const texto = htmlParaTexto(conteudoHtml)
  if (!texto.includes('@')) return []

  // Do nome mais longo para o mais curto, para o prefixo não ganhar do completo.
  const porNome = [...membros].sort((a, b) => b.nome.length - a.nome.length)
  const encontrados = new Set<string>()

  for (const bruto of texto.matchAll(PADRAO_MENCAO)) {
    const candidato = normalizar(bruto[1])
    if (!candidato) continue
    const membro = porNome.find((m) => {
      const nome = normalizar(m.nome)
      if (candidato === nome) return true
      // `@Ana Paula da Silva vai revisar` — o nome cadastrado é prefixo do que
      // foi capturado, e a sobra tem que começar com espaço para não casar
      // "Anabela" com "Ana".
      return candidato.startsWith(nome + ' ')
    })
    if (membro) encontrados.add(membro.id)
  }

  return [...encontrados]
}
