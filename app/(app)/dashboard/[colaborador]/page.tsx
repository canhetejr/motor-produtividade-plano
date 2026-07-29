import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireGestor } from '@/lib/auth'
import { hoje, formatarDataBR } from '@/lib/dates'
import { createClient } from '@/utils/supabase/server'
import { throwIfError } from '@/lib/supabase-error'
import { subDays, parseISO, format } from 'date-fns'
import { ColaboradorChart } from './colaborador-chart'
import { DailyProgressBlocks } from '@/components/charts/daily-progress-blocks'
import { HeatmapChart } from '@/components/charts/heatmap-chart'

export const dynamic = 'force-dynamic'

export default async function ColaboradorDashboardPage(
  props: { 
    params: Promise<{ colaborador: string }>,
    searchParams: Promise<{ date?: string }>
  }
) {
  await requireGestor()
  const params = await props.params
  const searchParams = await props.searchParams
  const supabase = await createClient()

  const colaboradorId = params.colaborador
  const todayIso = hoje()
  const selectedDate = searchParams.date || todayIso

  const { data: colaboradorInfo, error: colaboradorInfoError } = await supabase
    .from('colaboradores')
    .select('nome, carga_horaria_min')
    .eq('id', colaboradorId)
    .single()

  if (colaboradorInfoError && colaboradorInfoError.code !== 'PGRST116') {
    throwIfError(colaboradorInfoError)
  }
  if (!colaboradorInfo) {
    notFound()
  }

  const startIso30 = format(subDays(parseISO(todayIso), 30), 'yyyy-MM-dd')
  const startIso180 = format(subDays(parseISO(todayIso), 180), 'yyyy-MM-dd')

  const [
    { data: apontamentosSelecionados, error: apontamentosError },
    { data: indicadores30, error: indicadores30Error },
    { data: indicadores180, error: indicadores180Error },
  ] = await Promise.all([
    supabase
      .from('apontamentos_calculado')
      .select('id, quantidade, tempo_total_min, demandas(nome)')
      .eq('colaborador_id', colaboradorId)
      .eq('data', selectedDate),

    supabase
      .from('indicadores_diarios')
      .select('data, tempo_entregue_min, carga_horaria_min, indice')
      .eq('colaborador_id', colaboradorId)
      .gte('data', startIso30)
      .lte('data', todayIso)
      .order('data', { ascending: true }),

    supabase
      .from('indicadores_diarios')
      .select('data, indice')
      .eq('colaborador_id', colaboradorId)
      .gte('data', startIso180)
      .lte('data', todayIso)
      .order('data', { ascending: true })
  ])
  throwIfError(apontamentosError, indicadores30Error, indicadores180Error)

  const chartData = (indicadores30 ?? [])
    .filter((d): d is typeof d & { data: string } => d.data !== null)
    .map((d) => ({
      data: formatarDataBR(d.data),
      indice: Number(((d.indice ?? 0) * 100).toFixed(1)),
      esperado: 100,
    }))

  // indicadores_diarios usa LEFT JOIN (migration 0002); colaborador sem
  // nenhum apontamento no período gera uma linha com data = null.
  const heatmapData = (indicadores180 ?? [])
    .filter((d): d is typeof d & { data: string } => d.data !== null)
    .map((d) => ({ data: d.data, indice: d.indice ?? 0 }))

  const apontamentosDia = (apontamentosSelecionados ?? []).map((a) => ({
    id: a.id,
    quantidade: a.quantidade,
    tempo_total_min: a.tempo_total_min,
    demanda_nome: a.demandas?.nome ?? 'Desconhecida',
  }))

  return (
    <div className="relative flex flex-col min-h-[calc(100dvh-4rem)] p-4 md:p-8 overflow-x-hidden bg-background">
      {/* Ambient background glow */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-primary/10 blur-[120px] rounded-full pointer-events-none -z-10" />
      <div className="fixed bottom-0 right-0 w-[400px] h-[400px] bg-primary/5 blur-[100px] rounded-full pointer-events-none -z-10" />

      <div className="w-full max-w-7xl mx-auto relative z-10">
        <Link href="/dashboard" className="inline-flex items-center text-xs font-semibold text-primary hover:underline mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Voltar ao Dashboard
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            {colaboradorInfo.nome}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Estatísticas detalhadas e histórico de produtividade do colaborador.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
          <div className="flex flex-col gap-8">
            <DailyProgressBlocks apontamentos={apontamentosDia} selectedDate={selectedDate} cargaHorariaMin={colaboradorInfo.carga_horaria_min} />
            <HeatmapChart dados={heatmapData} />
          </div>

          <div className="bg-card border border-border rounded-md p-6 h-full flex flex-col shadow-xs">
            <div className="mb-5 pb-4 border-b border-border">
              <h3 className="text-lg font-bold tracking-tight text-foreground">Série histórica de produtividade</h3>
              <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
            </div>
            
            <div className="flex-1 min-h-[300px]">
              {chartData.length > 0 ? (
                <ColaboradorChart data={chartData} />
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground italic bg-secondary/30 rounded-md border border-dashed border-border py-8">
                  Sem dados de apontamento nos últimos 30 dias.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
