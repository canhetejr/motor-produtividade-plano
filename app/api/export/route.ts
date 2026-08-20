import { NextRequest, NextResponse } from 'next/server'
import { getProfile } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { sanitizeFormula, escapeCsv } from '@/lib/csv'
import { CABECALHO_APONTAMENTOS, gerarXlsxApontamentos } from '@/lib/export-xlsx'

export { gerarXlsxApontamentos } from '@/lib/export-xlsx'

const HEADER = CABECALHO_APONTAMENTOS

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
    const arquivo = await gerarXlsxApontamentos(start, end, rows)
    return new NextResponse(arquivo as unknown as BodyInit, {
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
