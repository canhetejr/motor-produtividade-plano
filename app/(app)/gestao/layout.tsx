import { ClipboardList } from 'lucide-react'

import { GestaoNav } from '@/components/layout/gestao-nav'
import { requireGestor } from '@/lib/auth'

export default async function GestaoLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireGestor()

  return (
    <div className="min-h-full min-w-0">
      <header className="border-b border-border bg-card/45 px-4 pt-5 backdrop-blur-md md:px-8 md:pt-7">
        <div className="mx-auto w-full max-w-7xl">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
              <ClipboardList className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Área do Gestor</h1>
              <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                Acompanhe a equipe e organize os recursos da operação.
              </p>
            </div>
          </div>
          <GestaoNav isAdmin={Boolean(profile.admin)} />
        </div>
      </header>
      {children}
    </div>
  )
}
