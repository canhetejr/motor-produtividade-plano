import { requireGestor } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { hoje, inicioMes } from '@/lib/dates'
import { RelatoriosForm } from '../../relatorios/relatorios-form'
import { FileBarChart2 } from 'lucide-react'

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
    <div className="min-h-full min-w-0 overflow-x-hidden p-4 md:p-8">

      <div className="mx-auto w-full max-w-3xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 border border-primary/20 text-primary rounded-md">
              <FileBarChart2 className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">
              Relatórios <span className="text-primary">& Exportação</span>
            </h2>
          </div>
          <p className="text-sm text-muted-foreground ml-[52px]">
            Gere exportações em CSV, Excel ou PDF para apresentar dados à diretoria.
          </p>
        </div>

        <RelatoriosForm areas={areas ?? []} defaultStart={defaultStart} defaultEnd={defaultEnd} />
      </div>
    </div>
  )
}
