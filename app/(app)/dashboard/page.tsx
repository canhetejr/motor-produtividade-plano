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
  
  // Sábado/domingo: garante denominador mínimo de 1 dia (só acontece com
  // período "Hoje" caindo num dia não útil — os demais períodos sempre
  // cobrem pelo menos um dia útil por construção)
  const diasUteisRaw = diasUteisEntre(startIso, todayIso)
  const diasUteis = Math.max(1, diasUteisRaw)
  const semExpectativa = diasUteisRaw === 0

  const startIso180 = format(subDays(parseISO(todayIso), 180), 'yyyy-MM-dd')

  const [{ data: areas }, { data: colaboradores }, { data: indicadores180 }, { data: apontamentosDiarios }, { data: apontamentosPeriodo }] = await Promise.all([
    supabase.from('areas').select('id, nome').order('nome'),
    supabase
      .from('colaboradores')
      .select('id, nome, area_id, carga_horaria_min')
      .eq('ativo', true)
      .eq('role', 'colaborador') // gestor não entra nas métricas de produtividade
      .order('nome'),
    supabase
      .from('indicadores_diarios')
      .select('colaborador_id, data, tempo_entregue_min, indice')
      .gte('data', startIso180)
      .lte('data', todayIso),
    supabase
      .from('apontamentos_calculado')
      .select('id, quantidade, colaborador_id, tempo_total_min, demandas(nome)')
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
  // Ponderado por carga horária (soma tempo entregue / soma carga), não média
  // simples dos índices individuais — senão 1 pessoa em 150% pesa igual a
  // 1 pessoa em 40%, mascarando o desempenho agregado real do grupo.
  const somaTempoGeral = finalData.reduce((acc, d) => acc + d.tempo_total, 0)
  const somaCargaGeral = finalData.reduce((acc, d) => acc + d.carga_total, 0)
  const mediaIndice = somaCargaGeral > 0 ? somaTempoGeral / somaCargaGeral : 0
  const totalDiasPossiveis = finalData.length * diasUteis
  const preenchimento =
    totalDiasPossiveis > 0
      ? finalData.reduce((acc, d) => acc + d.dias_apontados, 0) / totalDiasPossiveis
      : 0

  const indicePorArea = new Map<string, { tempo: number; carga: number }>()
  for (const c of colaboradores ?? []) {
    if (!c.area_id) continue
    const d = finalData.find((f) => f.colaborador_id === c.id)
    if (!d) continue
    const cur = indicePorArea.get(c.area_id) ?? { tempo: 0, carga: 0 }
    cur.tempo += d.tempo_total
    cur.carga += d.carga_total
    indicePorArea.set(c.area_id, cur)
  }
  let topArea: { nome: string; indice: number } | null = null
  for (const [areaId, { tempo, carga }] of indicePorArea) {
    const media = carga > 0 ? tempo / carga : 0
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

  // Daily Progress Aggregation — soma o tempo entregue pelo time no dia
  // selecionado, contra a meta = soma da carga horária dos colaboradores do
  // filtro (capacidade do time no dia).
  const dailyApontamentos = (apontamentosDiarios ?? [])
    .filter((ap) => validColabIds.has(ap.colaborador_id))
    .map((ap) => ({
      id: ap.id,
      quantidade: ap.quantidade,
      tempo_total_min: ap.tempo_total_min,
      demanda_nome: ap.demandas?.nome ?? 'Desconhecida',
    }))
  const metaDiaEquipe = (colaboradores ?? [])
    .filter((c) => validColabIds.has(c.id))
    .reduce((acc, c) => acc + c.carga_horaria_min, 0)

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
    <div className="relative flex flex-col min-h-[calc(100dvh-4rem)] p-4 md:p-8 overflow-x-hidden bg-background">
      {/* Ambient background glow */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-primary/10 blur-[120px] rounded-full pointer-events-none -z-10" />
      <div className="fixed bottom-0 right-0 w-[400px] h-[400px] bg-primary/5 blur-[100px] rounded-full pointer-events-none -z-10" />

      <div className="w-full max-w-7xl mx-auto relative z-10">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Dashboard <span className="text-primary">Gerencial</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Acompanhamento consolidado de produtividade e entregas da equipe.
          </p>
        </div>

        <div className="mb-8">
          <DashboardFilters
            areas={areas || []}
            currentPeriod={period}
            currentArea={areaFilter}
          />
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          <div className="bg-card border border-border shadow-xs rounded-none p-5 flex flex-col justify-between hover:border-primary/40 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Índice Médio</span>
              <div className="p-2 rounded-none bg-primary/10 text-primary border border-primary/20">
                <Activity className="h-5 w-5" />
              </div>
            </div>
            <div className="my-3">
              {semExpectativa ? (
                <div className="text-sm font-medium text-muted-foreground">
                  Nenhum dia útil no período
                </div>
              ) : (
                <div className="text-3xl font-extrabold text-foreground tracking-tight">
                  {(mediaIndice * 100).toFixed(1)}%
                </div>
              )}
            </div>
            <div className="text-xs text-muted-foreground pt-3 border-t border-border flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-none bg-primary" />
              {diasUteis} dia{diasUteis > 1 ? 's' : ''} útil{diasUteis > 1 ? 'eis' : ''} no período
            </div>
          </div>

          <div className="bg-card border border-border shadow-xs rounded-none p-5 flex flex-col justify-between hover:border-primary/40 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Preenchimento</span>
              <div className="p-2 rounded-none bg-secondary text-foreground border border-border">
                <Target className="h-5 w-5" />
              </div>
            </div>
            <div className="my-3">
              <div className="text-3xl font-extrabold text-foreground tracking-tight">
                {(preenchimento * 100).toFixed(0)}%
              </div>
            </div>
            <div className="text-xs text-muted-foreground pt-3 border-t border-border">
              Apontamentos realizados vs. total possível
            </div>
          </div>

          <div className="bg-card border border-border shadow-xs rounded-none p-5 flex flex-col justify-between hover:border-primary/40 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Melhor Área</span>
              <div className="p-2 rounded-none bg-amber-500/10 text-amber-600 border border-amber-500/20">
                <Trophy className="h-5 w-5" />
              </div>
            </div>
            <div className="my-3">
              <div className="text-2xl font-bold text-foreground tracking-tight truncate">
                {topArea?.nome ?? '—'}
              </div>
            </div>
            <div className="text-xs text-muted-foreground pt-3 border-t border-border flex items-center gap-2">
              <span className="text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-none border border-emerald-500/20">
                {topArea ? `${(topArea.indice * 100).toFixed(1)}%` : '—'}
              </span>
              <span>índice médio da área</span>
            </div>
          </div>
        </div>

        {/* Resources Widgets */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 mb-8">
          {/* Main Charts */}
          <div className="xl:col-span-8 flex flex-col gap-8">
            <DailyProgressBlocks apontamentos={dailyApontamentos} selectedDate={selectedDate} cargaHorariaMin={metaDiaEquipe} />
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
          <div className="flex items-center gap-3 mb-4 px-1">
            <h2 className="text-xl font-bold tracking-tight text-foreground">Desempenho da Equipe</h2>
          </div>
          <DashboardTable data={finalData} semExpectativa={semExpectativa} />
        </div>
      </div>
    </div>
  )
}
