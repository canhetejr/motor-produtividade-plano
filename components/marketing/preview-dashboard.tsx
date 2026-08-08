import { cn } from '@/lib/utils'

/**
 * Maquete do dashboard de capacidade — o painel que responde "quem está
 * sobrecarregado e quem tem folga agora". Mesma regra da PreviewKanban:
 * HTML/CSS puro, dado fictício, mas fiel aos campos que o produto calcula
 * de verdade (índice de produtividade, entregue sobre a meta de cada um).
 */

const PESSOAS = [
  { nome: 'Luiz S.', pct: 128, situacao: 'sobrecarregado' as const },
  { nome: 'Mariana F.', pct: 104, situacao: 'no_limite' as const },
  { nome: 'Camila F.', pct: 92, situacao: 'equilibrado' as const },
  { nome: 'Taynara R.', pct: 87, situacao: 'equilibrado' as const },
  { nome: 'William N.', pct: 46, situacao: 'ocioso' as const },
]

const COR: Record<(typeof PESSOAS)[number]['situacao'], { barra: string; texto: string }> = {
  sobrecarregado: { barra: 'bg-rose-500', texto: 'text-rose-300' },
  no_limite: { barra: 'bg-amber-500', texto: 'text-amber-300' },
  equilibrado: { barra: 'bg-[var(--v-mint)]', texto: 'text-[var(--v-mint)]' },
  ocioso: { barra: 'bg-white/25', texto: 'text-white/45' },
}

/** Barras da evolução semanal — altura em % dentro do container. */
const SEMANA = [62, 71, 68, 84, 91, 88, 96]

export function PreviewDashboard({ className }: { className?: string }) {
  return (
    <div className={cn('grid gap-3 sm:grid-cols-[1.1fr_1fr]', className)}>
      <section className="rounded-md border border-white/10 bg-white/[0.03] p-3">
        <p className="text-[11px] font-semibold text-white/80">Capacidade da equipe</p>
        <p className="mt-0.5 text-[9px] text-white/40">Entregue sobre a meta de cada um no período.</p>
        <ul className="mt-3 flex flex-col gap-2">
          {PESSOAS.map((p) => (
            <li key={p.nome} className="flex items-center gap-2">
              <span className="w-20 shrink-0 truncate text-[10px] text-white/75">{p.nome}</span>
              <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/8">
                <span
                  className={cn('block h-full rounded-full', COR[p.situacao].barra)}
                  style={{ width: `${Math.min(100, p.pct)}%` }}
                />
              </span>
              <span className={cn('w-9 shrink-0 text-right font-mono text-[10px] font-semibold', COR[p.situacao].texto)}>
                {p.pct}%
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-col gap-3">
        <section className="rounded-md border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-white/40">Índice do time</p>
          <p className="mt-1 font-mono text-3xl font-medium leading-none text-[var(--v-mint)]">94%</p>
          <p className="mt-1.5 text-[9px] text-white/40">
            <span className="text-[var(--v-mint)]">+6 pts</span> vs. semana anterior
          </p>
        </section>
        <section className="flex-1 rounded-md border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-white/40">Últimas 7 semanas</p>
          <div className="mt-2.5 flex h-14 items-end gap-1.5" aria-hidden>
            {SEMANA.map((altura, i) => (
              <span
                key={i}
                className={cn(
                  'min-w-0 flex-1 rounded-sm',
                  i === SEMANA.length - 1 ? 'bg-[var(--v-mint)]' : 'bg-primary/45'
                )}
                style={{ height: `${altura}%` }}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
