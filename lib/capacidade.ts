/**
 * Leitura de sobrecarga e ociosidade a partir do que o painel já calcula.
 *
 * O índice sozinho responde "quanto foi entregue"; ele não separa quem está
 * acima da conta de quem está com folga. As duas pontas exigem ação oposta do
 * gestor, e hoje ficam achatadas no mesmo número.
 */

export type CargaColaborador = {
  colaborador_id: string
  nome: string
  /** Minutos que a carga horária previa para o período. */
  carga_total: number
  /** Minutos efetivamente entregues. */
  tempo_total: number
}

export type Situacao = 'sobrecarregado' | 'no_limite' | 'equilibrado' | 'ocioso' | 'sem_carga'

/**
 * Limiares em fração da carga prevista.
 *
 * Não são arbitrários no sentido de aleatórios, mas também não são lei: 115% é
 * mais que meia hora extra por dia numa jornada de 8h, e 60% é quase metade do
 * dia sem registro. Ficam nomeados aqui para haver um lugar só onde discutir.
 */
export const LIMIAR_SOBRECARGA = 1.15
export const LIMIAR_LIMITE = 1.0
export const LIMIAR_OCIOSO = 0.6

export function situacaoDe(c: CargaColaborador): Situacao {
  // Sem carga prevista o percentual não existe — dividir daria Infinity e a
  // pessoa apareceria como sobrecarregada sem ter jornada cadastrada.
  if (c.carga_total <= 0) return 'sem_carga'
  const razao = c.tempo_total / c.carga_total
  if (razao >= LIMIAR_SOBRECARGA) return 'sobrecarregado'
  if (razao >= LIMIAR_LIMITE) return 'no_limite'
  if (razao < LIMIAR_OCIOSO) return 'ocioso'
  return 'equilibrado'
}

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  sobrecarregado: 'Acima da capacidade',
  no_limite: 'No limite',
  equilibrado: 'Equilibrado',
  ocioso: 'Com folga',
  sem_carga: 'Sem jornada cadastrada',
}

export type ResumoCapacidade = {
  situacao: Situacao
  pessoas: Array<CargaColaborador & { razao: number }>
}

/**
 * Agrupa por situação, do mais urgente ao menos, e ordena cada grupo pelo
 * extremo — o mais sobrecarregado no topo, o mais ocioso no topo do seu grupo.
 */
export function resumirCapacidade(cargas: CargaColaborador[]): ResumoCapacidade[] {
  const ordem: Situacao[] = ['sobrecarregado', 'no_limite', 'ocioso', 'equilibrado', 'sem_carga']
  const grupos = new Map<Situacao, Array<CargaColaborador & { razao: number }>>()

  for (const c of cargas) {
    const situacao = situacaoDe(c)
    const razao = c.carga_total > 0 ? c.tempo_total / c.carga_total : 0
    const lista = grupos.get(situacao)
    if (lista) lista.push({ ...c, razao })
    else grupos.set(situacao, [{ ...c, razao }])
  }

  return ordem
    .filter((s) => grupos.has(s))
    .map((situacao) => {
      const pessoas = grupos.get(situacao)!
      // Ocioso ordena crescente (o mais parado primeiro); os demais decrescente.
      pessoas.sort((a, b) => (situacao === 'ocioso' ? a.razao - b.razao : b.razao - a.razao))
      return { situacao, pessoas }
    })
}
