/**
 * Regras de quando e para quem um relatório agendado sai.
 *
 * Separadas do route handler do cron porque são a parte que erra em silêncio: um
 * relatório que não sai não gera erro em lugar nenhum — ninguém reclama de
 * e-mail que não chegou, só se estranha meses depois.
 */

export type Agendamento = {
  id: string
  nome: string
  janelaDiasUteis: number
  /** 1 = segunda … 7 = domingo, padrão ISO. */
  diaSemana: number
  areaId: string | null
  ativo: boolean
  destinatarios: string[]
}

export type Pessoa = {
  id: string
  role: string
  areaId: string | null
  aceitaRelatorio: boolean
}

/** Dia da semana no padrão ISO (1 = segunda, 7 = domingo) para um `YYYY-MM-DD`. */
export function diaSemanaIso(iso: string): number {
  // Meia-noite UTC evita o dia mudar por fuso — a data já é uma data, não um
  // instante.
  const d = new Date(`${iso}T00:00:00Z`)
  const js = d.getUTCDay() // 0 = domingo
  return js === 0 ? 7 : js
}

export function devesSair(agendamento: Agendamento, hoje: string): boolean {
  return agendamento.ativo && agendamento.diaSemana === diaSemanaIso(hoje)
}

/**
 * Quem recebe.
 *
 * Sem destinatário explícito, vai para os gestores — o comportamento de hoje, e
 * o padrão seguro: um agendamento salvo pela metade manda para quem já recebia,
 * em vez de não mandar para ninguém.
 *
 * A preferência individual é sempre respeitada, inclusive contra lista
 * explícita: quem desligou o relatório nas próprias configurações desligou de
 * verdade. Listar alguém num agendamento não pode reativar aviso que a pessoa
 * recusou.
 */
export function destinatariosDe(agendamento: Agendamento, pessoas: Pessoa[]): string[] {
  const base =
    agendamento.destinatarios.length > 0
      ? pessoas.filter((p) => agendamento.destinatarios.includes(p.id))
      : pessoas.filter((p) => p.role === 'gestor')

  return base.filter((p) => p.aceitaRelatorio).map((p) => p.id)
}

/** Quem entra no recorte medido: a área do agendamento, ou a equipe inteira. */
export function escopoDe(agendamento: Agendamento, pessoas: Pessoa[]): Pessoa[] {
  if (!agendamento.areaId) return pessoas
  return pessoas.filter((p) => p.areaId === agendamento.areaId)
}
