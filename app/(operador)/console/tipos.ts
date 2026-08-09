/** Compartilhado entre a página (server) e os componentes do console. */
export type OrganizacaoOperador = {
  id: string
  nome: string
  slug: string
  status: string
  plano: string
  limiteAssentos: number
  assentosOcupados: number
  trialExpiraEm: string | null
  /** Data prevista do apagamento definitivo — só em status 'excluindo'. */
  excluirEm: string | null
  criadoEm: string
  ultimaAtividade: string | null
  diasSemAtividade: number | null
  emRisco: boolean
  /** Criada nos últimos 30 dias — recorte feito no servidor. */
  novaNoMes: boolean
}

export type AcaoOperador = {
  id: string
  acao: string
  organizacaoNome: string | null
  detalhes: Record<string, unknown> | null
  criadoEm: string
}
