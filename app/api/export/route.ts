import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  // Verify gestor
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 })
  }
  const { data: profile } = await supabase.from('colaboradores').select('role').eq('id', user.id).single()
  if (profile?.role !== 'gestor') {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')

  if (!start || !end) {
    return new NextResponse('Missing dates', { status: 400 })
  }

  // Fetch apontamentos_calculado
  const { data: apontamentos, error } = await supabase
    .from('apontamentos_calculado')
    .select(`
      id,
      colaborador_id,
      demanda_id,
      data,
      quantidade,
      tempo_manual_min,
      observacoes,
      tempo_total_min,
      colaboradores (nome),
      demandas (nome, areas (nome))
    `)
    .gte('data', start)
    .lte('data', end)
    .order('data', { ascending: false })

  if (error) {
    return new NextResponse(error.message, { status: 500 })
  }

  // Build CSV
  const header = ['ID', 'Data', 'Colaborador', 'Área', 'Demanda', 'Quantidade', 'Tempo Entregue (min)', 'Observações']
  
  type JoinedRow = {
    id: string
    data: string
    quantidade: number
    tempo_total_min: number
    observacoes: string | null
    colaboradores: { nome: string } | { nome: string }[] | null
    demandas: { 
      nome: string
      areas?: { nome: string } | { nome: string }[] | null 
    } | { 
      nome: string
      areas?: { nome: string } | { nome: string }[] | null 
    }[] | null
  }

  const rows = (apontamentos as unknown as JoinedRow[]).map((a) => {
    const colName = Array.isArray(a.colaboradores) ? a.colaboradores[0]?.nome : a.colaboradores?.nome
    const dem = Array.isArray(a.demandas) ? a.demandas[0] : a.demandas
    const demName = dem?.nome
    const areaName = dem?.areas ? (Array.isArray(dem.areas) ? dem.areas[0]?.nome : dem.areas.nome) : 'N/A'

    return [
      a.id,
      a.data,
      colName || 'N/A',
      areaName || 'N/A',
      demName || 'N/A',
      a.quantidade,
      a.tempo_total_min,
      `"${(a.observacoes || '').replace(/"/g, '""')}"`
    ]
  })

  const csvContent = [header.join(','), ...rows.map(r => r.join(','))].join('\n')

  return new NextResponse(csvContent, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="relatorio-${start}-ate-${end}.csv"`,
    },
  })
}
