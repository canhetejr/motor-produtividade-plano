import Link from 'next/link'
import { CalendarDays, CalendarSync, SlidersHorizontal, UserRound } from 'lucide-react'

import { AtivarPush } from '@/components/pwa/ativar-push'
import { requireUser } from '@/lib/auth'
import { ConfiguracoesManager } from './configuracoes-manager'
import { PageHeader, PageShell } from '@/components/layout/page-shell'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { emailGoogleConectado } from '@/lib/google-conexao'

export const dynamic = 'force-dynamic'

// A divisão com /perfil: identidade e credenciais ficam lá (quem você é e como
// você prova); preferência e integração ficam aqui (como o sistema se comporta
// para você). Senha e verificação em duas etapas seguem no Perfil de propósito
// — trocar senha é um ato sobre identidade, não uma preferência de uso.
export default async function ConfiguracoesPage() {
  const { user, profile } = await requireUser()

  // colaborador_id vem da própria sessão (requireUser), não de entrada do
  // cliente; o filtro por organização fica explícito dentro do helper.
  const googleEmail = await emailGoogleConectado(user.id, profile.organizacao_id)

  return (
    <PageShell width="narrow">
      <PageHeader
        title="Configurações"
        description="Aparência, notificações e integrações desta conta."
        icon={SlidersHorizontal}
        actions={
          <Link href="/perfil" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            <UserRound className="h-4 w-4" /> Meu perfil
          </Link>
        }
      />

      <ConfiguracoesManager
        role={profile.role}
        notifPrefs={{
          notif_lembrete_diario: profile.notif_lembrete_diario,
          notif_solicitacoes: profile.notif_solicitacoes,
          notif_alerta_queda: profile.notif_alerta_queda,
          notif_relatorio_semanal: profile.notif_relatorio_semanal,
        }}
      />

      <AtivarPush />

      <section className="mt-6 rounded-md border border-border bg-card p-4 shadow-xs">
        <h2 className="text-sm font-semibold">Google Workspace</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {googleEmail
            ? `Conectado como ${googleEmail}. Novas demandas e alterações de prazo são sincronizadas automaticamente com o Google Calendar.`
            : 'Conecte sua conta para sincronizar prazos com o Google Calendar e habilitar arquivos do Drive criados pelo Vértice.'}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {googleEmail ? (
            <>
              <span className="inline-flex h-9 items-center gap-2 rounded-md border border-primary/25 bg-primary/5 px-3 text-sm font-medium text-primary">
                <CalendarSync className="size-4" /> Sincronização automática ativa
              </span>
              <form action="/api/google/disconnect" method="post">
                <Button type="submit" variant="outline">Desconectar</Button>
              </form>
            </>
          ) : <a href="/api/google/connect" className={buttonVariants()}>Conectar Google Workspace</a>}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Permissões: criar e atualizar eventos no seu calendário e acessar apenas arquivos do Drive criados/abertos pelo app.</p>
      </section>

      <section className="mt-6 rounded-md border border-border bg-card p-4 shadow-xs">
        <h2 className="text-sm font-semibold">Prazos no seu calendário</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Baixe um arquivo com os prazos dos cards em que você é responsável e
          importe no Google Agenda, no Outlook ou no calendário do celular.
        </p>
        <a
          href="/api/calendario"
          download="vertice-prazos.ics"
          className={cn(buttonVariants({ variant: 'outline' }), 'mt-3')}
        >
          <CalendarDays className="h-4 w-4" /> Baixar calendário (.ics)
        </a>
        <p className="mt-2 text-xs text-muted-foreground">
          É uma cópia do momento: prazos alterados depois não se atualizam
          sozinhos no calendário. Baixe de novo quando precisar.
        </p>
      </section>
    </PageShell>
  )
}
