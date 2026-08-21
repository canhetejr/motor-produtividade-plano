// Formato de retorno das RPCs transacionais do Kanban
// (supabase/migrations/20260820213000_kanban_movimentacao_atomica.sql).
//
// Só tipos: as duas portas de entrada — Server Action e MCP — leem o mesmo
// jsonb, e um campo renomeado no SQL sem espelho aqui vira `undefined` em
// silêncio. Ter o contrato escrito num lugar só é o que faz o `tsc` reclamar.

/** Retorno de `kanban_mover_cartao` / `kanban_mover_cartao_para`. */
export type ResultadoMovimentoCartao = {
  /**
   * false quando o card ficou na mesma coluna (reordenação pura ou arrastar de
   * volta para o mesmo lugar). É o que impede automação e Google Agenda de
   * disparar num movimento que não aconteceu.
   */
  movido: boolean
  cartaoId: string
  codigo: string
  titulo: string
  quadroId: string
  colunaOrigemId: string
  colunaOrigemNome: string
  colunaDestinoId: string
  colunaDestinoNome: string
  ehSubtarefa: boolean
  /** Estado DEPOIS do movimento: o trigger de entrega pode ter acabado de carimbar. */
  entregue: boolean
}

/** Retorno de `kanban_criar_cartao` / `kanban_criar_cartao_para`. */
export type ResultadoCriacaoCartao = {
  id: string
  codigo: string
  referencia: string
  titulo: string
  posicao: number
  colunaId: string
  colunaNome: string
  quadroId: string
}
