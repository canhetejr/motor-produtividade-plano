import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Estado vazio.
 *
 * Um estado vazio bom responde três perguntas: o que deveria estar aqui, por
 * que não está, e o que fazer agora. A base tinha oito variações de "Nenhum
 * item ainda." em itálico — que responde só a primeira, e mal.
 *
 * O grafismo é a malha de vértices da marca em opacidade baixa: linhas que
 * convergem para um ponto que ainda não existe. É a única ilustração aqui de
 * propósito — estado vazio é lugar de passagem, não de contemplação.
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
        'relative isolate flex flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-border px-6 py-12 text-center',
        className
      )}
    >
      {/* Malha de vértices estática. Não anima: o fundo de partículas já vive
          atrás da interface, e dois movimentos competindo cansam. */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 h-full w-full opacity-[0.07]"
        viewBox="0 0 400 200"
        preserveAspectRatio="xMidYMid slice"
      >
        <g stroke="currentColor" strokeWidth="1" fill="none">
          <path d="M40 30 L200 100 M120 20 L200 100 M40 170 L200 100 M120 180 L200 100" />
          <path d="M360 30 L200 100 M280 20 L200 100 M360 170 L200 100 M280 180 L200 100" />
        </g>
        <g fill="currentColor">
          {[
            [40, 30],
            [120, 20],
            [40, 170],
            [120, 180],
            [360, 30],
            [280, 20],
            [360, 170],
            [280, 180],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="3" />
          ))}
          <circle cx="200" cy="100" r="5" />
        </g>
      </svg>

      {Icone && (
        <div className="mb-3 rounded-lg bg-muted p-2.5 text-muted-foreground">
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
