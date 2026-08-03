import Link from 'next/link'
import { CalendarCheck2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { EstadoBadge } from '@/components/ui/estado-badge'
import type { ChaveFaixa } from '@/lib/semana'

type Cartao = {
  id: string
  codigo: string
  titulo: string
  prazo: string
  prioridade: string
  etapa: string
  quadroId: string
  quadroNome: string
}

const CLASSE_FAIXA: Record<ChaveFaixa, string> = {
  atrasado: 'text-danger',
  hoje: 'text-primary',
  amanha: 'text-foreground',
  esta_semana: 'text-foreground',
  depois: 'text-muted-foreground',
}

const ESTADO_PRIORIDADE: Record<string, 'erro' | 'neutro'> = {
  alta: 'erro',
  media: 'neutro',
  baixa: 'neutro',
}

function formatarPrazo(iso: string) {
  // 'T00:00:00' força leitura como data local; sem isso o JS interpreta a
  // string curta como UTC e mostra o dia anterior no Brasil.
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  })
}

export function SemanaLista({
  faixas,
  total,
}: {
  faixas: Array<{ chave: ChaveFaixa; rotulo: string; cartoes: Cartao[] }>
  total: number
}) {
  if (total === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center">
        <CalendarCheck2 className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium">Nada com prazo por aqui.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Cards em que você é responsável e que têm data aparecem nesta lista.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {faixas.map((faixa) => (
        <section key={faixa.chave}>
          <h2
            className={cn(
              'mb-2 text-2xs font-bold uppercase tracking-wide',
              CLASSE_FAIXA[faixa.chave]
            )}
          >
            {faixa.rotulo} · {faixa.cartoes.length}
          </h2>

          <ul className="flex flex-col gap-2">
            {faixa.cartoes.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/kanban/${c.quadroId}?cartao=${c.id}`}
                  className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-3xs text-muted-foreground">{c.codigo}</p>
                    <p className="mt-0.5 text-sm leading-snug font-semibold">{c.titulo}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {c.quadroNome} · {c.etapa}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={cn(
                        'text-xs font-semibold tabular-nums',
                        CLASSE_FAIXA[faixa.chave]
                      )}
                    >
                      {formatarPrazo(c.prazo)}
                    </span>
                    <EstadoBadge
                      estado={ESTADO_PRIORIDADE[c.prioridade] ?? 'neutro'}
                      tamanho="sm"
                      className="uppercase"
                    >
                      {c.prioridade}
                    </EstadoBadge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
