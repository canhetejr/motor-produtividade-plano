/**
 * Formata um total de minutos para exibição.
 * Se >= 60 min: "HH:MM" (ex: 90 min -> "01:30")
 * Se < 60 min: "XX min" (ex: 45 min -> "45 min")
 */
export function formatarTempo(minutos: number | null | undefined): string {
  if (minutos === null || minutos === undefined || isNaN(minutos) || minutos <= 0) {
    return '0 min'
  }
  const min = Math.round(minutos)
  if (min < 60) {
    return `${min} min`
  }
  const h = Math.floor(min / 60)
  const m = min % 60
  const hh = String(h).padStart(2, '0')
  const mm = String(m).padStart(2, '0')
  return `${hh}:${mm}`
}

/**
 * Soma as sessões fechadas de tempo de um card, em segundos.
 *
 * Sessão criada por "ajustar horas" tem `iniciadoEm === finalizadoEm` e o
 * valor real em `minutos` — nesse caso a diferença entre os timestamps é zero
 * e é o campo `minutos` que vale. Sessão de cronômetro é o contrário.
 * Sessão em aberto (sem `finalizadoEm`) não entra: quem mostra o tempo
 * correndo é o ticker do cliente.
 */
export function somarSegundosSessoes(
  sessoes: { iniciadoEm: string | null; finalizadoEm: string | null; minutos: number | null }[]
): number {
  return sessoes.reduce((soma, s) => {
    if (!s.finalizadoEm || !s.iniciadoEm) return soma
    if (s.iniciadoEm === s.finalizadoEm) return soma + (s.minutos ?? 0) * 60

    const diffMs = Math.max(0, new Date(s.finalizadoEm).getTime() - new Date(s.iniciadoEm).getTime())
    return soma + Math.floor(diffMs / 1000)
  }, 0)
}

/**
 * Reparte uma sessão de cronômetro nos dias que ela cobre.
 *
 * Existe porque um apontamento pertence a UM dia (`apontamentos.data`), e uma
 * sessão que começa 23h50 e termina 00h10 é trabalho de dois dias. Jogar tudo
 * no dia em que a pessoa apertou pause infla o índice de um dia às custas do
 * outro.
 *
 * O corte usa a meia-noite do fuso LOCAL do servidor, que é o mesmo
 * referencial de `current_date` usado pelo resto dos apontamentos.
 *
 * Devolve lista vazia quando não há tempo a lançar (fim antes do início, ou
 * menos de um minuto no total) — o chamador simplesmente não cria apontamento.
 */
export function fatiarSessaoPorDia(
  iniciadoEm: string | Date,
  finalizadoEm: string | Date
): { data: string; minutos: number }[] {
  const inicio = new Date(iniciadoEm)
  const fim = new Date(finalizadoEm)
  if (!Number.isFinite(inicio.getTime()) || !Number.isFinite(fim.getTime())) return []
  if (fim.getTime() <= inicio.getTime()) return []

  const fatias: { data: string; minutos: number }[] = []
  let cursor = inicio

  while (cursor.getTime() < fim.getTime()) {
    // Meia-noite do dia seguinte ao do cursor, no fuso local.
    const proximaMeiaNoite = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1)
    const fimDaFatia = proximaMeiaNoite.getTime() < fim.getTime() ? proximaMeiaNoite : fim

    const minutos = Math.round((fimDaFatia.getTime() - cursor.getTime()) / 60000)
    if (minutos > 0) fatias.push({ data: dataLocalISO(cursor), minutos })

    cursor = fimDaFatia
  }

  return fatias
}

/**
 * `YYYY-MM-DD` no fuso local — `toISOString()` daria o dia em UTC, que no
 * Brasil (UTC-3) vira o dia SEGUINTE entre 21h e meia-noite. Todo lugar que
 * grava `apontamentos.data` a partir de um Date precisa passar por aqui.
 */
export function dataLocalISO(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Converte string/número como "01:30", "1:30", "90", "90min", "1h30" ou número 90
 * para o total em minutos inteiros.
 */
export function parseTempo(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined || input === '') return null
  if (typeof input === 'number') {
    return isNaN(input) || input <= 0 ? null : Math.round(input)
  }

  const str = String(input).trim().toLowerCase()
  if (!str) return null

  // Formato HH:MM ou H:MM (ex: 01:30 ou 1:30)
  if (str.includes(':')) {
    const parts = str.split(':')
    const h = parseInt(parts[0], 10) || 0
    const m = parseInt(parts[1], 10) || 0
    const total = h * 60 + m
    return total > 0 ? total : null
  }

  // Formato XhYYm ou Xh (ex: 1h30, 1h 30m, 2h)
  if (str.includes('h')) {
    const parts = str.split('h')
    const h = parseInt(parts[0], 10) || 0
    const mStr = parts[1]?.replace(/[^0-9]/g, '') || '0'
    const m = parseInt(mStr, 10) || 0
    const total = h * 60 + m
    return total > 0 ? total : null
  }

  // Formato numérico em minutos (ex: 90, 45min, 45)
  const num = parseInt(str.replace(/[^0-9]/g, ''), 10)
  return isNaN(num) || num <= 0 ? null : num
}
