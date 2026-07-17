import { Sidebar } from '@/components/layout/sidebar'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Pegar perfil do colaborador para mostrar nome/role no sidebar
  const { data: profile } = await supabase
    .from('colaboradores')
    .select('nome, role')
    .eq('id', user.id)
    .single()

  return (
    <div className="flex w-full h-screen bg-background text-foreground overflow-hidden">
      <Sidebar user={profile} email={user.email || ''} />
      <main className="flex-1 overflow-y-auto bg-muted/30">
        <div className="h-full w-full">
          {children}
        </div>
      </main>
    </div>
  )
}
