/**
 * Fila de apontamentos feitos sem rede.
 *
 * A regra de negócio "só se lança hoje" torna isso mais delicado que uma fila
 * comum: um apontamento enfileirado às 23h de terça e enviado às 8h de quarta
 * seria recusado pelo servidor — ou, pior, aceito com a data errada. Por isso
 * cada item carrega a data em que foi criado, e a fila descarta o que envelheceu
 * em vez de tentar enviar.
 *
 * O escopo por usuário não é detalhe: o service worker deste projeto
 * deliberadamente não cacheia nada autenticado justamente para não vazar dado
 * entre contas no mesmo aparelho (ver o topo de public/sw.js). Uma fila global
 * reabriria exatamente esse buraco.
 */

export type ItemFila = {
  id: string
  /** `YYYY-MM-DD` do momento em que foi enfileirado. */
  data: string
  /** Dono do item — a fila é sempre filtrada por ele antes de enviar. */
  usuarioId: string
  campos: Record<string, string>
  /** Quantas vezes já se tentou enviar. */
  tentativas: number
}

/** Depois disso, insistir só produz erro repetido; o item vira aviso. */
export const MAX_TENTATIVAS = 5

export type Triagem = {
  /** Prontos para envio. */
  enviar: ItemFila[]
  /** Perderam a validade (mudou o dia) ou esgotaram as tentativas. */
  descartar: ItemFila[]
}

/**
 * Separa o que ainda vale enviar do que não vale mais.
 *
 * `hoje` entra como parâmetro em vez de ser lido aqui dentro para o
 * comportamento na virada do dia ser testável.
 */
export function triar(fila: ItemFila[], usuarioId: string, hoje: string): Triagem {
  const enviar: ItemFila[] = []
  const descartar: ItemFila[] = []

  for (const item of fila) {
    // Item de outro usuário nunca é enviado nem descartado: pertence a outra
    // sessão neste mesmo aparelho e some quando aquela sessão limpar a fila.
    if (item.usuarioId !== usuarioId) continue

    if (item.data !== hoje || item.tentativas >= MAX_TENTATIVAS) descartar.push(item)
    else enviar.push(item)
  }

  return { enviar, descartar }
}

/** Remove os itens indicados, preservando o resto (inclusive de outros usuários). */
export function remover(fila: ItemFila[], ids: string[]): ItemFila[] {
  const alvo = new Set(ids)
  return fila.filter((i) => !alvo.has(i.id))
}

/** Incrementa a contagem de tentativa dos itens que falharam. */
export function marcarTentativa(fila: ItemFila[], ids: string[]): ItemFila[] {
  const alvo = new Set(ids)
  return fila.map((i) => (alvo.has(i.id) ? { ...i, tentativas: i.tentativas + 1 } : i))
}

/**
 * Valida o que veio do armazenamento.
 *
 * Nunca confia no formato: pode ter sido gravado por uma versão anterior do app
 * ou corrompido. Item inválido é descartado em silêncio — melhor perder um
 * apontamento enfileirado que travar a fila inteira.
 */
export function lerFila(bruto: string | null): ItemFila[] {
  if (!bruto) return []
  try {
    const dados = JSON.parse(bruto)
    if (!Array.isArray(dados)) return []
    return dados.filter(
      (i): i is ItemFila =>
        typeof i === 'object' &&
        i !== null &&
        typeof i.id === 'string' &&
        typeof i.data === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(i.data) &&
        typeof i.usuarioId === 'string' &&
        typeof i.tentativas === 'number' &&
        typeof i.campos === 'object' &&
        i.campos !== null
    )
  } catch {
    return []
  }
}

export function contarPendentes(fila: ItemFila[], usuarioId: string, hoje: string): number {
  return triar(fila, usuarioId, hoje).enviar.length
}
