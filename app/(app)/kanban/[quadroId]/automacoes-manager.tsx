'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ArrowRight, MoreHorizontal, Plus, Search, Zap, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { SkeletonLista } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { rotuloEvento, rotuloAcao } from '@/lib/automacoes-catalogo'
import {
  listarAutomacoes,
  alternarAutomacaoAtiva,
  excluirAutomacao,
  duplicarAutomacao,
} from '../actions-automacoes'
import { AutomacaoBuilderDialog } from './automacao-builder-dialog'
import type { Automacao, Coluna, Etiqueta, MembroQuadro, CampoCustomizado } from './types'

type Filtro = 'todas' | 'ativas' | 'inativas' | 'erro'

export function AutomacoesManager({
  aberto,
  quadroId,
  colunas,
  etiquetas,
  membros,
  camposCustomizados,
  isGestor,
  onClose,
}: {
  aberto: boolean
  quadroId: string
  colunas: Coluna[]
  etiquetas: Etiqueta[]
  membros: MembroQuadro[]
  camposCustomizados: CampoCustomizado[]
  isGestor: boolean
  onClose: () => void
}) {
  const [automacoes, setAutomacoes] = useState<Automacao[]>([])
  const [carregado, setCarregado] = useState(false)
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [busca, setBusca] = useState('')
  const [builderAberto, setBuilderAberto] = useState(false)
  const [emEdicao, setEmEdicao] = useState<Automacao | null>(null)
  const [, startTransition] = useTransition()

  function recarregar() {
    listarAutomacoes(quadroId).then((r) => {
      if (r.ok) setAutomacoes(r.data ?? [])
      setCarregado(true)
    })
  }

  useEffect(() => {
    if (aberto) recarregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, quadroId])

  const ativas = automacoes.filter((a) => a.ativa).length
  const inativas = automacoes.length - ativas
  const comErro = automacoes.filter((a) => a.ultimoStatus === 'erro').length
  const totalAcoes = automacoes.reduce((soma, a) => soma + a.totalExecucoes, 0)

  const visiveis = automacoes.filter((a) => {
    if (filtro === 'ativas' && !a.ativa) return false
    if (filtro === 'inativas' && a.ativa) return false
    if (filtro === 'erro' && a.ultimoStatus !== 'erro') return false
    const q = busca.trim().toLowerCase()
    if (q && !a.nome.toLowerCase().includes(q) && !rotuloEvento(a.evento).toLowerCase().includes(q)) return false
    return true
  })

  function handleAlternar(automacao: Automacao) {
    setAutomacoes((prev) => prev.map((a) => (a.id === automacao.id ? { ...a, ativa: !a.ativa } : a)))
    startTransition(async () => {
      const result = await alternarAutomacaoAtiva(automacao.id, quadroId, !automacao.ativa)
      if (!result.ok) {
        toast.error(result.error)
        recarregar()
      }
    })
  }

  function handleExcluir(automacao: Automacao) {
    if (!confirm(`Excluir a automação "${automacao.nome}"?`)) return
    setAutomacoes((prev) => prev.filter((a) => a.id !== automacao.id))
    startTransition(async () => {
      const result = await excluirAutomacao(automacao.id, quadroId)
      if (!result.ok) {
        toast.error(result.error)
        recarregar()
      }
    })
  }

  function handleDuplicar(automacao: Automacao) {
    startTransition(async () => {
      const result = await duplicarAutomacao(automacao.id, quadroId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Automação duplicada (desligada).')
      recarregar()
    })
  }

  return (
    <>
      <Dialog open={aberto} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="w-full sm:w-[95vw] sm:max-w-4xl h-[88vh] max-h-[88vh] flex flex-col overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b border-border px-5 py-3">
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" /> Automações
            </DialogTitle>
          </DialogHeader>

          {/* Filtros + contadores */}
          <div className="shrink-0 flex flex-wrap items-center gap-2 border-b border-border px-5 py-2.5">
            <Select value={filtro} onValueChange={(v) => setFiltro((v as Filtro) ?? 'todas')}>
              <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="ativas">Ativas</SelectItem>
                <SelectItem value="inativas">Inativas</SelectItem>
                <SelectItem value="erro">Com erro</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative w-full sm:w-56">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar"
                className="h-8 pl-8 text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-3xs font-bold">
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-600 dark:text-emerald-400">
                {ativas} ATIVA{ativas === 1 ? '' : 'S'}
              </span>
              <span
                className={
                  'rounded-full border px-2 py-0.5 ' +
                  (comErro > 0
                    ? 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                    : 'border-border bg-muted text-muted-foreground')
                }
              >
                {comErro} COM ERRO
              </span>
              <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-muted-foreground">
                {inativas} INATIVA{inativas === 1 ? '' : 'S'}
              </span>
            </div>

            <span className="ml-auto text-2xs text-muted-foreground">
              {totalAcoes} execuç{totalAcoes === 1 ? 'ão registrada' : 'ões registradas'}
            </span>
          </div>

          {/* Lista */}
          <div className="flex-1 space-y-2.5 overflow-y-auto p-4 custom-scrollbar">
            {!carregado ? (
              <SkeletonLista itens={3} />
            ) : visiveis.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-14 text-center">
                <Zap className="mb-2 h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm font-semibold text-muted-foreground">
                  {automacoes.length === 0 ? 'Nenhuma automação neste quadro.' : 'Nenhuma automação com esse filtro.'}
                </p>
                {automacoes.length === 0 && (
                  <p className="mt-0.5 text-xs text-muted-foreground/70">
                    Automações movem, alocam e avisam sozinhas quando algo acontece no card.
                  </p>
                )}
              </div>
            ) : (
              visiveis.map((automacao) => (
                <div
                  key={automacao.id}
                  className={
                    'rounded-xl border bg-card p-3.5 transition-colors ' +
                    (automacao.ativa ? 'border-border' : 'border-border/60 opacity-60')
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="truncate text-sm font-bold text-foreground">{automacao.nome}</h4>
                        {automacao.ultimoStatus === 'erro' && (
                          <span className="flex shrink-0 items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-3xs font-bold text-rose-600 dark:text-rose-400">
                            <AlertTriangle className="h-2.5 w-2.5" /> erro
                          </span>
                        )}
                        {automacao.ultimoStatus === 'cortado' && (
                          <span
                            className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-3xs font-bold text-amber-600 dark:text-amber-400"
                            title="A automação encadeou fundo demais e foi interrompida para não virar um laço infinito."
                          >
                            encadeamento cortado
                          </span>
                        )}
                      </div>
                      <p className="text-2xs text-muted-foreground">
                        Criado por {automacao.criadoPorNome ?? '—'}
                        {automacao.totalExecucoes > 0 && ` · ${automacao.totalExecucoes} execuç${automacao.totalExecucoes === 1 ? 'ão' : 'ões'}`}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      {/* Primitivo do design system — o toggle daqui era feito
                          na mão e já divergia do resto do app em foco e tamanho. */}
                      <Switch
                        checked={automacao.ativa}
                        onCheckedChange={() => handleAlternar(automacao)}
                        disabled={!isGestor}
                        aria-label={automacao.ativa ? `Desativar ${automacao.nome}` : `Ativar ${automacao.nome}`}
                      />

                      {isGestor && (
                        <DropdownMenu>
                          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Ações da automação ${automacao.nome}`} />}>
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setEmEdicao(automacao); setBuilderAberto(true) }}>
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicar(automacao)}>Duplicar</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onClick={() => handleExcluir(automacao)}>
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>

                  {/* Evento → ações numeradas, como no fluxo da ferramenta de referência */}
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
                    <div className="flex items-center gap-2 sm:w-64 sm:shrink-0">
                      <span className="text-xs font-semibold text-foreground">
                        Quando {rotuloEvento(automacao.evento).toLowerCase()}
                      </span>
                    </div>
                    <ArrowRight className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:mt-0.5 sm:block" />
                    <div className="flex-1 space-y-1">
                      {automacao.acoes.map((acao, i) => (
                        <p key={acao.id} className="flex items-baseline gap-1.5 text-xs text-foreground">
                          <span className="font-mono text-3xs font-bold text-muted-foreground">#{i + 1}</span>
                          {rotuloAcao(acao.tipo)}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="shrink-0 flex items-center justify-between gap-3 border-t border-border px-5 py-3">
            <p className="text-2xs text-muted-foreground">
              Eventos de prazo e SLA são avaliados de hora em hora por uma rotina automática.
            </p>
            {isGestor && (
              <Button onClick={() => { setEmEdicao(null); setBuilderAberto(true) }} className="shrink-0">
                <Plus className="h-4 w-4" /> Nova automação
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {builderAberto && (
        <AutomacaoBuilderDialog
          // key força o rascunho a recomeçar do zero ao trocar de automação
          key={emEdicao?.id ?? 'nova'}
          aberto={builderAberto}
          automacao={emEdicao}
          quadroId={quadroId}
          colunas={colunas}
          etiquetas={etiquetas}
          membros={membros}
          camposCustomizados={camposCustomizados}
          onClose={() => setBuilderAberto(false)}
          onSalva={recarregar}
        />
      )}
    </>
  )
}
