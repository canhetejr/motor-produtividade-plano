import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { HistoricoList } from './historico-list'

export const dynamic = 'force-dynamic'

export default async function HistoricoPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Fetch recent apontamentos for this user, including the demand name and calculated time
  // The 'apontamentos_calculado' view has tempo_total_min
  const { data: apontamentos } = await supabase
    .from('apontamentos_calculado')
    .select(`
      id,
      data,
      quantidade,
      observacoes,
      tempo_total_min,
      demandas (nome)
    `)
    .eq('colaborador_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  type JoinedRow = {
    id: string
    data: string
    quantidade: number
    observacoes: string | null
    tempo_total_min: number
    demandas: { nome: string } | { nome: string }[] | null
  }

  // Format data for the client component
  const formattedApontamentos = (apontamentos as unknown as JoinedRow[])?.map((a) => {
    const dem = Array.isArray(a.demandas) ? a.demandas[0] : a.demandas
    return {
      id: a.id,
      data: a.data,
      quantidade: a.quantidade,
      observacoes: a.observacoes,
      tempo_total_min: a.tempo_total_min,
      demanda_nome: dem?.nome || 'Desconhecida'
    }
  }) || []

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-6 text-center">Histórico de Apontamentos</h1>
      
      <Card className="w-full max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Seus Lançamentos Recentes</CardTitle>
          <CardDescription>Você só pode excluir apontamentos feitos no dia de hoje.</CardDescription>
        </CardHeader>
        <CardContent>
          <HistoricoList apontamentos={formattedApontamentos} today={today} />
        </CardContent>
      </Card>
    </div>
  )
}
