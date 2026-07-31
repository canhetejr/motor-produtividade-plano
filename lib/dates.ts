// Datas no fuso de Maringá (America/Sao_Paulo), sem date-fns-tz:
// Intl.DateTimeFormat converte o instante atual para a data civil de SP;
// a aritmética de calendário roda em date-fns sobre parseISO (meia-noite
// local — segura porque nunca convertemos de volta para instante).
import {
  parseISO,
  format,
  startOfWeek,
  startOfMonth,
  subDays,
  eachDayOfInterval,
  isWeekend,
} from 'date-fns'

const TZ = 'America/Sao_Paulo'

// 'en-CA' formata exatamente YYYY-MM-DD
const isoFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const horaFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  hour: 'numeric',
  hour12: false,
})

const d = (iso: string) => parseISO(iso)
const iso = (x: Date) => format(x, 'yyyy-MM-dd')

/** Data de hoje (YYYY-MM-DD) no fuso de Maringá. */
export function hoje(): string {
  return isoFmt.format(new Date())
}

/** Segunda-feira da semana de `ref` (YYYY-MM-DD). */
export function inicioSemana(ref: string = hoje()): string {
  return iso(startOfWeek(d(ref), { weekStartsOn: 1 }))
}

/** Dia 1 do mês de `ref` (YYYY-MM-DD). */
export function inicioMes(ref: string = hoje()): string {
  return iso(startOfMonth(d(ref)))
}

/** Dias úteis (seg–sex) no intervalo fechado [start, end]. */
export function diasUteisEntre(start: string, end: string): number {
  if (start > end) return 0
  return eachDayOfInterval({ start: d(start), end: d(end) }).filter(
    (x) => !isWeekend(x)
  ).length
}

/** Os N dias úteis imediatamente anteriores a `ref` (não inclui `ref`), em ordem cronológica. */
export function diasUteisAnteriores(n: number, ref: string = hoje()): string[] {
  const out: string[] = []
  let cur = d(ref)
  while (out.length < n) {
    cur = subDays(cur, 1)
    if (!isWeekend(cur)) out.push(iso(cur))
  }
  return out.reverse()
}

export function ehDiaUtil(ref: string = hoje()): boolean {
  return !isWeekend(d(ref))
}

/** dd/MM sem shift de fuso (parseISO de date-only é meia-noite LOCAL, não UTC). */
export function formatarDataBR(isoDate: string): string {
  return format(d(isoDate), 'dd/MM')
}

/** dd/MM/yyyy sem shift de fuso. */
export function formatarDataCompletaBR(isoDate: string): string {
  return format(d(isoDate), 'dd/MM/yyyy')
}

/** Hora cheia (0-23) em Maringá — o servidor roda em UTC. */
export function horaEmMaringa(now: Date = new Date()): number {
  return Number(horaFmt.format(now)) % 24
}

/** Saudação pela hora de Maringá. */
export function saudacao(now: Date = new Date()): string {
  const h = horaEmMaringa(now)
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}
