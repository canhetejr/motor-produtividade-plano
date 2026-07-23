// Funções puras de sanitização usadas no export (app/api/export/route.ts) —
// extraídas pra dar pra testar sem depender do runtime de rotas do Next.

// Neutraliza formula injection: célula que abre com =, +, -, @ é interpretada
// como fórmula pelo Excel/Sheets ao abrir o CSV/XLSX. Prefixar com apóstrofo
// faz o programa tratar como texto literal (mesmo truque de sempre).
export function sanitizeFormula(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value)
  return /^[=+\-@]/.test(s) ? `'${s}` : s
}

// Envolve em aspas qualquer campo com vírgula, aspas ou quebra de linha
export function escapeCsv(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value)
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}
