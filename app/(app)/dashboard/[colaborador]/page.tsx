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
    .select('nome')
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
      .from('apontamentos')
      .select('id, quantidade, demandas(nome)')
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

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Link href="/dashboard" className="inline-flex items-center text-primary hover:underline mb-6">
        <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao Dashboard
      </Link>

      <h1 className="text-3xl font-bold mb-2">{colaboradorInfo.nome}</h1>
      <p className="text-muted-foreground mb-8">Estatísticas detalhadas do colaborador</p>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
        <div className="flex flex-col">
          <DailyProgressBlocks apontamentos={apontamentosSelecionados || []} selectedDate={selectedDate} />
          <HeatmapChart dados={heatmapData} />
        </div>

        <div className="bg-card border rounded-lg p-4 md:p-8 h-full flex flex-col">
          <div className="mb-6">
            <h3 className="text-lg font-bold tracking-tight">Série histórica de produtividade</h3>
            <p className="text-sm text-muted-foreground">Últimos 30 dias</p>
          </div>
          
          <div className="flex-1 min-h-[300px]">
            {chartData.length > 0 ? (
              <ColaboradorChart data={chartData} />
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                Sem dados de apontamento nos últimos 30 dias.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
