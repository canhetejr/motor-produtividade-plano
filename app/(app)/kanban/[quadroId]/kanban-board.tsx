'use client'

import { useEffect, useMemo, useRef, useState, useTransition, useId } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { createClient } from '@/utils/supabase/client'
import { criarColuna, renomearColuna, excluirColuna, moverCartao } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, Search, Plus, X, LayoutGrid, List as ListIcon, CalendarDays, FileText } from 'lucide-react'
import { KanbanColumn } from './kanban-column'
import { KanbanCard } from './kanban-card'
import { CreateCardDialog } from './create-card-dialog'
import { CardDetailDialog } from './card-detail-dialog'
import { ListView } from './list-view'
import { CalendarView } from './calendar-view'
import { FormulariosManager } from './formularios-manager'
import type { Cartao, Coluna, Etiqueta, MembroQuadro, MembroNaoAutorizado, Quadro, Formulario } from './types'

const PRIORIDADE_LABEL: Record<Cartao['prioridade'], string> = { baixa: 'Baixa', media: 'Média', alta: 'Alta' }

export function KanbanBoard({
  quadro,
  colunasIniciais,
  cartoesIniciais,
  etiquetasIniciais,
  membrosQuadro,
  membrosNaoAutorizados,
  areas,
  formulariosIniciais,
  currentUserId,
}: {
  quadro: Quadro
  colunasIniciais: Coluna[]
  cartoesIniciais: Cartao[]
  etiquetasIniciais: Etiqueta[]
  membrosQuadro: MembroQuadro[]
  membrosNaoAutorizados: MembroNaoAutorizado[]
  areas: { id: string; nome: string }[]
  formulariosIniciais: Formulario[]
  currentUserId: string
}) {
  const [colunas, setColunas] = useState(colunasIniciais)
  const [cartoes, setCartoes] = useState(cartoesIniciais)
  const [etiquetas, setEtiquetas] = useState(etiquetasIniciais)
  // Sem drag/realtime aqui (diferente de colunas/cartões) — a lista vem
  // direto da prop, e os componentes de formulário chamam router.refresh()
  // após criar/editar/excluir pra buscar o estado novo do servidor.
  const formularios = formulariosIniciais
  const [view, setView] = useState<'kanban' | 'lista' | 'calendario' | 'formularios'>('kanban')
  const [busca, setBusca] = useState('')
  const [filtroPrioridade, setFiltroPrioridade] = useState('todas')
  const [filtroResponsavel, setFiltroResponsavel] = useState('todos')
  const [novaColunaAberta, setNovaColunaAberta] = useState(false)
  const [novaColunaNome, setNovaColunaNome] = useState('')
  const [createColunaId, setCreateColunaId] = useState<string | null>(null)
  const [selectedCartaoId, setSelectedCartaoId] = useState<string | null>(null)
  const [activeCartaoId, setActiveCartaoId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const colunaIdsRef = useRef<Set<string>>(new Set(colunas.map((c) => c.id)))
  useEffect(() => {
    colunaIdsRef.current = new Set(colunas.map((c) => c.id))
  }, [colunas])

  const dndId = useId()
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  )

  // Realtime: reage a colunas/cards criados/editados/movidos por outros
  // membros do quadro (mesmo padrão de components/layout/notification-bell.tsx).
  useEffect(() => {
    const supabase = createClient()

    const colunasChannel = supabase
      .channel(`quadro:${quadro.id}:colunas`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'colunas', filter: `quadro_id=eq.${quadro.id}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as { id: string }).id
            setColunas((prev) => prev.filter((c) => c.id !== oldId))
            setCartoes((prev) => prev.filter((c) => c.coluna_id !== oldId))
            return
          }
          const nova = payload.new as Coluna
          setColunas((prev) => (prev.some((c) => c.id === nova.id) ? prev.map((c) => (c.id === nova.id ? nova : c)) : [...prev, nova]))
        }
      )
      .subscribe()

    // cartoes não tem coluna quadro_id direta, então escuta geral e filtra
    // pelo conjunto de colunas deste quadro (colunaIdsRef, sempre atual).
    const cartoesChannel = supabase
      .channel(`quadro:${quadro.id}:cartoes`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cartoes' }, async (payload) => {
        if (payload.eventType === 'DELETE') {
          const oldId = (payload.old as { id: string }).id
          setCartoes((prev) => prev.filter((c) => c.id !== oldId))
          return
        }
        const novaColunaId = (payload.new as { coluna_id: string }).coluna_id
        if (!colunaIdsRef.current.has(novaColunaId)) return

        const novoId = (payload.new as { id: string }).id
        const { data } = await supabase
          .from('cartoes')
          .select('*, cartoes_responsaveis(colaborador_id), cartoes_etiquetas(etiqueta_id)')
          .eq('id', novoId)
          .single()
        if (!data) return
        const formatado: Cartao = {
          id: data.id,
          coluna_id: data.coluna_id,
          titulo: data.titulo,
          descricao: data.descricao,
          posicao: data.posicao,
          prioridade: data.prioridade,
          prazo: data.prazo,
          codigo: data.codigo,
          responsaveis: (data.cartoes_responsaveis ?? []).map((r: { colaborador_id: string }) => r.colaborador_id),
          etiquetas: (data.cartoes_etiquetas ?? []).map((e: { etiqueta_id: string }) => e.etiqueta_id),
          tipo: data.tipo,
          cartaoPaiId: data.cartao_pai_id,
          inicioDesejado: data.inicio_desejado,
          entregueEm: data.entregue_em,
          tempoEstimadoMin: data.tempo_estimado_min,
          centroId: data.centro_id,
          tagReferencia: data.tag_referencia,
          recorrencia: data.recorrencia as Cartao['recorrencia'],
        }
        setCartoes((prev) => (prev.some((c) => c.id === formatado.id) ? prev.map((c) => (c.id === formatado.id ? formatado : c)) : [...prev, formatado]))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(colunasChannel)
      supabase.removeChannel(cartoesChannel)
    }
  }, [quadro.id])

  function isCartaoVisivel(cartao: Cartao) {
    if (busca.trim()) {
      const q = busca.toLowerCase()
      if (!cartao.titulo.toLowerCase().includes(q) && !cartao.codigo.toLowerCase().includes(q) && !cartao.descricao?.toLowerCase().includes(q)) {
        return false
      }
    }
    if (filtroPrioridade !== 'todas' && cartao.prioridade !== filtroPrioridade) return false
    if (filtroResponsavel !== 'todos' && !cartao.responsaveis.includes(filtroResponsavel)) return false
    return true
  }

  const cartoesFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return cartoes.filter((cartao) => {
      if (q && !cartao.titulo.toLowerCase().includes(q) && !cartao.codigo.toLowerCase().includes(q) && !cartao.descricao?.toLowerCase().includes(q)) {
        return false
      }
      if (filtroPrioridade !== 'todas' && cartao.prioridade !== filtroPrioridade) return false
      if (filtroResponsavel !== 'todos' && !cartao.responsaveis.includes(filtroResponsavel)) return false
      return true
    })
  }, [cartoes, busca, filtroPrioridade, filtroResponsavel])

  function cartoesDaColuna(colunaId: string) {
    return cartoes.filter((c) => c.coluna_id === colunaId)
  }

  const activeCartao = activeCartaoId ? cartoes.find((c) => c.id === activeCartaoId) ?? null : null
  const selectedCartao = selectedCartaoId ? cartoes.find((c) => c.id === selectedCartaoId) ?? null : null

  function handleDragStart(event: DragStartEvent) {
    setActiveCartaoId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveCartaoId(null)
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)
    const ativo = cartoes.find((c) => c.id === activeId)
    if (!ativo) return

    const overEhColuna = colunas.some((col) => col.id === overId)
    const overCartao = cartoes.find((c) => c.id === overId)
    const destColunaId = overEhColuna ? overId : overCartao?.coluna_id
    if (!destColunaId) return
    if (destColunaId === ativo.coluna_id && overId === activeId) return

    const origemColunaId = ativo.coluna_id
    const prevCartoes = cartoes

    const semAtivo = cartoes.filter((c) => c.id !== activeId)
    const destList = semAtivo.filter((c) => c.coluna_id === destColunaId)
    const insertIndex = !overEhColuna && overCartao ? Math.max(destList.findIndex((c) => c.id === overId), 0) : destList.length

    const movido: Cartao = { ...ativo, coluna_id: destColunaId }
    const novaLista = [...semAtivo]
    let flatInsertAt = novaLista.length
    let count = 0
    for (let i = 0; i < novaLista.length; i++) {
      if (novaLista[i].coluna_id === destColunaId) {
        if (count === insertIndex) {
          flatInsertAt = i
          break
        }
        count++
      }
    }
    novaLista.splice(flatInsertAt, 0, movido)
    setCartoes(novaLista)

    const ordens = [{ colunaId: destColunaId, cartaoIds: novaLista.filter((c) => c.coluna_id === destColunaId).map((c) => c.id) }]
    if (origemColunaId !== destColunaId) {
      ordens.push({ colunaId: origemColunaId, cartaoIds: novaLista.filter((c) => c.coluna_id === origemColunaId).map((c) => c.id) })
    }

    startTransition(async () => {
      const result = await moverCartao(activeId, destColunaId, ordens, quadro.id)
      if (!result.ok) {
        toast.error(result.error)
        setCartoes(prevCartoes)
      }
    })
  }

  function handleAddColuna(e: React.FormEvent) {
    e.preventDefault()
    if (!novaColunaNome.trim()) return
    const fd = new FormData()
    fd.set('nome', novaColunaNome.trim())
    startTransition(async () => {
      const result = await criarColuna(quadro.id, fd)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setNovaColunaNome('')
      setNovaColunaAberta(false)
    })
  }

  function handleRenomearColuna(id: string, nome: string) {
    const fd = new FormData()
    fd.set('nome', nome)
    startTransition(async () => {
      const result = await renomearColuna(id, quadro.id, fd)
      if (!result.ok) toast.error(result.error)
    })
  }

  function handleExcluirColuna(id: string) {
    if (!confirm('Excluir esta coluna e todos os seus cards?')) return
    startTransition(async () => {
      const result = await excluirColuna(id, quadro.id)
      if (!result.ok) toast.error(result.error)
    })
  }

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col overflow-hidden bg-background">
      <div className="shrink-0 border-b border-border p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Link href="/kanban">
            <Button variant="ghost" size="icon-sm"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-primary/10 text-primary border border-primary/20">
            {quadro.codigo}
          </span>
          <h1 className="text-lg font-bold truncate">{quadro.nome}</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
            <TabsList>
              <TabsTrigger value="kanban" className="gap-1.5"><LayoutGrid className="h-3.5 w-3.5" /> Kanban</TabsTrigger>
              <TabsTrigger value="lista" className="gap-1.5"><ListIcon className="h-3.5 w-3.5" /> Lista</TabsTrigger>
              <TabsTrigger value="calendario" className="gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Calendário</TabsTrigger>
              <TabsTrigger value="formularios" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Formulários</TabsTrigger>
            </TabsList>
          </Tabs>

          {view !== 'formularios' && (
            <>
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cards..." className="pl-8 h-8" />
              </div>

              <Select value={filtroPrioridade} onValueChange={(value) => setFiltroPrioridade(value ?? 'todas')}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Toda prioridade</SelectItem>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filtroResponsavel} onValueChange={(value) => setFiltroResponsavel(value ?? 'todos')}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todo responsável</SelectItem>
                  {membrosQuadro.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {view === 'kanban' && (
          <DndContext id={dndId} sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex h-full gap-3 overflow-x-auto p-4">
              {colunas
                .slice()
                .sort((a, b) => a.posicao - b.posicao)
                .map((coluna) => {
                  const cartoesColuna = cartoesDaColuna(coluna.id)
                  return (
                    <KanbanColumn
                      key={coluna.id}
                      coluna={coluna}
                      cartaoIds={cartoesColuna.map((c) => c.id)}
                      total={cartoesColuna.length}
                      onAddCard={() => setCreateColunaId(coluna.id)}
                      onRename={(nome) => handleRenomearColuna(coluna.id, nome)}
                      onDelete={() => handleExcluirColuna(coluna.id)}
                    >
                      {cartoesColuna.map((cartao) => (
                        <KanbanCard
                          key={cartao.id}
                          cartao={cartao}
                          etiquetas={etiquetas}
                          membros={membrosQuadro}
                          visivel={isCartaoVisivel(cartao)}
                          onClick={() => setSelectedCartaoId(cartao.id)}
                        />
                      ))}
                    </KanbanColumn>
                  )
                })}

              <div className="w-[260px] shrink-0">
                {novaColunaAberta ? (
                  <form onSubmit={handleAddColuna} className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-3">
                    <Input autoFocus value={novaColunaNome} onChange={(e) => setNovaColunaNome(e.target.value)} placeholder="Nome da coluna" className="h-8" />
                    <div className="flex gap-1.5">
                      <Button type="submit" size="sm" className="flex-1">Salvar</Button>
                      <Button type="button" size="icon-sm" variant="outline" onClick={() => setNovaColunaAberta(false)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </form>
                ) : (
                  <button
                    onClick={() => setNovaColunaAberta(true)}
                    className="flex w-full items-center gap-2 rounded-xl border border-dashed border-border p-3 text-sm font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
                  >
                    <Plus className="h-4 w-4" /> Nova Coluna
                  </button>
                )}
              </div>
            </div>

            <DragOverlay>
              {activeCartao && (
                <div className="w-[280px] rounded-xl border border-primary bg-card p-3 shadow-lg">
                  <p className="text-[10px] font-mono text-muted-foreground mb-1">{activeCartao.codigo}</p>
                  <h4 className="text-sm font-semibold leading-snug">{activeCartao.titulo}</h4>
                  <span className="mt-2 inline-block text-[9px] font-bold text-muted-foreground uppercase">
                    {PRIORIDADE_LABEL[activeCartao.prioridade]}
                  </span>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}

        {view === 'lista' && (
          <div className="h-full overflow-y-auto p-4">
            <ListView cartoes={cartoesFiltrados} colunas={colunas} etiquetas={etiquetas} membros={membrosQuadro} onSelect={(c) => setSelectedCartaoId(c.id)} />
          </div>
        )}

        {view === 'calendario' && (
          <div className="h-full overflow-y-auto p-4">
            <CalendarView cartoes={cartoesFiltrados} onSelect={(c) => setSelectedCartaoId(c.id)} />
          </div>
        )}

        {view === 'formularios' && <FormulariosManager quadroId={quadro.id} formularios={formularios} colunas={colunas} />}
      </div>

      <CreateCardDialog
        colunaId={createColunaId}
        quadroId={quadro.id}
        membros={membrosQuadro}
        membrosNaoAutorizados={membrosNaoAutorizados}
        onClose={() => setCreateColunaId(null)}
      />

      <CardDetailDialog
        cartao={selectedCartao}
        quadro={quadro}
        colunas={colunas}
        etiquetas={etiquetas}
        membros={membrosQuadro}
        membrosNaoAutorizados={membrosNaoAutorizados}
        areas={areas}
        currentUserId={currentUserId}
        onClose={() => setSelectedCartaoId(null)}
        onUpdated={(atualizado) => setCartoes((prev) => prev.map((c) => (c.id === atualizado.id ? atualizado : c)))}
        onDeleted={(id) => setCartoes((prev) => prev.filter((c) => c.id !== id))}
        onEtiquetaCriada={(etiqueta) => setEtiquetas((prev) => [...prev, etiqueta])}
      />
    </div>
  )
}
