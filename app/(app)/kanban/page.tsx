import { requireUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { throwIfError } from '@/lib/supabase-error'
import { KanbanBoardsList } from './kanban-boards-list'

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
    <div className="flex flex-col min-h-full p-4 bg-background">
      <div className="w-full max-w-6xl mx-auto mt-8">
        <div className="mb-8 text-center md:text-left">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
            <span className="text-primary">Kanban</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            {isGestor
              ? 'Crie quadros e vincule os colaboradores que vão trabalhar em cada um.'
              : 'Quadros em que você foi vinculado pelo gestor.'}
          </p>
        </div>

        <KanbanBoardsList quadros={quadrosComMembros} colaboradores={colaboradores ?? []} isGestor={isGestor} />
      </div>
    </div>
  )
}
