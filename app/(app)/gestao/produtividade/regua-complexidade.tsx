'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { SlidersHorizontal } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  NIVEIS_COMPLEXIDADE,
  ROTULO_COMPLEXIDADE,
  type NivelComplexidade,
} from '@/lib/produtividade'
import { salvarReguaComplexidade } from './actions'

/**
 * A régua que dá um tempo esperado às demandas de tempo variável.
 *
 * Mora nesta página, e não em /configuracoes, porque só faz sentido ajustá-la
 * olhando o resultado que ela produz: "muito alta" está em 120 min e a
 * produtividade dessas demandas vive em 60%? A régua é que está errada.
 * /configuracoes é sobre a conta de quem usa; isto é sobre a medição.
 */
export function ReguaComplexidade({
  minutosPorNivel,
}: {
  minutosPorNivel: Record<NivelComplexidade, number>
}) {
  const [aberto, setAberto] = useState(false)
  const [isPending, startTransition] = useTransition()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await salvarReguaComplexidade(formData)
      if (r.ok) {
        toast.success('Régua de complexidade atualizada.')
        setAberto(false)
      } else {
        toast.error(r.error)
      }
    })
  }

  return (
    <section className="rounded-md border border-border bg-card p-5 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            Régua de complexidade
          </h2>
          <p className="mt-0.5 max-w-xl text-xs text-muted-foreground">
            Quanto tempo cada nível representa nesta empresa. É o esperado das demandas de tempo
            variável. Mudar aqui vale para as próximas execuções — o que já foi medido não é
            reescrito.
          </p>
        </div>
        {!aberto && (
          <Button variant="outline" size="sm" onClick={() => setAberto(true)}>
            Ajustar
          </Button>
        )}
      </div>

      {aberto ? (
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {NIVEIS_COMPLEXIDADE.map((nivel) => (
              <div key={nivel} className="space-y-1.5">
                <Label htmlFor={`nivel-${nivel}`} className="text-xs">
                  {ROTULO_COMPLEXIDADE[nivel]}
                </Label>
                <Input
                  id={`nivel-${nivel}`}
                  name={nivel}
                  type="number"
                  min={1}
                  defaultValue={minutosPorNivel[nivel]}
                  required
                  className="h-10 text-center font-mono tabular-nums"
                />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Salvando...' : 'Salvar régua'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAberto(false)} disabled={isPending}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {NIVEIS_COMPLEXIDADE.map((nivel) => (
            <div key={nivel} className="rounded-md border border-border bg-muted/30 px-3 py-2">
              <dt className="text-xs text-muted-foreground">{ROTULO_COMPLEXIDADE[nivel]}</dt>
              <dd className="font-mono text-base font-medium tabular-nums text-foreground">
                {minutosPorNivel[nivel]} min
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}
