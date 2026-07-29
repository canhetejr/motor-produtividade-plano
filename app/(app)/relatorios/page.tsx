import { requireGestor } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { hoje, inicioMes } from '@/lib/dates'
import { RelatoriosForm } from './relatorios-form'
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
    <div className="relative flex flex-col min-h-[calc(100dvh-4rem)] p-4 md:p-8 overflow-x-hidden bg-background">
      {/* Ambient glow */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-primary/8 blur-[120px] rounded-full pointer-events-none -z-10" />

      <div className="w-full max-w-3xl mx-auto relative z-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 border border-primary/20 text-primary rounded-md">
              <FileBarChart2 className="h-5 w-5" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              Relatórios <span className="text-primary">& Exportação</span>
            </h1>
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
