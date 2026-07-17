import { requireGestor } from '@/lib/auth'
import { hoje, inicioSemana, inicioMes, diasUteisEntre } from '@/lib/dates'
import { createClient } from '@/utils/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DashboardFilters } from './dashboard-filters'
import { DashboardTable } from './dashboard-table'

export const dynamic = 'force-dynamic'

export default async function DashboardPage(props: {
  searchParams: Promise<{ period?: string; area?: string }>
}) {
  await requireGestor()
  const searchParams = await props.searchParams
  const supabase = await createClient()

  const period = searchParams.period || 'today'
  const areaFilter = searchParams.area || 'all'

  const todayIso = hoje()
  const startIso =
    period === 'week' ? inicioSemana() : period === 'month' ? inicioMes() : todayIso
  // Sábado/domingo: garante denominador mínimo de 1 dia
  const diasUteis = Math.max(1, diasUteisEntre(startIso, todayIso))

  const [{ data: areas }, { data: colaboradores }, { data: indicadores }] = await Promise.all([
    supabase.from('areas').select('id, nome').order('nome'),
    supabase
      .from('colaboradores')
      .select('id, nome, area_id, carga_horaria_min')
      .eq('ativo', true)
      .order('nome'),
    supabase
      .from('indicadores_diarios')
      .select('colaborador_id, data, tempo_entregue_min')
      .gte('data', startIso)
      .lte('data', todayIso),
  ])

  // Soma o tempo entregue e os dias com lançamento por colaborador
  const entregue = new Map<string, { tempo: number; dias: Set<string> }>()
  for (const ind of indicadores ?? []) {
    const cur = entregue.get(ind.colaborador_id) ?? { tempo: 0, dias: new Set<string>() }
    cur.tempo += ind.tempo_entregue_min
    if (ind.data) cur.dias.add(ind.data)
    entregue.set(ind.colaborador_id, cur)
  }

  // Todo colaborador ativo aparece; denominador = dias úteis do período × carga
  const finalData = (colaboradores ?? [])
    .filter((c) => areaFilter === 'all' || c.area_id === areaFilter)
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

  // Stat cards
  const mediaIndice =
    finalData.length > 0
      ? finalData.reduce((acc, d) => acc + d.indice, 0) / finalData.length
      : 0
  const totalDiasPossiveis = finalData.length * diasUteis
  const preenchimento =
    totalDiasPossiveis > 0
      ? finalData.reduce((acc, d) => acc + d.dias_apontados, 0) / totalDiasPossiveis
      : 0

  const indicePorArea = new Map<string, { soma: number; n: number }>()
  for (const c of colaboradores ?? []) {
    if (!c.area_id) continue
    const d = finalData.find((f) => f.colaborador_id === c.id)
    if (!d) continue
    const cur = indicePorArea.get(c.area_id) ?? { soma: 0, n: 0 }
    cur.soma += d.indice
    cur.n += 1
    indicePorArea.set(c.area_id, cur)
  }
  let topArea: { nome: string; indice: number } | null = null
  for (const [areaId, { soma, n }] of indicePorArea) {
    const media = n > 0 ? soma / n : 0
    if (!topArea || media > topArea.indice) {
      topArea = { nome: areas?.find((a) => a.id === areaId)?.nome ?? '—', indice: media }
    }
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-6">Dashboard de Produtividade</h1>

      <div className="mb-6">
        <DashboardFilters
          areas={areas || []}
          currentPeriod={period}
          currentArea={areaFilter}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Índice médio do período</CardDescription>
            <CardTitle className="text-3xl">{(mediaIndice * 100).toFixed(1)}%</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {diasUteis} dia{diasUteis > 1 ? 's' : ''} útil{diasUteis > 1 ? 'eis' : ''} considerados
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Preenchimento dos apontamentos</CardDescription>
            <CardTitle className="text-3xl">{(preenchimento * 100).toFixed(0)}%</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            dias com lançamento sobre o total possível
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Melhor área</CardDescription>
            <CardTitle className="text-3xl truncate">{topArea?.nome ?? '—'}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {topArea ? `índice médio de ${(topArea.indice * 100).toFixed(1)}%` : 'sem dados no período'}
          </CardContent>
        </Card>
      </div>

      <DashboardTable data={finalData} />
    </div>
  )
}
