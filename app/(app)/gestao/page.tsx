import Link from 'next/link'
import { requireGestor } from '@/lib/auth'
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'

import { hoje, inicioSemana, inicioMes, diasUteisEntre, formatarDataBR } from '@/lib/dates'
import { janelaAnterior, comparavel, variacao, formatarVariacao } from '@/lib/comparativo'
import { resolverMeta } from '@/lib/metas'
import { createClient } from '@/utils/supabase/server'
import { DashboardFilters } from '../dashboard/dashboard-filters'
import { DashboardTable } from '../dashboard/dashboard-table'
import { PainelCapacidade } from '../dashboard/painel-capacidade'
import { HeatmapChart } from '@/components/charts/heatmap-chart'
import { DailyProgressBlocks } from '@/components/charts/daily-progress-blocks'
import { TopPerformers } from '../dashboard/top-performers'
import { TopDemandas } from '../dashboard/top-demandas'
import { EstadoBadge } from '@/components/ui/estado-badge'
import { subDays, parseISO, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Activity, Target, LayoutDashboard, Calendar, Clock, CheckCircle2 } from 'lucide-react'
import { PageHeader, PageShell } from '@/components/layout/page-shell'

export const dynamic = 'force-dynamic'

function formatarMinutosEmHoras(minutos: number) {
  const h = Math.floor(minutos / 60)
  const m = Math.round(minutos % 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export default async function GestaoVisaoGeralPage(props: {
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
    { data: metas },
    { data: areas },
    { data: colaboradores },
    { data: indicadores180 },
    { data: apontamentosDiarios },
    { data: apontamentosPeriodo },
    { data: cartoesData },
    { count: aprovacoesContagem },
    { data: aprovacoesData },
  ] = await Promise.all([
    // Metas entram no mesmo nivel: dependem so do que ja esta em maos.
    supabase.from('metas').select('colaborador_id, area_id, alvo, vigente_desde'),
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
    // count exato pro KPI — nao dá pra derivar de uma lista com .limit() sem
    // subcontar quando há mais pendências do que o limite mostra no painel.
    supabase.from('cartoes_aprovacoes').select('id', { count: 'exact', head: true }).eq('status', 'PENDENTE'),
    // Traz o suficiente pra linkar direto ao card que espera decisao — sem
    // isso o KPI e um numero que nao leva a lugar nenhum, e "precisa de
    // atencao" sem destino nao e diferente de so mostrar um numero.
    supabase
      .from('cartoes_aprovacoes')
      .select('id, cartao_id, cartoes(titulo, codigo, colunas(quadro_id, quadros(nome)))')
      .eq('status', 'PENDENTE')
      .order('criado_em', { ascending: true })
      .limit(5),
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
      const meta = resolverMeta(metas ?? [], c.id, c.area_id, todayIso)
      return {
        colaborador_id: c.id,
        nome: c.nome,
        carga_total: cargaPeriodo,
        tempo_total: e?.tempo ?? 0,
        dias_apontados: e?.dias.size ?? 0,
        dias_uteis: diasUteis,
        indice: cargaPeriodo > 0 ? (e?.tempo ?? 0) / cargaPeriodo : 0,
        meta: meta.alvo,
        metaOrigem: meta.origem,
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
  const aprovacoesPendentes = aprovacoesContagem ?? 0
  type AprovacaoPendente = { id: string; titulo: string; codigo: string | null; quadroId: string; quadroNome: string }
  const aprovacoesLista: AprovacaoPendente[] = (aprovacoesData ?? []).flatMap((a) => {
    const cartao = Array.isArray(a.cartoes) ? a.cartoes[0] : a.cartoes
    const coluna = cartao && (Array.isArray(cartao.colunas) ? cartao.colunas[0] : cartao.colunas)
    const quadro = coluna && (Array.isArray(coluna.quadros) ? coluna.quadros[0] : coluna.quadros)
    // Sem quadroId nao ha pra onde linkar — melhor omitir da lista do que
    // linkar pro lugar errado.
    if (!cartao || !coluna?.quadro_id) return []
    return [{
      id: a.cartao_id,
      titulo: cartao.titulo,
      codigo: cartao.codigo,
      quadroId: coluna.quadro_id,
      quadroNome: quadro?.nome ?? '',
    }]
  })

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
    <PageShell contentClassName="space-y-6">
        <PageHeader
          title="Visão geral da equipe"
          description="Acompanhe produtividade, entregas e pontos que precisam de atenção."
          icon={LayoutDashboard}
          level={2}
          className="mb-0"
          actions={
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs font-semibold text-foreground">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span className="capitalize">{dataFormatada}</span>
            </div>
          }
        />

        {/* Dashboard Filters */}
        <div>
          <DashboardFilters
            areas={areas || []}
            currentPeriod={period}
            currentArea={areaFilter}
          />
        </div>

        {/* Precisa de atencao agora — nivel 1 da hierarquia de decisao.
            So aparece quando ha algo de fato pendente: uma secao vazia todo
            dia treina o olho a ignora-la, e no dia que importar ninguem olha. */}
        {aprovacoesPendentes > 0 && (
          <div className="animate-entrada-atencao rounded-xl border border-warning-borda bg-warning-superficie p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <EstadoBadge estado="atencao" icone={AlertTriangle}>
                  {aprovacoesPendentes === 1 ? '1 aprovação pendente' : `${aprovacoesPendentes} aprovações pendentes`}
                </EstadoBadge>
              </div>
            </div>
            <ul className="mt-3 flex flex-col gap-1.5">
              {aprovacoesLista.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/kanban/${a.quadroId}?cartao=${a.id}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 text-sm transition-colors hover:border-warning-borda"
                  >
                    <span className="min-w-0 truncate">
                      {a.codigo && <span className="mr-1.5 font-mono text-3xs text-muted-foreground">{a.codigo}</span>}
                      {a.titulo}
                    </span>
                    <span className="shrink-0 truncate text-3xs text-muted-foreground">{a.quadroNome}</span>
                  </Link>
                </li>
              ))}
            </ul>
            {aprovacoesPendentes > aprovacoesLista.length && (
              <p className="mt-2 text-3xs text-muted-foreground">
                e mais {aprovacoesPendentes - aprovacoesLista.length}.
              </p>
            )}
          </div>
        )}

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
                  <div className="text-3xl font-semibold text-foreground">
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
              <div className="text-3xl font-semibold text-foreground">
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
                <div className="text-3xl font-semibold text-foreground">
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

          {/* KPI 4: ADESAO. Pendencias saiu daqui — mora agora no painel de
              atencao, no topo, com link direto pro card. Repetir o numero aqui
              seria a mesma informacao em dois lugares, um deles sem acao. */}
          <div className="bg-card border border-border/80 shadow-xs rounded-xl p-5 flex flex-col justify-between hover:border-amber-500/50 transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold text-muted-foreground uppercase tracking-wider">Adesão</span>
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20 group-hover:scale-105 transition-transform">
                <Target className="h-5 w-5" />
              </div>
            </div>
            <div className="my-3">
              <div className="flex items-baseline gap-2">
                <div className="text-3xl font-semibold text-foreground">
                  {(preenchimento * 100).toFixed(0)}%
                </div>
                <span className="text-xs text-muted-foreground font-medium">preenchimento</span>
              </div>
            </div>
            <div className="text-2xs text-muted-foreground pt-2.5 border-t border-border/60">
              Dias com apontamento sobre o total de dias úteis do período.
            </div>
          </div>
        </div>

        {/* Nivel 2/3: como esta o andamento, e onde estao os gargalos. Um
            rotulo de secao, nao um card novo — os graficos ja respondem cada
            um a sua pergunta, o que faltava era dizer que pergunta e essa. */}
        <div>
          <h2 className="mb-3 text-base font-semibold text-foreground">
            Andamento e gargalos
          </h2>
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
        </div>

        {/* Nivel 4: quem esta em risco — sobrecarregado ou com folga. */}
        {!semExpectativa && (
          <div>
            <h2 className="mb-3 text-base font-semibold text-foreground">
              Risco da equipe
            </h2>
            {/* Capacidade: separa quem esta acima da conta de quem esta com folga —
                as duas pontas que o indice medio achata num numero so. */}
            <PainelCapacidade cargas={finalData} />
          </div>
        )}

        {/* Nivel 5: a acao — o detalhe por pessoa que embasa uma decisao
            (redistribuir, conversar, elogiar). Fica por ultimo de proposito:
            e onde se aterrissa depois de ver o resumo acima. */}
        <div className="space-y-3 pb-8">
          <h2 className="mb-1 text-base font-semibold text-foreground">
            Decisão por pessoa
          </h2>
          <div className="flex items-center gap-2 px-1">
            <h3 className="text-sm text-muted-foreground">Compare os resultados individuais antes de agir.</h3>
          </div>
          <DashboardTable data={finalData} semExpectativa={semExpectativa} />
        </div>
    </PageShell>
  )
}
