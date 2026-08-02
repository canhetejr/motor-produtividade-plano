/**
 * Dependências entre cards: "A está bloqueado por B".
 *
 * Diferente de subtarefa, que é hierarquia (um card pertence a outro). Aqui é
 * ordem: dois cards do mesmo nível, um espera o outro.
 *
 * O problema real não é gravar a relação — é impedir ciclo. A → B → C → A
 * deixaria os três permanentemente bloqueados, sem nada que os destrave, e o
 * usuário não tem como enxergar isso na tela de um card só.
 */

export type Aresta = { cartaoId: string; dependeDe: string }

/**
 * Existe caminho de `origem` até `destino` seguindo as dependências?
 *
 * Busca em largura com conjunto de visitados: sem ele, um grafo que já contenha
 * ciclo (dado legado, ou gravado por fora) faria a função entrar em laço
 * infinito em vez de responder.
 */
export function alcanca(arestas: Aresta[], origem: string, destino: string): boolean {
  const saidas = new Map<string, string[]>()
  for (const a of arestas) {
    const lista = saidas.get(a.cartaoId)
    if (lista) lista.push(a.dependeDe)
    else saidas.set(a.cartaoId, [a.dependeDe])
  }

  const visitados = new Set<string>([origem])
  const fila = [origem]

  while (fila.length > 0) {
    const atual = fila.shift()!
    for (const vizinho of saidas.get(atual) ?? []) {
      if (vizinho === destino) return true
      if (!visitados.has(vizinho)) {
        visitados.add(vizinho)
        fila.push(vizinho)
      }
    }
  }
  return false
}

export type ResultadoValidacao = { ok: true } | { ok: false; motivo: string }

/**
 * Uma dependência nova é válida?
 *
 * `cartaoId` passa a depender de `dependeDe`. É proibido se criar ciclo — o que
 * acontece exatamente quando `dependeDe` já alcança `cartaoId`.
 */
export function validarDependencia(
  arestas: Aresta[],
  cartaoId: string,
  dependeDe: string
): ResultadoValidacao {
  if (cartaoId === dependeDe) {
    return { ok: false, motivo: 'Um card não pode depender de si mesmo.' }
  }
  if (arestas.some((a) => a.cartaoId === cartaoId && a.dependeDe === dependeDe)) {
    return { ok: false, motivo: 'Essa dependência já existe.' }
  }
  if (alcanca(arestas, dependeDe, cartaoId)) {
    return {
      ok: false,
      motivo: 'Isso criaria um ciclo: os cards ficariam bloqueando uns aos outros sem saída.',
    }
  }
  return { ok: true }
}

/**
 * Os cards que faltam concluir para este destravar.
 *
 * Só as dependências diretas: mostrar a cadeia transitiva inteira na face do
 * card viraria ruído, e quem quer o caminho completo abre o card bloqueador.
 */
export function bloqueadoresPendentes(
  arestas: Aresta[],
  cartaoId: string,
  concluidos: Set<string>
): string[] {
  return arestas
    .filter((a) => a.cartaoId === cartaoId && !concluidos.has(a.dependeDe))
    .map((a) => a.dependeDe)
}

export function estaBloqueado(
  arestas: Aresta[],
  cartaoId: string,
  concluidos: Set<string>
): boolean {
  return bloqueadoresPendentes(arestas, cartaoId, concluidos).length > 0
}
