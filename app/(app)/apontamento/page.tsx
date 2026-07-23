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
      .select('id, nome, variavel, tempo_padrao_min, blocos_totais, finita')
      .eq('ativo', true)
      .eq('area_id', profile.area_id ?? '')
      // Esconde demanda "pendente" (fixa sem tempo padrão): apontá-la valeria
      // 0 min. Variável não precisa de tempo padrão, então continua aparecendo.
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

  // Acumulado GLOBAL (todos os colaboradores) só precisa ser buscado pras
  // demandas finitas — evita query extra quando a área não usa bloco finito.
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
    // Demanda finita esgotada (por qualquer colaborador) some do seletor —
    // não há mais bloco pra apontar nela.
    .filter((d) => d.blocos_restantes === null || d.blocos_restantes > 0)

  const apontamentosDia = (apontamentosRes.data ?? []).map((a) => ({
    id: a.id,
    quantidade: a.quantidade,
    tempo_total_min: a.tempo_total_min,
    demanda_nome: a.demandas?.nome ?? 'Desconhecida',
  }))
  // indicadores_diarios usa LEFT JOIN (migration 0002); colaborador sem
  // nenhum apontamento no período gera uma linha com data = null.
  const indicadores = (indicadoresRes.data ?? [])
    .filter((d): d is typeof d & { data: string } => d.data !== null)
    .map((d) => ({ data: d.data, indice: d.indice ?? 0 }))

  const primeiroNome = profile.nome.trim().split(' ')[0]

  // O form sempre lança pra hoje (RPC força current_date), então o
  // acumulado só faz sentido quando a tela está mostrando hoje — se o
  // colaborador estiver navegando pra outro dia via ?date=, o preview do
  // form ainda é sobre hoje, mas não temos o total de hoje carregado aqui.
  const tempoEntregueHoje =
    selectedDate === todayIso ? apontamentosDia.reduce((sum, a) => sum + a.tempo_total_min, 0) : 0

  return (
    <div className="flex flex-col min-h-[calc(100dvh-4rem)] p-4 md:p-8 bg-background">
      <div className="w-full max-w-7xl mx-auto mb-8">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
          {saudacao()}, <span className="text-primary">{primeiroNome}</span>!
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Registre sua produção diária e acompanhe suas metas.
        </p>
      </div>

      <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 pb-12 items-start">
        <div className="lg:col-span-5">
          <ApontamentoForm
            demandas={demandas}
            cargaHorariaMin={profile.carga_horaria_min}
            tempoEntregueHoje={tempoEntregueHoje}
          />
        </div>
        
        <div className="lg:col-span-7 flex flex-col gap-6">
          <DailyProgressBlocks apontamentos={apontamentosDia} selectedDate={selectedDate} cargaHorariaMin={profile.carga_horaria_min} />
          <HeatmapChart dados={indicadores} />
        </div>
      </div>
    </div>
  )
}
