import { requireUser } from '@/lib/auth'
import { saudacao, hoje } from '@/lib/dates'
import { createClient } from '@/utils/supabase/server'
import { ApontamentoForm } from './apontamento-form'
import { DailyProgressBlocks } from '@/components/charts/daily-progress-blocks'
import { HeatmapChart } from '@/components/charts/heatmap-chart'
import { subDays, format } from 'date-fns'

export const dynamic = 'force-dynamic'

export default async function ApontamentoPage(props: {
  searchParams: Promise<{ date?: string }>
}) {
  const { profile } = await requireUser()
  const supabase = await createClient()
  const searchParams = await props.searchParams

  const todayIso = hoje()
  const selectedDate = searchParams.date || todayIso

  const [demandasRes, apontamentosRes, indicadoresRes] = await Promise.all([
    supabase
      .from('demandas')
      .select('id, nome, variavel, tempo_padrao_min, blocos_totais')
      .eq('ativo', true)
      .eq('area_id', profile.area_id ?? '')
      .order('nome'),
    
    supabase
      .from('apontamentos')
      .select('id, quantidade, demandas(nome)')
      .eq('colaborador_id', profile.id)
      .eq('data', selectedDate),
      
    supabase
      .from('indicadores_diarios')
      .select('data, indice')
      .eq('colaborador_id', profile.id)
      .gte('data', format(subDays(new Date(), 180), 'yyyy-MM-dd'))
      .lte('data', todayIso)
      .order('data', { ascending: true })
  ])

  const demandas = demandasRes.data
  const apontamentos = apontamentosRes.data || []
  // indicadores_diarios usa LEFT JOIN (migration 0002); colaborador sem
  // nenhum apontamento no período gera uma linha com data = null.
  const indicadores = (indicadoresRes.data ?? [])
    .filter((d): d is typeof d & { data: string } => d.data !== null)
    .map((d) => ({ data: d.data, indice: d.indice ?? 0 }))

  const primeiroNome = profile.nome.trim().split(' ')[0]

  return (
    <div className="relative flex flex-col min-h-[calc(100dvh-4rem)] p-4 overflow-x-hidden bg-background">
      {/* Background glow effects */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-primary/20 blur-[100px] rounded-full pointer-events-none -z-10" />
      <div className="fixed bottom-0 right-0 w-[400px] h-[400px] bg-primary/10 blur-[100px] rounded-full pointer-events-none -z-10" />

      <div className="w-full max-w-5xl mx-auto mt-8 mb-10 text-center relative z-10">
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4">
          {saudacao()},{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/60">
            {primeiroNome}
          </span>!
        </h1>
        <p className="text-muted-foreground text-lg md:text-xl font-medium max-w-2xl mx-auto">
          Registre sua produção e alcance suas metas.
        </p>
      </div>

      <div className="w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10 pb-12">
        <div className="lg:col-span-5">
          <ApontamentoForm demandas={demandas || []} />
        </div>
        
        <div className="lg:col-span-7 flex flex-col gap-6">
          <DailyProgressBlocks apontamentos={apontamentos} selectedDate={selectedDate} />
          <HeatmapChart dados={indicadores} />
        </div>
      </div>
    </div>
  )
}
