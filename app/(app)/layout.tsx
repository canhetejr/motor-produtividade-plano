import { Sidebar } from '@/components/layout/sidebar'
import { NotificationBell } from '@/components/layout/notification-bell'
import { KanbanTimerWidget } from '@/components/layout/kanban-timer-widget'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await requireUser()
  const supabase = await createClient()

  // Notificações são um extra sobre a navegação, não o core do app: uma
  // falha aqui não pode derrubar o layout de toda página autenticada.
  const { data: notificacoes, error: notificacoesError } = await supabase
    .from('notificacoes')
    .select('id, titulo, mensagem, link, lida, criado_em')
    .order('criado_em', { ascending: false })
    .limit(20)
  if (notificacoesError) {
    console.error('Falha ao carregar notificações: code=%s message=%s', notificacoesError.code, notificacoesError.message)
  }

  return (
    <div className="flex w-full h-dvh bg-background text-foreground overflow-hidden">
      <Sidebar user={{ nome: profile.nome, role: profile.role, avatarUrl: profile.avatar_url }} email={user.email || ''} />
      <main className="flex-1 flex flex-col overflow-hidden bg-muted/30 pb-16 md:pb-0">
        <header className="flex h-14 shrink-0 items-center justify-end border-b bg-card/50 backdrop-blur-md px-4 md:px-8">
          <NotificationBell initial={notificacoes ?? []} userId={user.id} />
        </header>
        <div className="flex-1 overflow-y-auto">
          <div className="h-full w-full">
            {children}
          </div>
        </div>
      </main>
      <KanbanTimerWidget userId={user.id} />
    </div>
  )
}
