import { requireUser } from '@/lib/auth'
import { hoje } from '@/lib/dates'
import { createClient } from '@/utils/supabase/server'
import { throwIfError } from '@/lib/supabase-error'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { HistoricoList } from './historico-list'

export const dynamic = 'force-dynamic'

export default async function HistoricoPage() {
  const { user } = await requireUser()
  const supabase = await createClient()

  const { data: apontamentos, error: apontamentosError } = await supabase
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
  throwIfError(apontamentosError)

  const formattedApontamentos = (apontamentos ?? []).map((a) => ({
    id: a.id,
    data: a.data,
    quantidade: a.quantidade,
    observacoes: a.observacoes,
    tempo_total_min: a.tempo_total_min,
    demanda_nome: a.demandas?.nome || 'Desconhecida',
  }))

  return (
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-6 text-center">Histórico de Apontamentos</h1>

      <Card className="w-full max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Seus Lançamentos Recentes</CardTitle>
          <CardDescription>Você só pode excluir apontamentos feitos no dia de hoje.</CardDescription>
        </CardHeader>
        <CardContent>
          <HistoricoList apontamentos={formattedApontamentos} today={hoje()} />
        </CardContent>
      </Card>
    </div>
  )
}
