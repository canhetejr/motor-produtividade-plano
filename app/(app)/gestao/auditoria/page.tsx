import { requireGestor } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { throwIfError } from '@/lib/supabase-error'
import { AuditoriaTable, type EventoAuditoria } from '../../auditoria/auditoria-table'
import { ShieldCheck } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AuditoriaPage() {
  await requireGestor()
  const supabase = await createClient()

  const { data: eventos, error } = await supabase
    .from('auditoria')
    .select('id, acao, entidade, entidade_id, dados_antes, dados_depois, criado_em, colaboradores(nome)')
    .order('criado_em', { ascending: false })
    .limit(200)
  throwIfError(error)

  return (
    <div className="container mx-auto min-w-0 overflow-x-hidden p-4 md:p-8 space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
          <h2 className="text-xl font-semibold tracking-tight md:text-2xl">Trilha de auditoria</h2>
        </div>
        <p className="text-muted-foreground">
          Registro imutável e completo das últimas 200 ações realizadas no sistema — quem fez, o quê, quando e diffs de alteração.
        </p>
      </div>

      <AuditoriaTable eventos={(eventos ?? []) as EventoAuditoria[]} />
    </div>
  )
}

