import ExcelJS from 'exceljs'

export const CABECALHO_APONTAMENTOS = [
  'ID',
  'Data',
  'Colaborador',
  'Área',
  'Demanda',
  'Quantidade',
  'Tempo Entregue (min)',
  'Motivo',
  'Observações',
]

type LinhaXlsx = (string | number | null)[]

export async function gerarXlsxApontamentos(start: string, end: string, rows: LinhaXlsx[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Vértice'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Apontamentos', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  sheet.addRow(CABECALHO_APONTAMENTOS)
  const headerRow = sheet.getRow(1)
  headerRow.height = 28
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A2E' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false }
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF3B82F6' } } }
  })

  rows.forEach((rowData, idx) => {
    const row = sheet.addRow(rowData)
    row.height = 20
    row.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? 'FFFAFAFA' : 'FFF3F4F6' } }
      cell.font = { size: 9, color: { argb: 'FF1F2937' } }
      cell.alignment = { vertical: 'middle' }
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } }
    })

    const tempoCell = row.getCell(7)
    const tempo = Number(rowData[6])
    if (tempo > 480) tempoCell.font = { ...tempoCell.font, color: { argb: 'FF059669' }, bold: true }
    else if (tempo < 60) tempoCell.font = { ...tempoCell.font, color: { argb: 'FFDC2626' } }
    tempoCell.alignment = { horizontal: 'center', vertical: 'middle' }
    row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' }
  })

  const widths = [36, 12, 24, 18, 32, 12, 22, 24, 36]
  sheet.columns.forEach((col, i) => { col.width = widths[i] ?? 18 })
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: CABECALHO_APONTAMENTOS.length },
  }

  const summarySheet = workbook.addWorksheet('Resumo')
  summarySheet.addRow(['Relatório de Apontamentos'])
  summarySheet.addRow(['Período:', `${start} a ${end}`])
  summarySheet.addRow(['Total de registros:', rows.length])
  summarySheet.addRow(['Tempo total (min):', rows.reduce((acc, row) => acc + Number(row[6]), 0)])
  summarySheet.addRow(['Gerado em:', new Date().toLocaleString('pt-BR')])
  summarySheet.getRow(1).getCell(1).font = { bold: true, size: 14 }
  summarySheet.columns = [{ width: 28 }, { width: 28 }]

  return Buffer.from(await workbook.xlsx.writeBuffer())
}
