import { redirect } from 'next/navigation'

import { CatalogoManager } from '../catalogo/catalogo-manager'
import { requireUser } from '@/lib/auth'
import { throwIfError } from '@/lib/supabase-error'
import { createClient } from '@/utils/supabase/server'

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
    <div className="min-h-full min-w-0 overflow-x-hidden p-4 md:p-8">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-6 border-b border-border/70 pb-5">
          <p className="font-mono text-3xs font-medium uppercase tracking-[0.16em] text-primary">Catálogo da sua área</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Minhas demandas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Consulte o que está disponível para apontar e acompanhe suas sugestões.
          </p>
        </header>

        <CatalogoManager
          areas={areasComStats}
          demandas={demandas ?? []}
          solicitacoes={solicitacoes ?? []}
          colaboradores={[]}
          role="colaborador"
          userAreaId={profile.area_id}
          defaultTab={defaultTab}
        />
      </div>
    </div>
  )
}
