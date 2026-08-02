'use client'

import { useState, useSyncExternalStore } from 'react'
import { Bookmark, BookmarkPlus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  chaveDeArmazenamento,
  filtrosVazios,
  lerVisoes,
  mesmosFiltros,
  removerVisao,
  salvarVisao,
  type FiltrosKanban,
  type VisaoSalva,
} from '@/lib/visoes-kanban'
import { cn } from '@/lib/utils'

// useSyncExternalStore em vez de useState + useEffect: o valor mora fora do
// React (localStorage) e o servidor não tem acesso a ele. O snapshot do
// servidor é constante, o que evita erro de hidratação.
const VAZIO: VisaoSalva[] = []

function assinar(callback: () => void) {
  window.addEventListener('storage', callback)
  window.addEventListener('vertice:visoes', callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener('vertice:visoes', callback)
  }
}

export function VisoesSalvas({
  quadroId,
  filtros,
  onAplicar,
}: {
  quadroId: string
  filtros: FiltrosKanban
  onAplicar: (f: FiltrosKanban) => void
}) {
  const chave = chaveDeArmazenamento(quadroId)
  const [aberto, setAberto] = useState(false)
  const [nome, setNome] = useState('')

  const bruto = useSyncExternalStore(
    assinar,
    () => localStorage.getItem(chave),
    () => null
  )
  // Reparsear a cada render é barato aqui (lista curta) e evita um cache que
  // precisaria ser invalidado junto com o storage.
  const visoes = bruto === null ? VAZIO : lerVisoes(bruto)

  function gravar(proximas: VisaoSalva[]) {
    localStorage.setItem(chave, JSON.stringify(proximas))
    // O evento `storage` só dispara em OUTRAS abas; sem este a própria aba não
    // se atualiza.
    window.dispatchEvent(new Event('vertice:visoes'))
  }

  function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return
    gravar(
      salvarVisao(visoes, {
        id: crypto.randomUUID(),
        nome: nome.trim(),
        ...filtros,
      })
    )
    setNome('')
    setAberto(false)
  }

  const podeSalvar = !filtrosVazios(filtros)
  const ativa = visoes.find((v) => mesmosFiltros(v, filtros))

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            aria-label="Visões salvas"
            className={cn('h-9 gap-1.5 text-xs md:h-8', ativa && 'border-primary/40 text-primary')}
          />
        }
      >
        <Bookmark className={cn('h-3.5 w-3.5', ativa && 'fill-current')} />
        <span className="hidden max-w-24 truncate sm:inline">{ativa ? ativa.nome : 'Visões'}</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 max-w-[calc(100vw-2rem)] p-2">
        {visoes.length > 0 && (
          <ul className="mb-2 flex flex-col gap-0.5">
            {visoes.map((v) => (
              <li key={v.id} className="flex items-center gap-1">
                <button
                  onClick={() => {
                    onAplicar({ busca: v.busca, prioridade: v.prioridade, responsavel: v.responsavel })
                    setAberto(false)
                  }}
                  className={cn(
                    'min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted',
                    ativa?.id === v.id && 'font-semibold text-primary'
                  )}
                >
                  {v.nome}
                </button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Excluir visão ${v.nome}`}
                  onClick={() => gravar(removerVisao(visoes, v.id))}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        {podeSalvar ? (
          <form onSubmit={salvar} className="flex items-center gap-1.5 border-t border-border pt-2">
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome da visão"
              aria-label="Nome da visão"
              className="h-8 text-sm"
            />
            <Button type="submit" size="icon-sm" aria-label="Salvar visão atual" disabled={!nome.trim()}>
              <BookmarkPlus className="h-3.5 w-3.5" />
            </Button>
          </form>
        ) : (
          <p className="border-t border-border px-2 pt-2 text-xs text-muted-foreground">
            Aplique um filtro para poder salvá-lo como visão.
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}
