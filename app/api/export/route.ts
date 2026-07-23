import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { getProfile } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { sanitizeFormula, escapeCsv } from '@/lib/csv'

const HEADER = ['ID', 'Data', 'Colaborador', 'Área', 'Demanda', 'Quantidade', 'Tempo Entregue (min)', 'Motivo', 'Observações']

export async function GET(request: NextRequest) {
  const session = await getProfile()
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 })
  }
  if (session.profile.role !== 'gestor') {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')
  const format = searchParams.get('format') === 'xlsx' ? 'xlsx' : 'csv'

  const dateRe = /^\d{4}-\d{2}-\d{2}$/
  if (!start || !end || !dateRe.test(start) || !dateRe.test(end)) {
    return new NextResponse('Datas inválidas (use YYYY-MM-DD)', { status: 400 })
  }

  const supabase = await createClient()
  const { data: apontamentos, error } = await supabase
    .from('apontamentos_calculado')
    .select(`
      id,
      data,
      quantidade,
      tempo_total_min,
      motivo,
      observacoes,
      colaboradores (nome),
      demandas (nome, areas (nome))
    `)
    .gte('data', start)
    .lte('data', end)
    .order('data', { ascending: false })

  if (error) {
    console.error('Erro no export:', error)
    return new NextResponse('Falha ao gerar o relatório', { status: 500 })
  }

  const rows = (apontamentos ?? []).map((a) => [
    a.id,
    a.data,
    sanitizeFormula(a.colaboradores?.nome ?? 'N/A'),
    sanitizeFormula(a.demandas?.areas?.nome ?? 'N/A'),
    sanitizeFormula(a.demandas?.nome ?? 'N/A'),
    a.quantidade,
    a.tempo_total_min,
    sanitizeFormula(a.motivo ?? ''),
    sanitizeFormula(a.observacoes ?? ''),
  ])

  if (format === 'xlsx') {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Apontamentos')
    sheet.addRow(HEADER)
    sheet.getRow(1).font = { bold: true }
    for (const row of rows) sheet.addRow(row)
    sheet.columns.forEach((col) => { col.width = 18 })

    const buffer = await workbook.xlsx.writeBuffer()
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="relatorio-${start}-ate-${end}.xlsx"`,
      },
    })
  }

  const csvContent = [HEADER, ...rows]
    .map((r) => r.map(escapeCsv).join(','))
    .join('\r\n')

  // BOM UTF-8: Excel abre acentos corretamente
  return new NextResponse('\uFEFF' + csvContent, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="relatorio-${start}-ate-${end}.csv"`,
    },
  })
}
