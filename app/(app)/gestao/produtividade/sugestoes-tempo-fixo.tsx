'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Wand2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { formatarTempo } from '@/lib/tempo'
import { DISPERSAO_ALTA, type SugestaoTempoFixo } from '@/lib/produtividade'
import { aplicarTempoFixoSugerido } from './actions'

export type LinhaSugestao = {
  demandaId: string
  nome: string
  areaNome: string
  sugestao: SugestaoTempoFixo
}

/**
 * Demandas de tempo variável com histórico suficiente para virar tempo fixo.
 *
 * A variação aparece junto da média porque é ela que distingue uma demanda
 * que sempre leva 45 min de uma que leva 10 ou 90 conforme o caso. Fixar
 * tempo padrão na segunda seria trocar "não sei medir" por "meço errado", e
 * só quem vê a amplitude consegue recusar a sugestão com fundamento.
 */
export function SugestoesTempoFixo({ linhas }: { linhas: LinhaSugestao[] }) {
  const [isPending, startTransition] = useTransition()

  if (linhas.length === 0) return null

  function aplicar(demandaId: string, nome: string) {
    startTransition(async () => {
      const r = await aplicarTempoFixoSugerido(demandaId)
      if (r.ok) toast.success(`"${nome}" agora tem tempo padrão.`)
      else toast.error(r.error)
    })
  }

  return (
    <section className="rounded-md border border-border bg-card p-5 shadow-xs">
      <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
        <Wand2 className="h-4 w-4 text-muted-foreground" />
        Pronto para virar tempo fixo
      </h2>
      <p className="mt-0.5 max-w-xl text-xs text-muted-foreground">
        Estas demandas de tempo variável já têm execuções suficientes para calcular um tempo padrão.
        Fixar melhora o índice de todo mundo que lança nelas — mas confira a variação antes.
      </p>

      <ul className="mt-4 flex flex-col gap-2.5">
        {linhas.map(({ demandaId, nome, areaNome, sugestao }) => {
          const disperso = sugestao.dispersao > DISPERSAO_ALTA
          return (
            <li
              key={demandaId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{nome}</p>
                <p className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground">
                  {areaNome} · {sugestao.execucoes} execuções · média {formatarTempo(sugestao.minutos)}{' '}
                  · variação {formatarTempo(sugestao.min_real_min)}–{formatarTempo(sugestao.max_real_min)}
                </p>
                {disperso && (
                  <p className="mt-1 text-xs text-warning-texto">
                    Os tempos variam muito entre si — talvez esta demanda seja mesmo variável, ou
                    esteja juntando trabalhos diferentes sob o mesmo nome.
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => aplicar(demandaId, nome)}
              >
                Fixar em {formatarTempo(sugestao.minutos)}
              </Button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
