import { requireUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { throwIfError } from '@/lib/supabase-error'
import { CatalogoManager } from './catalogo-manager'

export const dynamic = 'force-dynamic'

export default async function CatalogoPage() {
  const { user } = await requireUser()
  const supabase = await createClient()

  const { data: perfil, error: perfilError } = await supabase
    .from('colaboradores')
    .select('role, area_id')
    .eq('id', user.id)
    .single()
  throwIfError(perfilError)
  const role = perfil?.role || 'colaborador'
  const userAreaId = perfil?.area_id

  const [
    { data: areas, error: areasError },
    { data: demandas, error: demandasError },
    { data: solicitacoes, error: solicitacoesError },
  ] = await Promise.all([
    supabase.from('areas').select('*').order('nome'),
    supabase.from('demandas').select('*').order('nome'),
    supabase.from('solicitacoes_demandas').select(`
      *,
      demandas(nome),
      colaboradores(nome),
      areas(nome)
    `).order('criado_em', { ascending: false }),
  ])
  throwIfError(areasError, demandasError)
  // solicitacoes_demandas é feature nova (migration própria, ainda não
  // aplicada em todo ambiente) — degrada pra aba vazia em vez de derrubar
  // o catálogo inteiro se a tabela ainda não existir no banco.
  if (solicitacoesError) {
    console.error(
      'Falha ao carregar solicitações de demanda: code=%s message=%s',
      solicitacoesError.code,
      solicitacoesError.message
    )
  }

  return (
    <div className="relative flex flex-col min-h-[calc(100dvh-4rem)] p-4 overflow-x-hidden bg-background">
      {/* Ambient background glow */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-primary/20 blur-[100px] rounded-full pointer-events-none -z-10" />
      <div className="fixed bottom-0 right-0 w-[400px] h-[400px] bg-primary/10 blur-[100px] rounded-full pointer-events-none -z-10" />

      <div className="w-full max-w-6xl mx-auto mt-8 relative z-10">
        <div className="mb-8 text-center md:text-left">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
            Catálogo de <span className="text-primary">Demandas</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            {role === 'gestor' 
              ? 'Gerencie as áreas, tempos padrão e aprovações do seu time.'
              : 'Consulte o catálogo da sua área e sugira novas demandas ou alterações.'}
          </p>
        </div>

        <CatalogoManager 
          areas={areas || []} 
          demandas={demandas || []} 
          solicitacoes={solicitacoes || []}
          role={role as 'gestor' | 'colaborador'}
          userAreaId={userAreaId}
        />
      </div>
    </div>
  )
}
