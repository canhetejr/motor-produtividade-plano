import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardFilters } from './dashboard-filters'
import { DashboardTable } from './dashboard-table'

export const dynamic = 'force-dynamic'

export default async function DashboardPage(props: {
  searchParams: Promise<{ period?: string; area?: string }>
}) {
  const searchParams = await props.searchParams
  const supabase = await createClient()

  // Middleware already protects this route for gestor, but we double check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const period = searchParams.period || 'today'
  const areaFilter = searchParams.area || 'all'

  // Fetch areas for the filter
  const { data: areas } = await supabase.from('areas').select('id, nome').order('nome')

  // Calculate the date range based on the period
  const today = new Date()
  const startDate = new Date(today)
  if (period === 'week') {
    startDate.setDate(today.getDate() - today.getDay()) // start of week
  } else if (period === 'month') {
    startDate.setDate(1) // start of month
  }
  const startDateStr = startDate.toISOString().split('T')[0]
  const todayStr = today.toISOString().split('T')[0]

  // We need to fetch from indicadores_diarios
  const query = supabase
    .from('indicadores_diarios')
    .select(`
      colaborador_id,
      nome,
      data,
      carga_horaria_min,
      tempo_entregue_min,
      indice
    `)
    .gte('data', startDateStr)
    .lte('data', todayStr)

  const { data: indicadores } = await query

  // If an area is selected, we need to filter by area.
  // The view doesn't have area_id, so we fetch colaboradores to map it
  const { data: colaboradores } = await supabase
    .from('colaboradores')
    .select('id, area_id')

  const colaboradorAreaMap = new Map(colaboradores?.map(c => [c.id, c.area_id]))

  // Filter and aggregate
  const aggregatedData = new Map()

  indicadores?.forEach((ind) => {
    const areaId = colaboradorAreaMap.get(ind.colaborador_id)
    if (areaFilter !== 'all' && areaId !== areaFilter) return

    if (!aggregatedData.has(ind.colaborador_id)) {
      aggregatedData.set(ind.colaborador_id, {
        colaborador_id: ind.colaborador_id,
        nome: ind.nome,
        carga_total: 0,
        tempo_total: 0,
      })
    }

    const current = aggregatedData.get(ind.colaborador_id)
    current.carga_total += ind.carga_horaria_min
    current.tempo_total += ind.tempo_entregue_min
  })

  // Calculate final indices
  const finalData = Array.from(aggregatedData.values()).map(d => ({
    ...d,
    indice: d.carga_total > 0 ? (d.tempo_total / d.carga_total) : 0
  }))

  return (
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-6">Dashboard de Produtividade</h1>
      
      <div className="mb-6">
        <DashboardFilters 
          areas={areas || []} 
          currentPeriod={period} 
          currentArea={areaFilter} 
        />
      </div>

      <DashboardTable data={finalData} />
    </div>
  )
}
