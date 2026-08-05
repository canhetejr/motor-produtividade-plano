import { requireUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { throwIfError } from '@/lib/supabase-error'
import { KanbanBoardsList } from './kanban-boards-list'
import { LayoutGrid } from 'lucide-react'
import { PageHeader, PageShell } from '@/components/layout/page-shell'

export const dynamic = 'force-dynamic'

export default async function KanbanPage() {
  const { profile } = await requireUser()
  const supabase = await createClient()
  const isGestor = profile.role === 'gestor'

  // RLS já filtra: gestor vê todos os quadros, colaborador só os vinculados
  // (quadros_select_membro, ver supabase/migrations/20260723010000_kanban.sql)
  const { data: quadros, error: quadrosError } = await supabase
    .from('quadros')
    .select('*')
    .order('created_at', { ascending: false })
  throwIfError(quadrosError)

  const quadroIds = (quadros ?? []).map((q) => q.id)

  const [{ data: membros, error: membrosError }, { data: colaboradores, error: colaboradoresError }] = await Promise.all([
    quadroIds.length > 0
      ? supabase.from('quadros_membros').select('quadro_id, colaborador_id, colaboradores(nome)').in('quadro_id', quadroIds)
      : Promise.resolve({ data: [], error: null }),
    isGestor
      ? supabase.from('colaboradores').select('id, nome, area_id').eq('ativo', true).order('nome')
      : Promise.resolve({ data: [], error: null }),
  ])
  throwIfError(membrosError, colaboradoresError)

  const quadrosComMembros = (quadros ?? []).map((q) => ({
    ...q,
    membros: (membros ?? [])
      .filter((m) => m.quadro_id === q.id)
      .map((m) => ({ colaborador_id: m.colaborador_id, nome: (m.colaboradores as { nome: string } | null)?.nome ?? '—' })),
  }))

  return (
    <PageShell width="content">
        <PageHeader
          title="Quadros"
          description={isGestor
            ? 'Crie quadros e organize quem trabalha em cada fluxo.'
            : 'Acesse os quadros dos quais você participa.'}
          icon={LayoutGrid}
        />

        <KanbanBoardsList quadros={quadrosComMembros} colaboradores={colaboradores ?? []} isGestor={isGestor} />
    </PageShell>
  )
}
