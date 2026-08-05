import { Sidebar } from '@/components/layout/sidebar'
import { NotificationBell } from '@/components/layout/notification-bell'
import { BuscaGlobal } from '@/components/busca/busca-global'
import { KanbanTimerWidget } from '@/components/layout/kanban-timer-widget'
import { FilaDeApontamentos } from '@/components/offline/fila-apontamentos'
import { FundoParticulas } from '@/components/fundo-particulas'
import { TourBoasVindas } from '@/components/onboarding/tour-boas-vindas'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  // Notificações são um extra sobre a navegação, não o core do app: uma
  // falha aqui não pode derrubar o layout de toda página autenticada.
  //
  // Em paralelo com requireUser(): a RLS `notificacoes_select_own` já filtra
  // por usuário a partir do cookie, então a query não depende do perfil. Em
  // série, era um round trip extra em todas as 14 rotas.
  const [{ user, profile }, { data: notificacoes, error: notificacoesError }] = await Promise.all([
    requireUser(),
    supabase
      .from('notificacoes')
      .select('id, titulo, mensagem, link, lida, criado_em')
      .order('criado_em', { ascending: false })
      .limit(20),
  ])
  if (notificacoesError) {
    console.error('Falha ao carregar notificações: code=%s message=%s', notificacoesError.code, notificacoesError.message)
  }

  return (
    // Sem bg-background aqui: a cor de base vive no <html> (ver app/layout.tsx).
    // Um fundo opaco neste bloco cobriria o canvas de particulas, que pinta
    // antes dos blocos em fluxo por ter z-index negativo.
    <div className="relative isolate flex h-dvh min-h-svh w-full overflow-hidden text-foreground">
      <FundoParticulas />
      <Sidebar
        user={{ nome: profile.nome, role: profile.role, admin: profile.admin, avatarUrl: profile.avatar_url }}
      />
      <main className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
        <header className="flex h-[calc(3.5rem+env(safe-area-inset-top))] shrink-0 items-center justify-end gap-2 border-b bg-card px-4 pt-[env(safe-area-inset-top)] md:h-[calc(4rem+env(safe-area-inset-top))] md:px-8">
          <BuscaGlobal />
          <NotificationBell initial={notificacoes ?? []} userId={user.id} />
        </header>
        <div className="flex-1 overscroll-y-contain overflow-y-auto">
          <div className="h-full w-full">
            {children}
          </div>
        </div>
      </main>
      <FilaDeApontamentos usuarioId={user.id} />
      <TourBoasVindas />
      <KanbanTimerWidget userId={user.id} />
    </div>
  )
}
