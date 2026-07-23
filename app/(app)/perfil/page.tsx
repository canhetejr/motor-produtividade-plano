import { requireUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { PerfilManager } from './perfil-manager'

export const dynamic = 'force-dynamic'

export default async function PerfilPage() {
  const { user, profile } = await requireUser()
  const supabase = await createClient()

  const { data: areas } = await supabase.from('areas').select('id, nome, ativo').order('nome')
  const areaNome = (areas ?? []).find((a) => a.id === profile.area_id)?.nome ?? null

  return (
    <div className="relative flex flex-col min-h-[calc(100dvh-4rem)] p-4 overflow-x-hidden bg-background">
      {/* Ambient background glow */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-primary/20 blur-[100px] rounded-full pointer-events-none -z-10" />
      <div className="fixed bottom-0 right-0 w-[400px] h-[400px] bg-primary/10 blur-[100px] rounded-full pointer-events-none -z-10" />

      <div className="w-full max-w-2xl mx-auto mt-8 relative z-10">
        <div className="mb-8 text-center md:text-left">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
            Meu <span className="text-primary">Perfil</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Seus dados de acesso, foto e preferências.
          </p>
        </div>

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
      </div>
    </div>
  )
}
