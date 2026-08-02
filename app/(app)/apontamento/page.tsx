import { requireUser } from '@/lib/auth'
import { saudacao, hoje } from '@/lib/dates'
import { createClient } from '@/utils/supabase/server'
import { ApontamentoForm } from './apontamento-form'
import { DailyProgressBlocks } from '@/components/charts/daily-progress-blocks'
import { HeatmapChart } from '@/components/charts/heatmap-chart'
import { subDays, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Sparkles, Calendar, UserCheck } from 'lucide-react'

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
      .select('id, nome, variavel, tempo_padrao_min, blocos_totais, finita')
      .eq('ativo', true)
      .eq('area_id', profile.area_id ?? '')
      .or('variavel.eq.true,tempo_padrao_min.not.is.null')
      .order('nome'),

    supabase
      .from('apontamentos_calculado')
      .select('id, quantidade, tempo_total_min, demandas(nome)')
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

  const demandasBrutas = demandasRes.data ?? []

  const idsFinitas = demandasBrutas.filter((d) => d.finita).map((d) => d.id)
  const acumuladoPorDemanda = new Map<string, number>()
  if (idsFinitas.length > 0) {
    const { data: acumulados } = await supabase
      .from('demandas_acumulado')
      .select('demanda_id, acumulado')
      .in('demanda_id', idsFinitas)
    for (const a of acumulados ?? []) acumuladoPorDemanda.set(a.demanda_id, a.acumulado)
  }

  const demandas = demandasBrutas
    .map((d) => ({
      ...d,
      blocos_restantes: d.finita ? d.blocos_totais - (acumuladoPorDemanda.get(d.id) ?? 0) : null,
    }))
    .filter((d) => d.blocos_restantes === null || d.blocos_restantes > 0)

  const apontamentosDia = (apontamentosRes.data ?? []).map((a) => ({
    id: a.id,
    quantidade: a.quantidade,
    tempo_total_min: a.tempo_total_min,
    demanda_nome: a.demandas?.nome ?? 'Desconhecida',
  }))

  const indicadores = (indicadoresRes.data ?? [])
    .filter((d): d is typeof d & { data: string } => d.data !== null)
    .map((d) => ({ data: d.data, indice: d.indice ?? 0 }))

  const primeiroNome = profile.nome.trim().split(' ')[0]

  const tempoEntregueHoje =
    selectedDate === todayIso ? apontamentosDia.reduce((sum, a) => sum + a.tempo_total_min, 0) : 0

  const dataFormatada = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })

  return (
    <div className="flex flex-col min-h-full min-w-0 overflow-x-hidden p-4 md:p-8 bg-background">
      <div className="w-full max-w-7xl mx-auto space-y-6">
        {/* Header Banner - Solid Colors, No Gradients */}
        <div className="bg-card border border-border shadow-xs rounded-xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold shrink-0">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>

            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                {saudacao()}, <span className="text-primary">{primeiroNome}</span>!
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Registre sua produção diária e acompanhe suas metas em tempo real.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-stretch sm:self-auto justify-between sm:justify-end border-t sm:border-t-0 border-border pt-3 sm:pt-0">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs font-semibold text-foreground">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span className="capitalize">{dataFormatada}</span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-xs font-bold text-primary">
              <UserCheck className="w-3.5 h-3.5" />
              <span>Ativo</span>
            </div>
          </div>
        </div>

        {/* Main Grid: Form Left, Progress & Calendar Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5">
            <ApontamentoForm
              demandas={demandas}
              cargaHorariaMin={profile.carga_horaria_min}
              tempoEntregueHoje={tempoEntregueHoje}
            />
          </div>

          <div className="lg:col-span-7 flex flex-col gap-6">
            <DailyProgressBlocks 
              apontamentos={apontamentosDia} 
              selectedDate={selectedDate} 
              cargaHorariaMin={profile.carga_horaria_min} 
            />
            <HeatmapChart dados={indicadores} />
          </div>
        </div>
      </div>
    </div>
  )
}
