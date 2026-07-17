import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireGestor } from '@/lib/auth'
import { hoje, formatarDataBR } from '@/lib/dates'
import { createClient } from '@/utils/supabase/server'
import { subDays, parseISO, format } from 'date-fns'
import { ColaboradorChart } from './colaborador-chart'

export const dynamic = 'force-dynamic'

export default async function ColaboradorDashboardPage(
  props: { params: Promise<{ colaborador: string }> }
) {
  await requireGestor()
  const params = await props.params
  const supabase = await createClient()

  const colaboradorId = params.colaborador

  const { data: colaboradorInfo } = await supabase
    .from('colaboradores')
    .select('nome')
    .eq('id', colaboradorId)
    .single()

  if (!colaboradorInfo) {
    notFound()
  }

  const todayIso = hoje()
  const startIso = format(subDays(parseISO(todayIso), 30), 'yyyy-MM-dd')

  const { data: indicadores } = await supabase
    .from('indicadores_diarios')
    .select('data, tempo_entregue_min, carga_horaria_min, indice')
    .eq('colaborador_id', colaboradorId)
    .gte('data', startIso)
    .lte('data', todayIso)
    .order('data', { ascending: true })

  const chartData = (indicadores ?? [])
    .filter((d): d is typeof d & { data: string } => d.data !== null)
    .map((d) => ({
      data: formatarDataBR(d.data),
      indice: Number(((d.indice ?? 0) * 100).toFixed(1)),
      esperado: 100,
    }))

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Link href="/dashboard" className="inline-flex items-center text-primary hover:underline mb-6">
        <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao Dashboard
      </Link>

      <h1 className="text-3xl font-bold mb-2">{colaboradorInfo.nome}</h1>
      <p className="text-muted-foreground mb-8">Série histórica de produtividade (Últimos 30 dias)</p>

      <div className="bg-card border rounded-lg p-4 md:p-8 h-100">
        {chartData.length > 0 ? (
          <ColaboradorChart data={chartData} />
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            Sem dados de apontamento nos últimos 30 dias.
          </div>
        )}
      </div>
    </div>
  )
}
