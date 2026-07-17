import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { ColaboradoresManager } from './colaboradores-manager'

export const dynamic = 'force-dynamic'

export default async function ColaboradoresPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: areas } = await supabase.from('areas').select('*').order('nome')
  const { data: colaboradores } = await supabase.from('colaboradores').select('*').order('nome')

  return (
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-6">Equipe e Colaboradores</h1>
      <p className="text-muted-foreground mb-8">
        Gerencie os perfis, áreas e carga horária de cada colaborador. Novos usuários são adicionados automaticamente ao fazerem o primeiro login (Supabase Auth).
      </p>

      <ColaboradoresManager areas={areas || []} colaboradores={colaboradores || []} />
    </div>
  )
}
