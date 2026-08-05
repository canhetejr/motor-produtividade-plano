import { PageShell } from '@/components/layout/page-shell'
import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <PageShell>
      <div className="space-y-6" aria-busy="true" aria-label="Carregando conteúdo">
        <div className="flex items-start gap-3 border-b border-border/70 pb-5">
          <Skeleton className="size-9 shrink-0" />
          <div className="w-full max-w-xl space-y-2">
            <Skeleton className="h-7 w-52" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    </PageShell>
  )
}
