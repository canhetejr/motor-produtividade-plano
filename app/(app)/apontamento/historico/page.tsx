import Link from 'next/link'
import { subDays, format } from 'date-fns'
import { requireUser } from '@/lib/auth'
import { hoje, formatarDataCompletaBR } from '@/lib/dates'
import { createClient } from '@/utils/supabase/server'
import { throwIfError } from '@/lib/supabase-error'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { HeatmapChart } from '@/components/charts/heatmap-chart'
import { HistoricoList } from './historico-list'
import { History } from 'lucide-react'
import { PageHeader, PageShell } from '@/components/layout/page-shell'

export const dynamic = 'force-dynamic'

export default async function HistoricoPage(props: {
  searchParams: Promise<{ date?: string }>
}) {
  const { user, profile } = await requireUser()
  const supabase = await createClient()
  const searchParams = await props.searchParams
  const selectedDate = searchParams?.date
  const todayIso = hoje()

  let apontamentosQuery = supabase
    .from('apontamentos_calculado')
    .select(`
      id,
      data,
      demanda_id,
      quantidade,
      tempo_manual_min,
      motivo,
      observacoes,
      tempo_total_min,
      demandas (nome)
    `)
    .eq('colaborador_id', user.id)

  if (selectedDate) {
    apontamentosQuery = apontamentosQuery.eq('data', selectedDate).order('created_at', { ascending: false })
  } else {
    apontamentosQuery = apontamentosQuery.order('created_at', { ascending: false }).limit(50)
  }

  const [{ data: apontamentos, error: apontamentosError }, { data: demandas }, { data: indicadoresRes }] = await Promise.all([
    apontamentosQuery,
    // Mesmas demandas disponíveis em /apontamento — usadas pelo dialog de
    // edição (Editar só existe pra lançamento de hoje, então a demanda
    // sempre precisa estar entre as ativas/válidas pra área do colaborador).
    supabase
      .from('demandas')
      .select('id, nome, variavel, tempo_padrao_min, blocos_totais')
      .eq('ativo', true)
      .eq('area_id', profile.area_id ?? '')
      .or('variavel.eq.true,tempo_padrao_min.not.is.null')
      .order('nome'),
    supabase
      .from('indicadores_diarios')
      .select('data, indice')
      .eq('colaborador_id', user.id)
      .gte('data', format(subDays(new Date(), 180), 'yyyy-MM-dd'))
      .lte('data', todayIso)
      .order('data', { ascending: true }),
  ])
  throwIfError(apontamentosError)

  const indicadores = (indicadoresRes ?? [])
    .filter((d): d is typeof d & { data: string } => d.data !== null)
    .map((d) => ({ data: d.data, indice: d.indice ?? 0 }))

  const formattedApontamentos = (apontamentos ?? [])
    .filter((a): a is typeof a & { id: string; data: string; demanda_id: string } =>
      a.id !== null && a.data !== null && a.demanda_id !== null
    )
    .map((a) => ({
      id: a.id,
      data: a.data,
      demanda_id: a.demanda_id,
      quantidade: a.quantidade ?? 0,
      tempo_manual_min: a.tempo_manual_min,
      motivo: a.motivo,
      observacoes: a.observacoes,
      tempo_total_min: a.tempo_total_min ?? 0,
      demanda_nome: a.demandas?.nome || 'Desconhecida',
    }))

  return (
    <PageShell width="content" contentClassName="space-y-6">
      <PageHeader
        title="Histórico de apontamentos"
        description="Acompanhe seu mapa de produtividade e gerencie os lançamentos realizados."
        icon={History}
        className="mb-0"
      />

      <HeatmapChart dados={indicadores} />

      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>
              {selectedDate ? `Lançamentos de ${formatarDataCompletaBR(selectedDate)}` : 'Seus Lançamentos Recentes'}
            </CardTitle>
            <CardDescription>
              {selectedDate
                ? 'Exibindo apontamentos salvos na data selecionada.'
                : 'Você só pode editar ou excluir apontamentos feitos no dia de hoje.'}
            </CardDescription>
          </div>
          {selectedDate && (
            <Link
              href="/apontamento/historico"
              className="text-xs font-semibold text-primary hover:underline bg-primary/10 px-3 py-1.5 rounded-md border border-primary/20"
            >
              Ver todos recentes
            </Link>
          )}
        </CardHeader>
        <CardContent>
          <HistoricoList
            apontamentos={formattedApontamentos}
            today={todayIso}
            demandas={demandas ?? []}
            cargaHorariaMin={profile.carga_horaria_min}
          />
        </CardContent>
      </Card>
    </PageShell>
  )
}
