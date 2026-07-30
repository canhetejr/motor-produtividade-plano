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
