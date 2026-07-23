import { requireUser } from '@/lib/auth'
import { hoje } from '@/lib/dates'
import { createClient } from '@/utils/supabase/server'
import { throwIfError } from '@/lib/supabase-error'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { HistoricoList } from './historico-list'

export const dynamic = 'force-dynamic'

export default async function HistoricoPage() {
  const { user, profile } = await requireUser()
  const supabase = await createClient()

  const [{ data: apontamentos, error: apontamentosError }, { data: demandas }] = await Promise.all([
    supabase
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
      .order('created_at', { ascending: false })
      .limit(50),
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
  ])
  throwIfError(apontamentosError)

  const formattedApontamentos = (apontamentos ?? []).map((a) => ({
    id: a.id,
    data: a.data,
    demanda_id: a.demanda_id,
    quantidade: a.quantidade,
    tempo_manual_min: a.tempo_manual_min,
    motivo: a.motivo,
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
          <CardDescription>Você só pode editar ou excluir apontamentos feitos no dia de hoje.</CardDescription>
        </CardHeader>
        <CardContent>
          <HistoricoList
            apontamentos={formattedApontamentos}
            today={hoje()}
            demandas={demandas ?? []}
            cargaHorariaMin={profile.carga_horaria_min}
          />
        </CardContent>
      </Card>
    </div>
  )
}
