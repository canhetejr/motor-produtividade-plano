/**
 * Visões salvas do Kanban — o conjunto de filtros com um nome.
 *
 * Guardadas por quadro, no armazenamento local. Não é tabela no banco de
 * propósito: filtro é preferência de quem está olhando, não dado do quadro, e
 * uma tabela nova traria migration, RLS e sincronização para resolver algo que
 * só importa neste navegador. A troca é que a visão não acompanha a pessoa
 * entre aparelhos — aceitável para um atalho.
 */

export type FiltrosKanban = {
  busca: string
  prioridade: string
  responsavel: string
}

export type VisaoSalva = FiltrosKanban & {
  id: string
  nome: string
}

export const FILTROS_VAZIOS: FiltrosKanban = {
  busca: '',
  prioridade: 'todas',
  responsavel: 'todos',
}

export function chaveDeArmazenamento(quadroId: string): string {
  return `vertice:visoes:${quadroId}`
}

export function filtrosVazios(f: FiltrosKanban): boolean {
  return f.busca.trim() === '' && f.prioridade === 'todas' && f.responsavel === 'todos'
}

export function mesmosFiltros(a: FiltrosKanban, b: FiltrosKanban): boolean {
  return (
    a.busca.trim() === b.busca.trim() &&
    a.prioridade === b.prioridade &&
    a.responsavel === b.responsavel
  )
}

/**
 * Lê e valida o que está no armazenamento.
 *
 * Nunca confia no formato: o valor pode ter sido gravado por uma versão
 * anterior do app, editado à mão no DevTools, ou corrompido. Entrada inválida
 * some em silêncio em vez de derrubar o quadro inteiro na renderização.
 */
export function lerVisoes(bruto: string | null): VisaoSalva[] {
  if (!bruto) return []
  try {
    const dados = JSON.parse(bruto)
    if (!Array.isArray(dados)) return []
    return dados.filter(
      (v): v is VisaoSalva =>
        typeof v === 'object' &&
        v !== null &&
        typeof v.id === 'string' &&
        typeof v.nome === 'string' &&
        v.nome.trim() !== '' &&
        typeof v.busca === 'string' &&
        typeof v.prioridade === 'string' &&
        typeof v.responsavel === 'string'
    )
  } catch {
    return []
  }
}

/** Substitui a visão de mesmo nome em vez de acumular duplicata. */
export function salvarVisao(atuais: VisaoSalva[], nova: VisaoSalva): VisaoSalva[] {
  const semDuplicata = atuais.filter(
    (v) => v.nome.trim().toLowerCase() !== nova.nome.trim().toLowerCase()
  )
  return [...semDuplicata, nova]
}

export function removerVisao(atuais: VisaoSalva[], id: string): VisaoSalva[] {
  return atuais.filter((v) => v.id !== id)
}
