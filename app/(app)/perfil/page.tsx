import { CalendarDays, CalendarSync, UserRound } from 'lucide-react'

import { AtivarPush } from '@/components/pwa/ativar-push'
import { MfaToggle } from './mfa-toggle'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { PerfilManager } from './perfil-manager'
import { PageHeader, PageShell } from '@/components/layout/page-shell'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

export default async function PerfilPage() {
  const { user, profile } = await requireUser()
  const supabase = await createClient()

  const { data: areas } = await supabase.from('areas').select('id, nome, ativo').order('nome')
  const areaNome = (areas ?? []).find((a) => a.id === profile.area_id)?.nome ?? null
  let googleEmail: string | null = null
  try {
    const admin = (await import('@/utils/supabase/admin')).createAdminClient()
    const { data } = await admin.from('google_workspace_conexoes').select('email').eq('colaborador_id', user.id).maybeSingle()
    googleEmail = data?.email ?? null
  } catch {
    // Sem service role em desenvolvimento, a conexão só fica indisponível.
  }

  return (
    <PageShell width="narrow">
        <PageHeader
          title="Meu perfil"
          description="Gerencie seus dados de acesso, foto, segurança e preferências."
          icon={UserRound}
        />

        <PerfilManager
          nome={profile.nome}
          email={user.email || ''}
          avatarUrl={profile.avatar_url}
          areaId={profile.area_id}
          areaNome={areaNome}
          areas={(areas ?? []).filter((a) => a.ativo || a.id === profile.area_id)}
          cargaHorariaMin={profile.carga_horaria_min}
          role={profile.role}
          notifPrefs={{
            notif_lembrete_diario: profile.notif_lembrete_diario,
            notif_solicitacoes: profile.notif_solicitacoes,
            notif_alerta_queda: profile.notif_alerta_queda,
            notif_relatorio_semanal: profile.notif_relatorio_semanal,
          }}
        />

        <MfaToggle ativoInicial={profile.mfa_email_ativo ?? false} />

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
            ) : <Button render={<a href="/api/google/connect" />}>Conectar Google Workspace</Button>}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Permissões: criar e atualizar eventos no seu calendário e acessar apenas arquivos do Drive criados/abertos pelo app.</p>
        </section>

        <section className="mt-6 rounded-md border border-border bg-card p-4 shadow-xs">
          <h2 className="text-sm font-semibold">Prazos no seu calendário</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Baixe um arquivo com os prazos dos cards em que você é responsável e
            importe no Google Agenda, no Outlook ou no calendário do celular.
          </p>
          <Button className="mt-3" variant="outline" render={<a href="/api/calendario" download="vertice-prazos.ics" />}>
            <CalendarDays className="h-4 w-4" /> Baixar calendário (.ics)
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            É uma cópia do momento: prazos alterados depois não se atualizam
            sozinhos no calendário. Baixe de novo quando precisar.
          </p>
        </section>
    </PageShell>
  )
}
