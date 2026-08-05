import { requireGestor } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { hoje, inicioMes } from '@/lib/dates'
import { RelatoriosForm } from '../../relatorios/relatorios-form'
import { FileBarChart2 } from 'lucide-react'
import { PageHeader, PageShell } from '@/components/layout/page-shell'

export const dynamic = 'force-dynamic'

export default async function RelatoriosPage() {
  await requireGestor()
  const supabase = await createClient()

  const defaultEnd = hoje()
  const defaultStart = inicioMes(defaultEnd)

  const { data: areas } = await supabase
    .from('areas')
    .select('id, nome')
    .order('nome')

  return (
    <PageShell width="narrow">
        <PageHeader
          title="Relatórios e exportação"
          description="Gere arquivos em CSV, Excel ou PDF para análise e apresentação."
          icon={FileBarChart2}
          level={2}
        />

        <RelatoriosForm areas={areas ?? []} defaultStart={defaultStart} defaultEnd={defaultEnd} />
    </PageShell>
  )
}
