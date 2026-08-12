import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { throwIfError } from '@/lib/supabase-error'
import { KanbanBoardsList } from './kanban-boards-list'
import { carregarQuadros } from './carregar-quadros'
import { Archive, LayoutGrid } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { PageHeader, PageShell } from '@/components/layout/page-shell'

export const dynamic = 'force-dynamic'

export default async function KanbanPage() {
  const { profile } = await requireUser()
  const isGestor = profile.role === 'gestor'

  // Só ativos. Até aqui esta lista misturava ativos e arquivados na mesma
  // grade, separados apenas por opacidade e um selo — em quem tem muitos
  // quadros, os arquivados empurravam os ativos para baixo da dobra.
  const [quadros, { data: colaboradores, error: colaboradoresError }] = await Promise.all([
    carregarQuadros(true),
    isGestor
      ? (await createClient()).from('colaboradores').select('id, nome, area_id').eq('ativo', true).order('nome')
      : Promise.resolve({ data: [], error: null }),
  ])
  throwIfError(colaboradoresError)

  return (
    <PageShell width="content">
        <PageHeader
          title="Quadros"
          description={isGestor
            ? 'Crie quadros e organize quem trabalha em cada fluxo.'
            : 'Acesse os quadros dos quais você participa.'}
          icon={LayoutGrid}
          actions={
            // Só gestor: quem arquiva é gestor, e para o colaborador a lista
            // de arquivados seria um link que leva a um redirect. A rota
            // também chama requireGestor(), então o link ausente é
            // apresentação, não a trava.
            isGestor ? (
              <Link href="/kanban/arquivados" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                <Archive className="h-4 w-4" /> Arquivados
              </Link>
            ) : undefined
          }
        />

        <KanbanBoardsList quadros={quadros} colaboradores={colaboradores ?? []} isGestor={isGestor} />
    </PageShell>
  )
}
