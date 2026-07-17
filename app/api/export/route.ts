import { NextRequest, NextResponse } from 'next/server'
import { getProfile } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'

// Envolve em aspas qualquer campo com vírgula, aspas ou quebra de linha
function escapeCsv(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value)
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

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

  const header = ['ID', 'Data', 'Colaborador', 'Área', 'Demanda', 'Quantidade', 'Tempo Entregue (min)', 'Observações']

  const rows = (apontamentos ?? []).map((a) => [
    a.id,
    a.data,
    a.colaboradores?.nome ?? 'N/A',
    a.demandas?.areas?.nome ?? 'N/A',
    a.demandas?.nome ?? 'N/A',
    a.quantidade,
    a.tempo_total_min,
    a.observacoes ?? '',
  ])

  const csvContent = [header, ...rows]
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
