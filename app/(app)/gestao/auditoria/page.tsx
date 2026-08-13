import { requireGestor } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { throwIfError } from '@/lib/supabase-error'
import { AuditoriaTable, type EventoAuditoria } from '../../auditoria/auditoria-table'
import { ShieldCheck } from 'lucide-react'
import { PageHeader, PageShell } from '@/components/layout/page-shell'

export const dynamic = 'force-dynamic'

export default async function AuditoriaPage() {
  await requireGestor()
  const supabase = await createClient()

  const { data: eventos, error } = await supabase
    .from('auditoria')
    .select('id, acao, entidade, entidade_id, dados_antes, dados_depois, criado_em, ator_nome, colaboradores(nome)')
    .order('criado_em', { ascending: false })
    .limit(200)
  throwIfError(error)

  return (
    <PageShell contentClassName="space-y-6">
      <PageHeader
        title="Trilha de auditoria"
        description="Consulte as últimas 200 ações administrativas, com autor, horário e alterações realizadas."
        icon={ShieldCheck}
        level={2}
        className="mb-0"
      />

      <AuditoriaTable eventos={(eventos ?? []) as EventoAuditoria[]} />
    </PageShell>
  )
}
