import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireGestor } from '@/lib/auth'
import { hoje, formatarDataBR } from '@/lib/dates'
import { createClient } from '@/utils/supabase/server'
import { throwIfError } from '@/lib/supabase-error'
import { subDays, parseISO, format } from 'date-fns'
import { ColaboradorChart } from '../../../dashboard/[colaborador]/colaborador-chart'
import { DailyProgressBlocks } from '@/components/charts/daily-progress-blocks'
import { HeatmapChart } from '@/components/charts/heatmap-chart'
import { UserRound } from 'lucide-react'
import { PageHeader, PageShell } from '@/components/layout/page-shell'

export const dynamic = 'force-dynamic'

export default async function ColaboradorPage(
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
    <PageShell>
        <PageHeader
          title={colaboradorInfo.nome}
          description="Estatísticas detalhadas e histórico de produtividade do colaborador."
          icon={UserRound}
          level={2}
          back={
            <Link href="/gestao" className="inline-flex items-center text-xs font-semibold text-primary hover:underline transition-colors">
              <ArrowLeft className="mr-1.5 size-4" /> Voltar à visão geral
            </Link>
          }
        />

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
    </PageShell>
  )
}
