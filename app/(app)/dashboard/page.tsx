import { requireGestor } from '@/lib/auth'
import { TrendingUp, TrendingDown } from 'lucide-react'

import { hoje, inicioSemana, inicioMes, diasUteisEntre, formatarDataBR } from '@/lib/dates'
import { janelaAnterior, comparavel, variacao, formatarVariacao } from '@/lib/comparativo'
import { createClient } from '@/utils/supabase/server'
import { DashboardFilters } from './dashboard-filters'
import { DashboardTable } from './dashboard-table'
import { HeatmapChart } from '@/components/charts/heatmap-chart'
import { DailyProgressBlocks } from '@/components/charts/daily-progress-blocks'
import { TopPerformers } from './top-performers'
import { TopDemandas } from './top-demandas'
import { subDays, parseISO, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Activity, Target, LayoutDashboard, Calendar, Clock, CheckCircle2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

function formatarMinutosEmHoras(minutos: number) {
  const h = Math.floor(minutos / 60)
  const m = Math.round(minutos % 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

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

  const diasUteisRaw = diasUteisEntre(startIso, todayIso)
  const diasUteis = Math.max(1, diasUteisRaw)
  const semExpectativa = diasUteisRaw === 0

  const startIso180 = format(subDays(parseISO(todayIso), 180), 'yyyy-MM-dd')

  const [
    { data: areas },
    { data: colaboradores },
    { data: indicadores180 },
    { data: apontamentosDiarios },
    { data: apontamentosPeriodo },
    { data: cartoesData },
    { data: aprovacoesData },
  ] = await Promise.all([
    supabase.from('areas').select('id, nome').order('nome'),
    supabase
      .from('colaboradores')
      .select('id, nome, area_id, carga_horaria_min')
      .eq('ativo', true)
      .eq('role', 'colaborador')
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
    supabase.from('cartoes').select('id, entregue_em, created_at'),
    supabase.from('cartoes_aprovacoes').select('id, status').eq('status', 'PENDENTE'),
  ])

  const validColabIds = new Set(
    (colaboradores ?? [])
      .filter((c) => areaFilter === 'all' || c.area_id === areaFilter)
      .map((c) => c.id)
  )

  const indicadoresPeriodo = (indicadores180 ?? []).filter(
    (ind): ind is typeof ind & { data: string } => ind.data !== null && ind.data >= startIso
  )

  const entregue = new Map<string, { tempo: number; dias: Set<string> }>()
  for (const ind of indicadoresPeriodo) {
    const cur = entregue.get(ind.colaborador_id) ?? { tempo: 0, dias: new Set<string>() }
    cur.tempo += ind.tempo_entregue_min
    if (ind.data) cur.dias.add(ind.data)
    entregue.set(ind.colaborador_id, cur)
  }

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

  const somaTempoGeral = finalData.reduce((acc, d) => acc + d.tempo_total, 0)
  const somaCargaGeral = finalData.reduce((acc, d) => acc + d.carga_total, 0)
  const mediaIndice = somaCargaGeral > 0 ? somaTempoGeral / somaCargaGeral : 0

  // Comparativo com o período anterior de mesmo tamanho. Sai do mesmo
  // indicadores180 que já está em memória — nenhuma consulta a mais.
  const janelaAtual = { inicio: startIso, fim: todayIso }
  const janelaPassada = janelaAnterior(janelaAtual)
  // Comparar os últimos 180 dias exigiria 360 de dado. Sem a janela inteira o
  // número seria uma queda que é só falta de registro — não se mostra.
  const temComparativo = comparavel(janelaPassada, startIso180)

  let variacaoIndice: number | null = null
  if (temComparativo) {
    const doPeriodoAnterior = (indicadores180 ?? []).filter(
      (ind) => ind.data !== null && ind.data >= janelaPassada.inicio && ind.data <= janelaPassada.fim
    )
    const tempoAnterior = doPeriodoAnterior.reduce((acc, ind) => acc + ind.tempo_entregue_min, 0)
    // A carga da janela anterior usa os mesmos dias úteis e os mesmos
    // colaboradores: comparar com quadro de pessoal diferente mediria a
    // equipe, não a produtividade.
    const cargaAnterior = diasUteisEntre(janelaPassada.inicio, janelaPassada.fim) > 0
      ? Math.max(1, diasUteisEntre(janelaPassada.inicio, janelaPassada.fim)) *
        finalData.reduce((acc, d) => acc + d.carga_total / Math.max(1, d.dias_uteis), 0)
      : 0
    const indiceAnterior = cargaAnterior > 0 ? tempoAnterior / cargaAnterior : 0
    variacaoIndice = variacao(mediaIndice, indiceAnterior)
  }
  const totalDiasPossiveis = finalData.length * diasUteis
  const preenchimento =
    totalDiasPossiveis > 0
      ? finalData.reduce((acc, d) => acc + d.dias_apontados, 0) / totalDiasPossiveis
      : 0

  const totalCartoes = cartoesData?.length ?? 0
  const cartoesEntregues = cartoesData?.filter((c) => !!c.entregue_em).length ?? 0
  const taxaConclusao = totalCartoes > 0 ? cartoesEntregues / totalCartoes : 0
  const aprovacoesPendentes = aprovacoesData?.length ?? 0

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

  const dataFormatada = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })

  return (
    <div className="flex flex-col min-h-full min-w-0 overflow-x-hidden p-4 md:p-8 bg-background">
      <div className="w-full max-w-7xl mx-auto space-y-6">
        {/* Header Banner */}
        <div className="bg-card border border-border shadow-xs rounded-xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold shrink-0">
              <LayoutDashboard className="w-5 h-5 text-primary" />
            </div>

            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Dashboard <span className="text-primary">Gerencial</span>
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Acompanhamento consolidado de produtividade, entregas e métricas da equipe.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-stretch sm:self-auto justify-between sm:justify-end border-t sm:border-t-0 border-border pt-3 sm:pt-0">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs font-semibold text-foreground">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span className="capitalize">{dataFormatada}</span>
            </div>
          </div>
        </div>

        {/* Dashboard Filters */}
        <div>
          <DashboardFilters
            areas={areas || []}
            currentPeriod={period}
            currentArea={areaFilter}
          />
        </div>

        {/* Stat Cards - 4 KPI Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* KPI 1: ÍNDICE MÉDIO DE PRODUTIVIDADE */}
          <div className="bg-card border border-border/80 shadow-xs rounded-xl p-5 flex flex-col justify-between hover:border-primary/50 transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold text-muted-foreground uppercase tracking-wider">Índice Médio</span>
              <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20 group-hover:scale-105 transition-transform">
                <Activity className="h-5 w-5" />
              </div>
            </div>
            <div className="my-3">
              {semExpectativa ? (
                <div className="text-sm font-medium text-muted-foreground">Sem dias úteis no período</div>
              ) : (
                <div className="flex items-baseline gap-2">
                  <div className="text-3xl font-black text-foreground tracking-tight">
                    {(mediaIndice * 100).toFixed(1)}%
                  </div>
                  <span className={`text-2xs font-bold px-1.5 py-0.5 rounded border ${
                    mediaIndice >= 1 ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                  }`}>
                    {mediaIndice >= 1 ? 'Meta ok' : 'Abaixo meta'}
                  </span>
                  {/* Variação contra o período anterior de mesmo tamanho. Só
                      aparece quando a janela anterior cabe inteira no dado
                      carregado — parcial mostraria uma queda que é só falta de
                      registro. */}
                  {formatarVariacao(variacaoIndice) && (
                    <span
                      title={`Contra ${formatarDataBR(janelaPassada.inicio)} – ${formatarDataBR(janelaPassada.fim)}`}
                      className={`inline-flex items-center gap-0.5 text-2xs font-bold ${
                        (variacaoIndice ?? 0) > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : (variacaoIndice ?? 0) < 0
                            ? 'text-danger'
                            : 'text-muted-foreground'
                      }`}
                    >
                      {(variacaoIndice ?? 0) > 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (variacaoIndice ?? 0) < 0 ? (
                        <TrendingDown className="h-3 w-3" />
                      ) : null}
                      {formatarVariacao(variacaoIndice)}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="text-2xs text-muted-foreground pt-2.5 border-t border-border/60 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              <span>{diasUteis} dia{diasUteis > 1 ? 's' : ''} útil{diasUteis > 1 ? 'eis' : ''} contabilizado{diasUteis > 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* KPI 2: HORAS TRABALHADAS / APONTADAS */}
          <div className="bg-card border border-border/80 shadow-xs rounded-xl p-5 flex flex-col justify-between hover:border-emerald-500/50 transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold text-muted-foreground uppercase tracking-wider">Horas Apontadas</span>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 group-hover:scale-105 transition-transform">
                <Clock className="h-5 w-5" />
              </div>
            </div>
            <div className="my-3">
              <div className="text-3xl font-black text-foreground tracking-tight">
                {formatarMinutosEmHoras(somaTempoGeral)}
              </div>
            </div>
            <div className="text-2xs text-muted-foreground pt-2.5 border-t border-border/60 flex items-center justify-between">
              <span>Carga esperada:</span>
              <span className="font-mono font-bold text-foreground">{formatarMinutosEmHoras(somaCargaGeral)}</span>
            </div>
          </div>

          {/* KPI 3: VAZÃO E ENTREGAS DO KANBAN */}
          <div className="bg-card border border-border/80 shadow-xs rounded-xl p-5 flex flex-col justify-between hover:border-blue-500/50 transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold text-muted-foreground uppercase tracking-wider">Vazão Kanban</span>
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20 group-hover:scale-105 transition-transform">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>
            <div className="my-3">
              <div className="flex items-baseline gap-2">
                <div className="text-3xl font-black text-foreground tracking-tight">
                  {cartoesEntregues}
                </div>
                <span className="text-xs text-muted-foreground font-semibold">/ {totalCartoes} cards</span>
              </div>
            </div>
            <div className="text-2xs text-muted-foreground pt-2.5 border-t border-border/60 flex items-center justify-between">
              <span>Taxa de entrega:</span>
              <span className="font-bold text-blue-500 font-mono">{(taxaConclusao * 100).toFixed(0)}%</span>
            </div>
          </div>

          {/* KPI 4: ADESÃO E PENDÊNCIAS */}
          <div className="bg-card border border-border/80 shadow-xs rounded-xl p-5 flex flex-col justify-between hover:border-amber-500/50 transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold text-muted-foreground uppercase tracking-wider">Adesão & Pendências</span>
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20 group-hover:scale-105 transition-transform">
                <Target className="h-5 w-5" />
              </div>
            </div>
            <div className="my-3">
              <div className="flex items-baseline gap-2">
                <div className="text-3xl font-black text-foreground tracking-tight">
                  {(preenchimento * 100).toFixed(0)}%
                </div>
                <span className="text-xs text-muted-foreground font-medium">preenchimento</span>
              </div>
            </div>
            <div className="text-2xs text-muted-foreground pt-2.5 border-t border-border/60 flex items-center justify-between">
              <span>Aprovações pendentes:</span>
              <span className={`font-bold px-1.5 py-0.5 rounded text-3xs ${
                aprovacoesPendentes > 0 ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' : 'text-muted-foreground'
              }`}>
                {aprovacoesPendentes} aguardando
              </span>
            </div>
          </div>
        </div>

        {/* Main Charts & Side Widgets Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-8 flex flex-col gap-6">
            <DailyProgressBlocks apontamentos={dailyApontamentos} selectedDate={selectedDate} cargaHorariaMin={metaDiaEquipe} />
            <HeatmapChart dados={heatmapData} />
          </div>

          <div className="xl:col-span-4 flex flex-col gap-6">
            <div className="flex-1">
              <TopPerformers data={finalData} />
            </div>
            <div className="flex-1">
              <TopDemandas data={topDemandasData} />
            </div>
          </div>
        </div>

        {/* Team Performance Table */}
        <div className="space-y-3 pb-8">
          <div className="flex items-center gap-2 px-1">
            <h2 className="text-lg font-bold tracking-tight text-foreground">Desempenho da Equipe</h2>
          </div>
          <DashboardTable data={finalData} semExpectativa={semExpectativa} />
        </div>
      </div>
    </div>
  )
}
