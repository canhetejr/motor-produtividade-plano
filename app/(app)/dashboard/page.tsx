import { requireGestor } from '@/lib/auth'
import { hoje, inicioSemana, inicioMes, diasUteisEntre } from '@/lib/dates'
import { createClient } from '@/utils/supabase/server'
import { DashboardFilters } from './dashboard-filters'
import { DashboardTable } from './dashboard-table'
import { HeatmapChart } from '@/components/charts/heatmap-chart'
import { DailyProgressBlocks } from '@/components/charts/daily-progress-blocks'
import { TopPerformers } from './top-performers'
import { TopDemandas } from './top-demandas'
import { subDays, parseISO, format } from 'date-fns'
import { Activity, Target, Trophy } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function DashboardPage(props: {
  searchParams: Promise<{ period?: string; area?: string; date?: string }>
}) {
  await requireGestor()
  const searchParams = await props.searchParams
  const supabase = await createClient()

  const period = searchParams.period || 'today'
  const areaFilter = searchParams.area || 'all'

  const todayIso = hoje()
  const selectedDate = searchParams.date || todayIso
  let startIso = todayIso
  if (period === 'week') startIso = inicioSemana()
  else if (period === 'month') startIso = inicioMes()
  else if (period === 'last7') startIso = format(subDays(parseISO(todayIso), 7), 'yyyy-MM-dd')
  else if (period === 'last15') startIso = format(subDays(parseISO(todayIso), 15), 'yyyy-MM-dd')
  else if (period === 'last30') startIso = format(subDays(parseISO(todayIso), 30), 'yyyy-MM-dd')
  else if (period === 'last90') startIso = format(subDays(parseISO(todayIso), 90), 'yyyy-MM-dd')
  else if (period === 'last180') startIso = format(subDays(parseISO(todayIso), 180), 'yyyy-MM-dd')
  
  // Sábado/domingo: garante denominador mínimo de 1 dia
  const diasUteis = Math.max(1, diasUteisEntre(startIso, todayIso))

  const startIso180 = format(subDays(parseISO(todayIso), 180), 'yyyy-MM-dd')

  const [{ data: areas }, { data: colaboradores }, { data: indicadores180 }, { data: apontamentosDiarios }, { data: apontamentosPeriodo }] = await Promise.all([
    supabase.from('areas').select('id, nome').order('nome'),
    supabase
      .from('colaboradores')
      .select('id, nome, area_id, carga_horaria_min')
      .eq('ativo', true)
      .order('nome'),
    supabase
      .from('indicadores_diarios')
      .select('colaborador_id, data, tempo_entregue_min, indice')
      .gte('data', startIso180)
      .lte('data', todayIso),
    supabase
      .from('apontamentos')
      .select('id, quantidade, colaborador_id, demandas(nome)')
      .eq('data', selectedDate),
    supabase
      .from('apontamentos')
      .select('quantidade, colaborador_id, demandas(nome)')
      .gte('data', startIso)
      .lte('data', todayIso),
  ])

  // Filter valid collaborators based on area filter
  const validColabIds = new Set(
    (colaboradores ?? [])
      .filter((c) => areaFilter === 'all' || c.area_id === areaFilter)
      .map((c) => c.id)
  )

  // indicadores_diarios usa LEFT JOIN (migration 0002); colaborador sem
  // nenhum apontamento no período gera uma linha com data = null.
  const indicadoresPeriodo = (indicadores180 ?? []).filter(
    (ind): ind is typeof ind & { data: string } => ind.data !== null && ind.data >= startIso
  )

  // Soma o tempo entregue e os dias com lançamento por colaborador
  const entregue = new Map<string, { tempo: number; dias: Set<string> }>()
  for (const ind of indicadoresPeriodo) {
    const cur = entregue.get(ind.colaborador_id) ?? { tempo: 0, dias: new Set<string>() }
    cur.tempo += ind.tempo_entregue_min
    if (ind.data) cur.dias.add(ind.data)
    entregue.set(ind.colaborador_id, cur)
  }

  // Todo colaborador ativo aparece; denominador = dias úteis do período × carga
  const finalData = (colaboradores ?? [])
    .filter((c) => validColabIds.has(c.id))
    .map((c) => {
      const e = entregue.get(c.id)
      const cargaPeriodo = diasUteis * c.carga_horaria_min
      return {
        colaborador_id: c.id,
        nome: c.nome,
        carga_total: cargaPeriodo,
        tempo_total: e?.tempo ?? 0,
        dias_apontados: e?.dias.size ?? 0,
        dias_uteis: diasUteis,
        indice: cargaPeriodo > 0 ? (e?.tempo ?? 0) / cargaPeriodo : 0,
      }
    })

  // Stat cards
  const mediaIndice =
    finalData.length > 0
      ? finalData.reduce((acc, d) => acc + d.indice, 0) / finalData.length
      : 0
  const totalDiasPossiveis = finalData.length * diasUteis
  const preenchimento =
    totalDiasPossiveis > 0
      ? finalData.reduce((acc, d) => acc + d.dias_apontados, 0) / totalDiasPossiveis
      : 0

  const indicePorArea = new Map<string, { soma: number; n: number }>()
  for (const c of colaboradores ?? []) {
    if (!c.area_id) continue
    const d = finalData.find((f) => f.colaborador_id === c.id)
    if (!d) continue
    const cur = indicePorArea.get(c.area_id) ?? { soma: 0, n: 0 }
    cur.soma += d.indice
    cur.n += 1
    indicePorArea.set(c.area_id, cur)
  }
  let topArea: { nome: string; indice: number } | null = null
  for (const [areaId, { soma, n }] of indicePorArea) {
    const media = n > 0 ? soma / n : 0
    if (!topArea || media > topArea.indice) {
      topArea = { nome: areas?.find((a) => a.id === areaId)?.nome ?? '—', indice: media }
    }
  }

  // Heatmap Aggregation
  const heatmapAgrupado = new Map<string, { soma: number; count: number }>()
  for (const ind of (indicadores180 ?? [])) {
    if (!ind.data || !validColabIds.has(ind.colaborador_id)) continue
    const cur = heatmapAgrupado.get(ind.data) ?? { soma: 0, count: 0 }
    cur.soma += ind.indice ?? 0
    cur.count += 1
    heatmapAgrupado.set(ind.data, cur)
  }
  const heatmapData = Array.from(heatmapAgrupado.entries()).map(([data, { soma, count }]) => ({
    data,
    indice: count > 0 ? soma / count : 0
  }))

  // Daily Progress Aggregation
  const dailyApontamentos = (apontamentosDiarios ?? []).filter(ap => validColabIds.has(ap.colaborador_id))

  // Top Demandas Aggregation
  const topDemandasMap = new Map<string, number>()
  for (const ap of (apontamentosPeriodo ?? [])) {
    if (!validColabIds.has(ap.colaborador_id)) continue
    const nome = ap.demandas?.nome
    if (!nome) continue
    const cur = topDemandasMap.get(nome) ?? 0
    topDemandasMap.set(nome, cur + ap.quantidade)
  }
  const topDemandasData = Array.from(topDemandasMap.entries()).map(([nome, quantidade]) => ({
    nome,
    quantidade
  }))

  return (
    <div className="relative min-h-[calc(100dvh-4rem)] p-4 md:p-8 overflow-x-hidden">
      {/* Background glow effects */}
      <div className="fixed top-0 left-1/4 w-[800px] h-[400px] bg-primary/10 blur-[120px] rounded-full pointer-events-none -z-10" />
      <div className="fixed bottom-0 right-0 w-[600px] h-[500px] bg-primary/5 blur-[120px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-8">
          Dashboard <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/60">Gerencial</span>
        </h1>

        <div className="mb-8">
          <DashboardFilters
            areas={areas || []}
            currentPeriod={period}
            currentArea={areaFilter}
          />
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-card/80 border border-border shadow-lg rounded-3xl p-6 backdrop-blur-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Activity className="h-16 w-16 text-primary" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Índice Médio</p>
            <div className="text-4xl md:text-5xl font-black text-foreground tracking-tighter">
              {(mediaIndice * 100).toFixed(1)}%
            </div>
            <p className="text-sm font-medium text-muted-foreground mt-4 border-t border-border/50 pt-4">
              {diasUteis} dia{diasUteis > 1 ? 's' : ''} útil{diasUteis > 1 ? 'eis' : ''} no período
            </p>
          </div>

          <div className="bg-card/80 border border-border shadow-lg rounded-3xl p-6 backdrop-blur-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Target className="h-16 w-16 text-primary" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Preenchimento</p>
            <div className="text-4xl md:text-5xl font-black text-foreground tracking-tighter">
              {(preenchimento * 100).toFixed(0)}%
            </div>
            <p className="text-sm font-medium text-muted-foreground mt-4 border-t border-border/50 pt-4">
              dias apontados vs. total possível
            </p>
          </div>

          <div className="bg-card/80 border border-border shadow-lg rounded-3xl p-6 backdrop-blur-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Trophy className="h-16 w-16 text-primary" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Melhor Área</p>
            <div className="text-3xl md:text-4xl font-black text-foreground tracking-tight truncate py-1">
              {topArea?.nome ?? '—'}
            </div>
            <p className="text-sm font-medium text-muted-foreground mt-3 border-t border-border/50 pt-4 flex items-center gap-2">
              <span className="text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded">
                {topArea ? `${(topArea.indice * 100).toFixed(1)}%` : '—'}
              </span>
              <span>índice médio</span>
            </p>
          </div>
        </div>

        {/* Resources Widgets */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 mb-8">
          {/* Main Charts */}
          <div className="xl:col-span-8 flex flex-col gap-8">
            <DailyProgressBlocks apontamentos={dailyApontamentos} selectedDate={selectedDate} />
            <HeatmapChart dados={heatmapData} />
          </div>

          {/* Side Widgets */}
          <div className="xl:col-span-4 flex flex-col gap-8">
            <div className="flex-1">
              <TopPerformers data={finalData} />
            </div>
            <div className="flex-1">
              <TopDemandas data={topDemandasData} />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-6 px-2">
            <h2 className="text-2xl font-bold tracking-tight">Desempenho da Equipe</h2>
          </div>
          <DashboardTable data={finalData} />
        </div>
      </div>
    </div>
  )
}
