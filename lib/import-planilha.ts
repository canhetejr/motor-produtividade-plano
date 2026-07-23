import 'server-only'
import ExcelJS from 'exceljs'
import { Readable } from 'stream'

// Lê CSV ou XLSX (mesma lib já usada em app/api/export/route.ts, só que pra
// leitura) e devolve as linhas como objetos, chaveados pelo cabeçalho
// (normalizado pra minúsculo/trim) — assim o chamador não lida com posição
// de coluna, só com nomes ("nome", "area", "email" etc.).
export async function lerLinhasPlanilha(file: File): Promise<Record<string, string>[]> {
  const buffer = Buffer.from(await file.arrayBuffer())
  const workbook = new ExcelJS.Workbook()
  const isCsv = file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv')

  if (isCsv) {
    // Readable.from([buffer]) emite o buffer inteiro como um único chunk —
    // Readable.from(buffer) trataria o Buffer como iterável byte a byte.
    await workbook.csv.read(Readable.from([buffer]))
  } else {
    // node_modules/exceljs/index.d.ts declara seu próprio
    // `interface Buffer extends ArrayBuffer {}` global, que colide com o
    // Buffer genérico do @types/node atual (mistura de declarações exige
    // propriedades de ArrayBuffer redimensionável que um Buffer real não
    // tem estaticamente). `any` aqui é só pra contornar esse defeito de
    // tipos do pacote — o valor em runtime é um Buffer válido.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(buffer as any)
  }

  const sheet = workbook.worksheets[0]
  if (!sheet) return []

  const headers: string[] = []
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber] = String(cell.value ?? '').trim().toLowerCase()
  })

  const linhas: Record<string, string>[] = []
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const obj: Record<string, string> = {}
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const key = headers[colNumber]
      if (key) obj[key] = String(cell.value ?? '').trim()
    })
    if (Object.values(obj).some((v) => v !== '')) linhas.push(obj)
  })

  return linhas
}

export type LinhaImportResultado = {
  linha: number
  nome: string
  status: 'ok' | 'erro'
  motivo?: string
}
