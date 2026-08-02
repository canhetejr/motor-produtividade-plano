import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { requireUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { LoteForm } from './lote-form'

export const dynamic = 'force-dynamic'

/**
 * Registro de várias demandas numa tela só.
 *
 * O formulário normal é feito para um lançamento por vez, com preview de meta e
 * validação rica. Quem chega no fim do dia com cinco entregas repetia o fluxo
 * inteiro cinco vezes.
 */
export default async function LotePage() {
  const { user } = await requireUser()
  const supabase = await createClient()

  // Mesma consulta da tela de apontamento: a RLS já limita ao que a pessoa
  // pode lançar.
  const { data: demandas } = await supabase
    .from('demandas')
    .select('id, nome, variavel, tempo_padrao_min, blocos_totais')
    .eq('ativo', true)
    .order('nome')

  return (
    <div className="mx-auto w-full max-w-3xl p-4 md:p-8">
      <Link
        href="/apontamento"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Apontamento
      </Link>

      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Lançamento em lote</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Monte a lista e envie tudo de uma vez. Cada linha passa pelas mesmas
          regras do lançamento avulso.
        </p>
      </header>

      <LoteForm demandas={demandas ?? []} usuarioId={user.id} />
    </div>
  )
}
