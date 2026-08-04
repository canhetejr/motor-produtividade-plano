import { requireUser } from '@/lib/auth'
import { hoje } from '@/lib/dates'
import { createClient } from '@/utils/supabase/server'
import { ApontamentoForm } from './apontamento-form'
import { LoteForm } from './lote/lote-form'
import { DailyProgressBlocks } from '@/components/charts/daily-progress-blocks'
import { HeatmapChart } from '@/components/charts/heatmap-chart'
import { subDays, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

export default async function ApontamentoPage(props: {
  searchParams: Promise<{ date?: string; modo?: string }>
}) {
  const { user, profile } = await requireUser()
  const supabase = await createClient()
  const searchParams = await props.searchParams

  const todayIso = hoje()
  const selectedDate = searchParams.date || todayIso
  const emLote = searchParams.modo === 'lote'

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

  const tempoEntregueHoje =
    selectedDate === todayIso ? apontamentosDia.reduce((sum, a) => sum + a.tempo_total_min, 0) : 0

  const dataFormatada = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })

  return (
    <div className="flex min-h-full min-w-0 flex-col overflow-x-hidden bg-transparent p-4 md:p-8">
      <div className="mx-auto w-full max-w-7xl space-y-5">
        <header className="flex flex-col gap-4 border-b border-border/70 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-3xs font-medium uppercase tracking-[0.16em] text-primary">Rotina diária</p>
            <h1 className="mt-1 text-2xl font-medium tracking-tight text-foreground sm:text-3xl">Novo apontamento</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {emLote ? 'Registre várias atividades de uma vez.' : 'Registre o que foi concluído hoje.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-mono text-3xs uppercase tracking-[0.12em] text-muted-foreground capitalize">{dataFormatada}</p>
            <div className="flex h-9 items-center rounded-md border border-border bg-card p-1" aria-label="Modo de apontamento">
              <Button variant={emLote ? 'ghost' : 'default'} size="xs" render={<Link href="/apontamento" />}>
                Individual
              </Button>
              <Button variant={emLote ? 'default' : 'ghost'} size="xs" render={<Link href="/apontamento?modo=lote" />}>
                Em lote
              </Button>
            </div>
          </div>
        </header>

        {emLote ? (
          <div className="mx-auto w-full max-w-3xl">
            <LoteForm demandas={demandas} usuarioId={user.id} />
          </div>
        ) : (
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <ApontamentoForm
                demandas={demandas}
                cargaHorariaMin={profile.carga_horaria_min}
                tempoEntregueHoje={tempoEntregueHoje}
                usuarioId={user.id}
                catalogoHref={profile.role === 'gestor' ? '/gestao/catalogo' : '/minhas-demandas'}
                catalogoLabel={profile.role === 'gestor' ? 'Abrir catálogo e equipe' : 'Sugerir nova demanda'}
                compacto
              />
            </div>

            <div className="flex flex-col gap-6 lg:col-span-7">
              <DailyProgressBlocks
                apontamentos={apontamentosDia}
                selectedDate={selectedDate}
                cargaHorariaMin={profile.carga_horaria_min}
                compacto
              />
              <HeatmapChart dados={indicadores} compacto />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
