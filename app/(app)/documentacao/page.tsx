import { BookOpen } from 'lucide-react'
import { requireUser } from '@/lib/auth'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DocumentacaoViewer } from './documentacao-viewer'
import { ChangelogViewer } from './changelog-viewer'

export const dynamic = 'force-dynamic'

// Duas metades da mesma pergunta ("como isso funciona?"): o Guia explica o
// comportamento atual do sistema; Novidades conta o que mudou e quando. O
// ChangelogViewer existia órfão nesta pasta, sem page.tsx — nunca teve rota.
export default async function DocumentacaoPage() {
  await requireUser()

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Documentação</h1>
        </div>
        <p className="text-muted-foreground">
          Guia de como o Vértice funciona — do apontamento ao Kanban — e o histórico do que mudou.
        </p>
      </div>

      <Tabs defaultValue="guia">
        <TabsList>
          <TabsTrigger value="guia">Guia do sistema</TabsTrigger>
          <TabsTrigger value="novidades">Novidades</TabsTrigger>
        </TabsList>
        <TabsContent value="guia" className="pt-4">
          <DocumentacaoViewer />
        </TabsContent>
        <TabsContent value="novidades" className="pt-4">
          <ChangelogViewer />
        </TabsContent>
      </Tabs>
    </div>
  )
}
