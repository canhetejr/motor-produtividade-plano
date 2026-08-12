import Link from 'next/link'
import { requireGestor } from '@/lib/auth'
import { KanbanBoardsList } from '../kanban-boards-list'
import { carregarQuadros } from '../carregar-quadros'
import { ArrowLeft, Archive } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { PageHeader, PageShell } from '@/components/layout/page-shell'

export const dynamic = 'force-dynamic'

export default async function QuadrosArquivadosPage() {
  // requireGestor(), não só o link escondido em /kanban: sem isto, digitar a
  // URL levaria um colaborador à lista de quadros arquivados da empresa.
  await requireGestor()

  const quadros = await carregarQuadros(false)

  return (
    <PageShell width="content">
      <PageHeader
        title="Quadros arquivados"
        description="Quadros fora de uso. Desarquivar devolve o quadro à lista principal com tudo o que havia nele."
        icon={Archive}
        back={
          <Link href="/kanban" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            <ArrowLeft className="h-4 w-4" /> Voltar aos quadros
          </Link>
        }
      />

      {/* colaboradores vazio de propósito: o diálogo de vincular pessoas é da
          lista principal. Quadro arquivado se desarquiva, não se edita. */}
      <KanbanBoardsList quadros={quadros} colaboradores={[]} isGestor modo="arquivados" />
    </PageShell>
  )
}
