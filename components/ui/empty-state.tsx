import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Estado vazio.
 *
 * Um estado vazio bom responde três perguntas: o que deveria estar aqui, por
 * que não está, e o que fazer agora. A base tinha oito variações de "Nenhum
 * item ainda." em itálico — que responde só a primeira, e mal.
 */
export function EmptyState({
  titulo,
  descricao,
  icone: Icone,
  acao,
  className,
}: {
  titulo: string
  /** O que fazer agora, não uma repetição do título. */
  descricao?: string
  icone?: LucideIcon
  acao?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-md border border-dashed border-border bg-card/40 px-6 py-10 text-center',
        className
      )}
    >
      {Icone && (
        <div className="mb-3 rounded-md border border-border bg-muted p-2.5 text-muted-foreground">
          <Icone className="h-5 w-5" aria-hidden />
        </div>
      )}

      <p className="text-sm font-semibold">{titulo}</p>
      {descricao && (
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">{descricao}</p>
      )}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  )
}
