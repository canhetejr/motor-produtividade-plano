import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { getProfile } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { sanitizeFormula, escapeCsv } from '@/lib/csv'

const HEADER = [
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

type FormatType = 'csv' | 'xlsx' | 'pdf' | 'json'

export async function GET(request: NextRequest) {
  const session = await getProfile()
  if (!session) return new NextResponse('Unauthorized', { status: 401 })
  if (session.profile.role !== 'gestor') return new NextResponse('Forbidden', { status: 403 })

  const { searchParams } = new URL(request.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')
  const rawFormat = searchParams.get('format') ?? 'xlsx'
  const format: FormatType = ['csv', 'xlsx', 'pdf', 'json'].includes(rawFormat)
    ? (rawFormat as FormatType)
    : 'xlsx'
  const areaFilter = searchParams.get('area') ?? null

  const dateRe = /^\d{4}-\d{2}-\d{2}$/
  if (!start || !end || !dateRe.test(start) || !dateRe.test(end)) {
    return new NextResponse('Datas inválidas (use YYYY-MM-DD)', { status: 400 })
  }

  const supabase = await createClient()

  let query = supabase
    .from('apontamentos_calculado')
    .select(`
      id,
      data,
      quantidade,
      tempo_total_min,
      motivo,
      observacoes,
      colaboradores (nome),
      demandas (nome, areas (id, nome))
    `)
    .gte('data', start)
    .lte('data', end)
    .order('data', { ascending: false })

  if (areaFilter) {
    query = query.eq('area_id', areaFilter)
  }

  const { data: apontamentos, error } = await query

  if (error) {
    console.error('Erro no export:', error)
    return new NextResponse('Falha ao gerar o relatório', { status: 500 })
  }

  const rows = (apontamentos ?? []).map((a) => [
    a.id,
    a.data,
    sanitizeFormula(a.colaboradores?.nome ?? 'N/A'),
    sanitizeFormula((a.demandas as { areas?: { nome?: string } } | null)?.areas?.nome ?? 'N/A'),
    sanitizeFormula((a.demandas as { nome?: string } | null)?.nome ?? 'N/A'),
    a.quantidade,
    a.tempo_total_min,
    sanitizeFormula(a.motivo ?? ''),
    sanitizeFormula(a.observacoes ?? ''),
  ])

  // ─── CSV ────────────────────────────────────────────────────────────────────
  if (format === 'csv') {
    const csvContent = [HEADER, ...rows]
      .map((r) => r.map(escapeCsv).join(','))
      .join('\r\n')

    return new NextResponse('\uFEFF' + csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="relatorio-${start}-ate-${end}.csv"`,
      },
    })
  }

  // ─── XLSX (formatado) ────────────────────────────────────────────────────────
  if (format === 'xlsx') {
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Motor de Produtividade'
    workbook.created = new Date()

    const sheet = workbook.addWorksheet('Apontamentos', {
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
      views: [{ state: 'frozen', ySplit: 1 }],
    })

    // Header row
    sheet.addRow(HEADER)

    const headerRow = sheet.getRow(1)
    headerRow.height = 28
    headerRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1A1A2E' }, // dark navy
      }
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false }
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FF3B82F6' } },
      }
      void colNumber
    })

    // Data rows
    rows.forEach((rowData, idx) => {
      const row = sheet.addRow(rowData)
      row.height = 20
      const isEven = idx % 2 === 0
      row.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isEven ? 'FFFAFAFA' : 'FFF3F4F6' },
        }
        cell.font = { size: 9, color: { argb: 'FF1F2937' } }
        cell.alignment = { vertical: 'middle' }
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        }
      })

      // Highlight tempo_total_min (col 7)
      const tempoCell = row.getCell(7)
      const tempo = Number(rowData[6])
      if (tempo > 480) {
        tempoCell.font = { ...tempoCell.font, color: { argb: 'FF059669' }, bold: true }
      } else if (tempo < 60) {
        tempoCell.font = { ...tempoCell.font, color: { argb: 'FFDC2626' } }
      }
      tempoCell.alignment = { horizontal: 'center', vertical: 'middle' }

      // Center quantity col (6)
      row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' }
    })

    // Column widths
    const widths = [36, 12, 24, 18, 32, 12, 22, 24, 36]
    sheet.columns.forEach((col, i) => {
      col.width = widths[i] ?? 18
    })

    // Auto-filter
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: HEADER.length },
    }

    // Summary sheet
    const summarySheet = workbook.addWorksheet('Resumo')
    summarySheet.addRow(['Relatório de Apontamentos'])
    summarySheet.addRow(['Período:', `${start} a ${end}`])
    summarySheet.addRow(['Total de registros:', rows.length])
    summarySheet.addRow([
      'Tempo total (min):',
      rows.reduce((acc, r) => acc + Number(r[6]), 0),
    ])
    summarySheet.addRow(['Gerado em:', new Date().toLocaleString('pt-BR')])

    summarySheet.getRow(1).getCell(1).font = { bold: true, size: 14 }
    summarySheet.columns = [{ width: 28 }, { width: 28 }]

    const buffer = await workbook.xlsx.writeBuffer()
    return new NextResponse(buffer, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="relatorio-${start}-ate-${end}.xlsx"`,
      },
    })
  }

  // ─── JSON (for Client-Side PDF Generation) ──────────────────────────────────
  if (format === 'json') {
    return NextResponse.json({ rows: apontamentos })
  }

  return new NextResponse('Formato não suportado', { status: 400 })
}
