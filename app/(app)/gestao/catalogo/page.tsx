import { requireGestor } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { throwIfError } from '@/lib/supabase-error'
import { CatalogoManager } from '../../catalogo/catalogo-manager'
import { BookOpenCheck } from 'lucide-react'
import { PageHeader, PageShell } from '@/components/layout/page-shell'

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
    <PageShell>
        <PageHeader
          title="Catálogo e equipe"
          description="Gerencie áreas, demandas, colaboradores e aprovações do seu time em um só lugar."
          icon={BookOpenCheck}
          level={2}
        />

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
    </PageShell>
  )
}
