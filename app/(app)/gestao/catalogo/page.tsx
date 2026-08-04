import { requireGestor } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { throwIfError } from '@/lib/supabase-error'
import { CatalogoManager } from '../../catalogo/catalogo-manager'

export const dynamic = 'force-dynamic'

const TABS = ['areas', 'demandas', 'colaboradores', 'solicitacoes'] as const

export default async function CatalogoPage(props: { searchParams: Promise<{ tab?: string }> }) {
  // `profile` vem do getProfile() envolvido em React.cache — a mesma linha de
  // `colaboradores` que o requireUser() já leu neste request. Buscar de novo
  // custava um round trip e um nível de waterfall a mais.
  const { profile } = await requireGestor()
  const searchParams = await props.searchParams
  const supabase = await createClient()

  const role = 'gestor'
  const userAreaId = profile.area_id

  const [
    { data: areas, error: areasError },
    { data: demandas, error: demandasError },
    { data: solicitacoes, error: solicitacoesError },
    { data: colaboradores, error: colaboradoresError },
  ] = await Promise.all([
    supabase.from('areas').select('*').order('nome'),
    supabase.from('demandas').select('*').order('nome'),
    supabase.from('solicitacoes_demandas').select(`
      *,
      demandas(nome),
      colaboradores(nome),
      areas(nome)
    `).order('criado_em', { ascending: false }),
    supabase.from('colaboradores').select('*').order('nome'),
  ])
  throwIfError(areasError, demandasError, colaboradoresError)
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

  const areasComStats = (areas || []).map(a => ({
    ...a,
    colaboradoresCount: (colaboradores || []).filter(c => c.area_id === a.id).length,
    demandasCount: (demandas || []).filter(d => d.area_id === a.id).length,
  }))

  const defaultTab = TABS.includes(searchParams.tab as typeof TABS[number]) ? searchParams.tab : undefined

  return (
    <div className="min-h-full min-w-0 overflow-x-hidden p-4 md:p-8">

      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
            Catálogo <span className="text-primary">{role === 'gestor' ? '& Equipe' : 'de Demandas'}</span>
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {role === 'gestor'
              ? 'Gerencie áreas, demandas, colaboradores e aprovações do seu time em um só lugar.'
              : 'Consulte o catálogo da sua área e sugira novas demandas ou alterações.'}
          </p>
        </div>

        <CatalogoManager
          areas={areasComStats}
          demandas={demandas || []}
          solicitacoes={solicitacoes || []}
          colaboradores={colaboradores || []}
          role={role}
          isAdmin={Boolean(profile.admin)}
          userAreaId={userAreaId}
          defaultTab={defaultTab}
        />
      </div>
    </div>
  )
}
