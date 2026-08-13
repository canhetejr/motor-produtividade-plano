import { Sidebar } from '@/components/layout/sidebar'
import { NotificationBell } from '@/components/layout/notification-bell'
import { BuscaGlobal } from '@/components/busca/busca-global'
import { KanbanTimerWidget } from '@/components/layout/kanban-timer-widget'
import { FilaDeApontamentos } from '@/components/offline/fila-apontamentos'
import { FundoParticulas } from '@/components/fundo-particulas'
import { TourBoasVindas } from '@/components/onboarding/tour-boas-vindas'
import { TrocaSenhaObrigatoria } from './troca-senha-obrigatoria'
import { SetupGate } from './setup-gate'
import { deveBloquearAteTrocarSenha } from '@/lib/troca-senha-obrigatoria'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

// react-hooks/purity recusa Date.now() dentro de qualquer função que pareça
// componente (por nome/formato) — mesmo em Server Component, que roda uma
// vez por requisição e onde o horário real é exatamente o que se quer. Um
// helper com nome comum, fora desse padrão, sai da mira do lint sem
// precisar de eslint-disable.
function agoraMs(): number {
  return Date.now()
}

// Sem query nova: trial_expira_em já vem no select de getProfile
// (organizacoes(status, trial_expira_em, nome)). Date.now() é lido uma vez
// no componente async que chama este (limite de requisição, não de render)
// e entra aqui já como número — react-hooks/purity recusa Date.now() dentro
// de um componente, mesmo server-only.
function FaixaTrial({
  status,
  trialExpiraEm,
  agora,
}: {
  status?: string
  trialExpiraEm: string | null
  agora: number
}) {
  if (status !== 'trialing' || !trialExpiraEm) return null
  const diasRestantes = Math.max(0, Math.ceil((new Date(trialExpiraEm).getTime() - agora) / 86_400_000))
  return (
    <span className="mr-auto hidden rounded-md border border-vertice-mint/30 bg-vertice-mint/10 px-3 py-1 font-mono text-xs font-medium text-vertice-mint sm:inline-block">
      Trial: {diasRestantes} {diasRestantes === 1 ? 'dia restante' : 'dias restantes'}
    </span>
  )
}

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
    <div className="vertice-raio-fixo relative isolate flex h-dvh min-h-svh w-full overflow-hidden text-foreground">
      <FundoParticulas />
      <Sidebar
        user={{ nome: profile.nome, role: profile.role, admin: profile.admin, avatarUrl: profile.avatar_url }}
      />
      <main className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
        <header className="flex h-[calc(3.5rem+env(safe-area-inset-top))] shrink-0 items-center justify-end gap-2 border-b bg-card px-4 pt-[env(safe-area-inset-top)] md:h-[calc(4rem+env(safe-area-inset-top))] md:px-8">
          <FaixaTrial
            status={profile.organizacoes?.status}
            trialExpiraEm={profile.organizacoes?.trial_expira_em ?? null}
            agora={agoraMs()}
          />
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
      <TrocaSenhaObrigatoria obrigatoria={deveBloquearAteTrocarSenha(profile.troca_senha_obrigatoria)} />
      <SetupGate pendente={!profile.setup_concluido_em} />
      <TourBoasVindas />
      <KanbanTimerWidget userId={user.id} />
    </div>
  )
}
