import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { RelatoriosForm } from './relatorios-form'

export const dynamic = 'force-dynamic'

export default async function RelatoriosPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-6">Relatórios e Exportação</h1>
      <p className="text-muted-foreground mb-8">
        Gere exportações em formato CSV para cruzar dados e apresentar relatórios para a diretoria.
      </p>

      <RelatoriosForm />
    </div>
  )
}
