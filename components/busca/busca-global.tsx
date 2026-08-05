'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search, KanbanSquare, Package, User, Loader2 } from 'lucide-react'

import { buscar, type ResultadoBusca } from './acoes'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const ICONE = {
  cartao: KanbanSquare,
  demanda: Package,
  colaborador: User,
} as const

export function BuscaGlobal() {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [termo, setTermo] = useState('')
  const [resultados, setResultados] = useState<ResultadoBusca[]>([])
  const [selecionado, setSelecionado] = useState(0)
  const [buscando, startBusca] = useTransition()
  const ultimaBusca = useRef(0)

  // ⌘K / Ctrl+K de qualquer tela.
  useEffect(() => {
    const atalho = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setAberto((v) => !v)
      }
    }
    window.addEventListener('keydown', atalho)
    return () => window.removeEventListener('keydown', atalho)
  }, [])

  useEffect(() => {
    if (termo.trim().length < 2) return
    // Debounce: sem ele cada tecla dispara uma ida ao banco.
    const id = setTimeout(() => {
      const carimbo = ++ultimaBusca.current
      startBusca(async () => {
        const achados = await buscar(termo)
        // Resposta de uma busca antiga chegando depois da nova sobrescreveria a
        // lista com resultado do termo errado.
        if (carimbo !== ultimaBusca.current) return
        setResultados(achados)
        setSelecionado(0)
      })
    }, 250)
    return () => clearTimeout(id)
  }, [termo])

  // Limpar ao fechar e consequencia do evento de fechar, nao sincronizacao —
  // fazer isso num efeito e o que o react-hooks/set-state-in-effect aponta.
  function alternar(proximo: boolean) {
    setAberto(proximo)
    if (!proximo) {
      setTermo('')
      setResultados([])
      setSelecionado(0)
    }
  }

  const termoLimpo = termo.trim()
  const curto = termoLimpo.length < 2
  // Derivado, nao guardado: com termo curto a lista e vazia por definicao.
  const visiveis = curto ? [] : resultados

  function abrir(r: ResultadoBusca) {
    setAberto(false)
    router.push(r.href)
  }

  function teclado(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelecionado((i) => Math.min(i + 1, visiveis.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelecionado((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && visiveis[selecionado]) {
      e.preventDefault()
      abrir(visiveis[selecionado])
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setAberto(true)}
        aria-label="Buscar"
        className="h-8 gap-2 text-muted-foreground"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Buscar</span>
        <kbd className="hidden rounded border border-border px-1 font-mono text-3xs md:inline">
          ⌘K
        </kbd>
      </Button>

      <Dialog open={aberto} onOpenChange={alternar}>
        <DialogContent className="top-[10vh] max-w-lg translate-y-0 gap-0 p-0 sm:max-w-lg">
          <DialogTitle className="sr-only">Busca global</DialogTitle>

          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              autoFocus
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              onKeyDown={teclado}
              placeholder="Card, demanda ou pessoa…"
              aria-label="Termo de busca"
              className="h-12 border-0 px-0 text-base focus-visible:ring-0"
            />
            {buscando && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
          </div>

          <div className="max-h-[60dvh] overflow-y-auto custom-scrollbar p-1.5">
            {curto ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                Digite ao menos duas letras.
              </p>
            ) : visiveis.length === 0 && !buscando ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                Nada encontrado para “{termoLimpo}”.
              </p>
            ) : (
              <ul role="listbox" aria-label="Resultados">
                {visiveis.map((r, i) => {
                  const Icone = ICONE[r.tipo]
                  return (
                    <li key={`${r.tipo}-${r.id}`}>
                      <button
                        role="option"
                        aria-selected={i === selecionado}
                        onClick={() => abrir(r)}
                        onMouseEnter={() => setSelecionado(i)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors',
                          i === selecionado ? 'bg-muted' : 'hover:bg-muted/60'
                        )}
                      >
                        <Icone className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{r.titulo}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {r.detalhe}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
