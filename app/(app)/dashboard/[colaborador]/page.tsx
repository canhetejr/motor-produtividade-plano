import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ColaboradorChart } from './colaborador-chart'

export const dynamic = 'force-dynamic'

export default async function ColaboradorDashboardPage(
  props: { params: Promise<{ colaborador: string }> }
) {
  const params = await props.params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const colaboradorId = params.colaborador

  // Fetch info
  const { data: colaboradorInfo } = await supabase
    .from('colaboradores')
    .select('nome')
    .eq('id', colaboradorId)
    .single()

  if (!colaboradorInfo) {
    return <div className="p-8 text-center">Colaborador não encontrado.</div>
  }

  // Fetch last 30 days of data
  const today = new Date()
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(today.getDate() - 30)

  const { data: indicadores } = await supabase
    .from('indicadores_diarios')
    .select('data, tempo_entregue_min, carga_horaria_min, indice')
    .eq('colaborador_id', colaboradorId)
    .gte('data', thirtyDaysAgo.toISOString().split('T')[0])
    .lte('data', today.toISOString().split('T')[0])
    .order('data', { ascending: true })

  // Format data for Recharts
  const chartData = indicadores?.map(d => ({
    data: new Date(d.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    indice: Number((d.indice * 100).toFixed(1)),
    esperado: 100 // baseline
  })) || []

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Link href="/dashboard" className="inline-flex items-center text-blue-600 hover:underline mb-6">
        <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao Dashboard
      </Link>
      
      <h1 className="text-3xl font-bold mb-2">{colaboradorInfo.nome}</h1>
      <p className="text-muted-foreground mb-8">Série histórica de produtividade (Últimos 30 dias)</p>
      
      <div className="bg-card border rounded-lg p-4 md:p-8 h-[400px]">
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
