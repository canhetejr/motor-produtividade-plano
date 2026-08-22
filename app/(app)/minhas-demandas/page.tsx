import { redirect } from 'next/navigation'

import { CatalogoManager } from '../catadocs/assets/brand-source/catalogo-manager'
import { requireUser } from '@/lib/auth'
import { throwIfError } from '@/lib/supabase-error'
import { createClient } from '@/utils/supabase/server'
import { LibraryBig } from 'lucide-react'
import { PageHeader, PageShell } from '@/components/layout/page-shell'

export const dynamic = 'force-dynamic'

const TABS = ['demandas', 'solicitacoes'] as const

export default async function MinhasDemandasPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { profile } = await requireUser()
  if (profile.role === 'gestor') redirect('/gestao/catalogo')

  const supabase = await createClient()
  const params = await searchParams
  const [
    { data: areas, error: areasError },
    { data: demandas, error: demandasError },
    { data: solicitacoes, error: solicitacoesError },
  ] = await Promise.all([
    supabase.from('areas').select('*').order('nome'),
    supabase.from('demandas').select('*').order('nome'),
    supabase
      .from('solicitacoes_demandas')
      .select('*, demandas(nome), colaboradores(nome), areas(nome)')
      .order('criado_em', { ascending: false }),
  ])
  throwIfError(areasError, demandasError)
  if (solicitacoesError) {
    console.error(
      'Falha ao carregar sugestões de demanda: code=%s message=%s',
      solicitacoesError.code,
      solicitacoesError.message
    )
  }

  const areasComStats = (areas ?? []).map((area) => ({
    ...area,
    colaboradoresCount: 0,
    demandasCount: (demandas ?? []).filter((demanda) => demanda.area_id === area.id).length,
  }))
  const defaultTab = TABS.includes(params.tab as (typeof TABS)[number]) ? params.tab : undefined

  return (
    <PageShell width="content">
        <PageHeader
          title="Minhas demandas"
          eyebrow="Catálogo da sua área"
          description="Consulte o que está disponível para apontar e acompanhe suas sugestões."
          icon={LibraryBig}
        />

        <CatalogoManager
          areas={areasComStats}
          demandas={demandas ?? []}
          solicitacoes={solicitacoes ?? []}
          colaboradores={[]}
          role="colaborador"
          userAreaId={profile.area_id}
          defaultTab={defaultTab}
        />
    </PageShell>
  )
}
