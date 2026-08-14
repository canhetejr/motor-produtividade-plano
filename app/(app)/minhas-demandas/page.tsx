import { redirect } from 'next/navigation'

import { CatalogoManager } from '../catalogo/catalogo-manager'
import { requireUser } from '@/lib/auth'
import { throwIfError } from '@/lib/supabase-error'
import { createClient } from '@/utils/supabase/server'
import { reguaDeComplexidade } from '@/lib/produtividade'
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
    { data: niveis },
    { data: areasDoColaborador },
  ] = await Promise.all([
    supabase.from('areas').select('*').order('nome'),
    supabase.from('demandas').select('*').order('nome'),
    supabase
      .from('solicitacoes_demandas')
      .select('*, demandas(nome), colaboradores(nome), areas(nome)')
      .order('criado_em', { ascending: false }),
    supabase.from('complexidade_niveis').select('nivel, minutos_referencia'),
    supabase.rpc('areas_do_colaborador', { p_colaborador_id: profile.id }),
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
  // A área principal entra sempre, inclusive se a RPC falhar: melhor ver só
  // ela do que abrir a tela sem área nenhuma.
  const areasVisiveis = [
    ...new Set([
      ...((areasDoColaborador as string[] | null) ?? []),
      ...(profile.area_id ? [profile.area_id] : []),
    ]),
  ]

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
          minutosPorNivel={reguaDeComplexidade(niveis)}
          areasDoColaborador={areasVisiveis}
        />
    </PageShell>
  )
}
