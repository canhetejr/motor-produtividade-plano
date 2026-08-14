'use client'

import { cn } from '@/lib/utils'
import { Rotulo } from './dados-tecnicos'

/**
 * Três organizações, três espaços.
 *
 * Sem cadeado, sem escudo, sem estética de invasão. O isolamento é mostrado
 * como o que ele é no produto: uma propriedade da estrutura. Cada célula tem a
 * própria fronteira, o próprio conteúdo e a própria contagem — e nada aparece
 * em duas ao mesmo tempo.
 *
 * A célula do meio é a única com acento, e é a única que se destaca em relevo:
 * "a sua" tem um lugar definido no meio das outras, sem que as outras fiquem
 * escondidas. Esconder as vizinhas contaria a história errada — o ponto não é
 * que ninguém mais existe, é que o dado de cada uma não encosta no da outra.
 */

// Número já formatado, e não `toLocaleString` em tempo de render: este é um
// Client Component, então a string é produzida no servidor e conferida na
// hidratação — qualquer diferença de ICU entre Node e navegador viraria um
// erro de hidratação por uma vírgula.
const CELULAS = [
  { org: 'Organização A', demandas: '812', pessoas: 24, propria: false },
  { org: 'Sua organização', demandas: '1.347', pessoas: 12, propria: true },
  { org: 'Organização C', demandas: '496', pessoas: 9, propria: false },
] as const

export function CelulasIsolamento({ className }: { className?: string }) {
  return (
    <div className={cn('grid gap-3 sm:grid-cols-3', className)}>
      {CELULAS.map((c) => (
        <div
          key={c.org}
          className={cn(
            'relative overflow-hidden rounded-md border p-4 transition-colors',
            c.propria
              ? 'border-primary/35 bg-primary/[0.04]'
              : 'border-white/10 bg-white/[0.02]'
          )}
        >
          {/* A superfície que delimita o espaço: quase invisível, mas presente.
              É a fronteira, não um enfeite de vidro. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(circle, color-mix(in oklch, currentColor, transparent 92%) 1px, transparent 1px)',
              backgroundSize: '14px 14px',
              color: c.propria ? 'var(--primary)' : '#ffffff',
            }}
          />
          <div className="relative">
            <Rotulo acento={c.propria}>{c.org}</Rotulo>
            <p
              className={cn(
                'mt-3 font-mono text-2xl font-medium tabular-nums leading-none',
                c.propria ? 'text-primary' : 'text-white/35'
              )}
            >
              {c.demandas}
            </p>
            <p className="mt-1.5 text-3xs text-white/40">demandas · {c.pessoas} pessoas</p>
          </div>
        </div>
      ))}
    </div>
  )
}
