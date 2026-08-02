'use client'

import { useEffect, useState, useTransition } from 'react'
import { Ban, Check, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  listarDependencias,
  adicionarDependencia,
  removerDependencia,
  type Dependencia,
} from '../actions-dependencias'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type CartaoOpcao = { id: string; codigo: string | null; titulo: string }

/**
 * "Este card está bloqueado por…" — dependências diretas do card aberto.
 *
 * A validação de ciclo mora no servidor, porque só lá se enxerga o grafo
 * inteiro: A→B→C→A não é detectável olhando um card de cada vez.
 */
export function DependenciasWidget({
  cartaoId,
  quadroId,
  candidatos,
}: {
  cartaoId: string
  quadroId: string
  /** Cards do quadro, exceto este. */
  candidatos: CartaoOpcao[]
}) {
  const [dependencias, setDependencias] = useState<Dependencia[]>([])
  const [carregado, setCarregado] = useState(false)
  const [adicionando, setAdicionando] = useState(false)
  const [escolhido, setEscolhido] = useState('')
  const [pendente, startTransition] = useTransition()

  useEffect(() => {
    listarDependencias(cartaoId).then((r) => {
      if (r.ok) setDependencias(r.data ?? [])
      setCarregado(true)
    })
  }, [cartaoId])

  function recarregar() {
    listarDependencias(cartaoId).then((r) => {
      if (r.ok) setDependencias(r.data ?? [])
    })
  }

  function adicionar() {
    if (!escolhido) return
    startTransition(async () => {
      const r = await adicionarDependencia(cartaoId, escolhido, quadroId)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      setEscolhido('')
      setAdicionando(false)
      recarregar()
    })
  }

  function remover(id: string) {
    startTransition(async () => {
      const r = await removerDependencia(id, quadroId)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      recarregar()
    })
  }

  const pendentes = dependencias.filter((d) => !d.entregue)
  // Já ligados não podem ser escolhidos de novo — o servidor recusaria, mas
  // oferecer a opção só para recusar depois é ruim.
  const jaLigados = new Set(dependencias.map((d) => d.dependeDeId))
  const disponiveis = candidatos.filter((c) => !jaLigados.has(c.id))

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
          Bloqueado por
        </span>
        {!adicionando && disponiveis.length > 0 && (
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Adicionar dependência"
            onClick={() => setAdicionando(true)}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {pendentes.length > 0 && (
        <p className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-2xs font-semibold text-amber-700 dark:text-amber-400">
          <Ban className="h-3.5 w-3.5 shrink-0" />
          {pendentes.length === 1
            ? 'Aguardando 1 card ser entregue'
            : `Aguardando ${pendentes.length} cards serem entregues`}
        </p>
      )}

      {carregado && dependencias.length === 0 && !adicionando && (
        <p className="text-2xs italic text-muted-foreground">Nada bloqueando este card.</p>
      )}

      <ul className="space-y-1">
        {dependencias.map((d) => (
          <li
            key={d.id}
            className="group/dep flex items-center gap-2 rounded-lg border border-border bg-secondary/20 px-2 py-1.5 text-xs"
          >
            {d.entregue ? (
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Ban className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            )}
            <span className={cn('min-w-0 flex-1 truncate', d.entregue && 'text-muted-foreground line-through')}>
              {d.codigo && <span className="font-mono text-3xs text-muted-foreground">{d.codigo} </span>}
              {d.titulo}
            </span>
            <button
              type="button"
              onClick={() => remover(d.id)}
              aria-label={`Remover dependência de ${d.titulo}`}
              className="shrink-0 text-muted-foreground opacity-0 transition-opacity max-md:opacity-100 focus-within:opacity-100 group-hover/dep:opacity-100 hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </li>
        ))}
      </ul>

      {adicionando && (
        <div className="flex items-center gap-1.5">
          <select
            value={escolhido}
            onChange={(e) => setEscolhido(e.target.value)}
            aria-label="Card bloqueador"
            className="h-8 min-w-0 flex-1 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring dark:bg-input/30"
          >
            <option value="">Selecione o card…</option>
            {disponiveis.map((c) => (
              <option key={c.id} value={c.id}>
                {c.codigo ? `${c.codigo} · ` : ''}
                {c.titulo}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={adicionar} disabled={!escolhido || pendente}>
            Ligar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setAdicionando(false)
              setEscolhido('')
            }}
          >
            Cancelar
          </Button>
        </div>
      )}
    </div>
  )
}
