'use client'

import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, Trash2, Check, X, Settings2, Flag, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import type { Coluna } from './types'

// O id sortable da coluna é prefixado porque `coluna.id` cru já é o id do
// droppable que recebe cards — dois registros com o mesmo id se atrapalhariam.
// O board usa esse prefixo pra saber se o arraste é de coluna ou de card.
export const PREFIXO_COLUNA = 'coluna:'

export function KanbanColumn({
  coluna,
  cartaoIds,
  total,
  podeConfigurar,
  children,
  onAddCard,
  onRename,
  onDelete,
  onConfigurar,
}: {
  coluna: Coluna
  cartaoIds: string[]
  total: number
  podeConfigurar: boolean
  children: React.ReactNode
  onAddCard: () => void
  onRename: (nome: string) => void
  onDelete: () => void
  onConfigurar: (config: { etapaFinal: boolean; limiteWip: number | null; slaHoras: number | null }) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.id })
  const {
    setNodeRef: setSortableRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `${PREFIXO_COLUNA}${coluna.id}`, data: { tipo: 'coluna' } })

  const [renaming, setRenaming] = useState(false)
  const [nome, setNome] = useState(coluna.nome)

  function salvarNome() {
    if (nome.trim() && nome.trim() !== coluna.nome) onRename(nome.trim())
    setRenaming(false)
  }

  function cancelarRename() {
    setNome(coluna.nome)
    setRenaming(false)
  }

  function abrirRename() {
    // Parte do nome atual da coluna, não do último valor digitado — ela pode
    // ter sido renomeada por outro membro via realtime desde a última edição.
    setNome(coluna.nome)
    setRenaming(true)
  }

  const wipEstourado = coluna.limiteWip !== null && total >= coluna.limiteWip

  return (
    <div
      ref={setSortableRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex h-full w-[85vw] max-w-[300px] shrink-0 snap-start flex-col rounded-md border bg-muted/30 sm:w-[300px]',
        coluna.etapaFinal ? 'border-emerald-500/40' : 'border-border',
        isDragging && 'opacity-50'
      )}
    >
      <div className="group/header flex items-center justify-between gap-2 border-b border-border p-3">
        {renaming ? (
          <div className="flex flex-1 items-center gap-1">
            <Input
              autoFocus
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') salvarNome()
                if (e.key === 'Escape') cancelarRename()
              }}
              className="h-7 text-xs"
            />
            <Button size="icon-xs" variant="ghost" aria-label="Salvar nome da coluna" onClick={salvarNome}>
              <Check className="h-3 w-3" />
            </Button>
            <Button size="icon-xs" variant="ghost" aria-label="Cancelar" onClick={cancelarRename}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <>
            <div className="flex min-w-0 items-center gap-1">
              {/* Alça dedicada: arrastar pela coluna inteira competiria com o
                  arraste dos cards que vivem dentro dela. */}
              <button
                type="button"
                {...attributes}
                {...listeners}
                className="shrink-0 cursor-grab touch-none text-muted-foreground/50 max-md:opacity-100 focus-within:opacity-100 opacity-0 transition-opacity hover:text-foreground active:cursor-grabbing group-hover/header:opacity-100"
                title="Arrastar coluna"
                aria-label={`Reordenar coluna ${coluna.nome}`}
              >
                <GripVertical className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={abrirRename}
                className="truncate text-xs font-bold uppercase tracking-wide text-foreground/80 hover:text-foreground"
              >
                {coluna.nome}{' '}
                <span className={cn('font-normal normal-case', wipEstourado ? 'font-bold text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>
                  ({total}{coluna.limiteWip !== null ? `/${coluna.limiteWip}` : ''})
                </span>
              </button>
              {coluna.etapaFinal && (
                <Flag className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="Etapa final" />
              )}
            </div>
            <div className="flex items-center gap-1 max-md:gap-2 max-md:opacity-100 focus-within:opacity-100 opacity-0 transition-opacity group-hover/header:opacity-100">
              {podeConfigurar && <ConfigColuna coluna={coluna} onConfigurar={onConfigurar} />}
              <Button size="icon-xs" variant="ghost" onClick={onAddCard} title="Novo card" aria-label={`Novo card em ${coluna.nome}`}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button size="icon-xs" variant="ghost" className="hover:text-destructive" title="Excluir coluna" aria-label={`Excluir coluna ${coluna.nome}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  }
                />
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir a coluna &ldquo;{coluna.nome}&rdquo;?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {/* cartaoIds.length, e não `total`: aquele é a contagem já
                          filtrada pela busca ativa, e subestimaria quantos cards
                          de fato somem se houver filtro em uso. */}
                      {cartaoIds.length > 0
                        ? `${cartaoIds.length} card${cartaoIds.length > 1 ? 's' : ''} nesta coluna ${cartaoIds.length > 1 ? 'serão excluídos' : 'será excluído'} junto. Essa ação não pode ser desfeita.`
                        : 'Essa ação não pode ser desfeita.'}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogClose render={<Button variant="outline">Cancelar</Button>} />
                    <AlertDialogClose render={<Button variant="destructive" onClick={onDelete}>Excluir coluna</Button>} />
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        )}
      </div>

      <SortableContext items={cartaoIds} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className={cn('flex-1 space-y-2 overflow-y-auto p-2', isOver && 'bg-primary/5')}>
          {children}
          <div className="h-8" />
        </div>
      </SortableContext>
    </div>
  )
}

function ConfigColuna({
  coluna,
  onConfigurar,
}: {
  coluna: Coluna
  onConfigurar: (config: { etapaFinal: boolean; limiteWip: number | null; slaHoras: number | null }) => void
}) {
  const [aberto, setAberto] = useState(false)
  const [etapaFinal, setEtapaFinal] = useState(coluna.etapaFinal)
  const [limiteWip, setLimiteWip] = useState(coluna.limiteWip?.toString() ?? '')
  const [slaHoras, setSlaHoras] = useState(coluna.slaHoras?.toString() ?? '')

  function abrir(v: boolean) {
    // Reabrir sempre parte do que está salvo, não do rascunho anterior.
    if (v) {
      setEtapaFinal(coluna.etapaFinal)
      setLimiteWip(coluna.limiteWip?.toString() ?? '')
      setSlaHoras(coluna.slaHoras?.toString() ?? '')
    }
    setAberto(v)
  }

  function salvar() {
    const limite = limiteWip.trim() ? Number(limiteWip) : null
    const sla = slaHoras.trim() ? Number(slaHoras) : null
    onConfigurar({ etapaFinal, limiteWip: limite, slaHoras: sla })
    setAberto(false)
  }

  return (
    <Popover open={aberto} onOpenChange={abrir}>
      <PopoverTrigger render={<Button size="icon-xs" variant="ghost" title="Configurar etapa" aria-label={`Configurar etapa ${coluna.nome}`} />}>
        <Settings2 className="h-3.5 w-3.5" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-3">
        <div className="space-y-1">
          <label className="flex items-start gap-2 text-xs cursor-pointer">
            <Checkbox checked={etapaFinal} onCheckedChange={(v) => setEtapaFinal(!!v)} className="mt-0.5" />
            <span>
              <span className="font-semibold text-foreground">Etapa final</span>
              <span className="block text-2xs text-muted-foreground">
                Card que chega aqui é marcado como entregue; sair daqui reabre.
              </span>
            </span>
          </label>
        </div>

        <div className="space-y-1">
          <Label htmlFor={`wip-${coluna.id}`} className="text-xs font-semibold">Limite de WIP</Label>
          <Input
            id={`wip-${coluna.id}`}
            type="number"
            min={1}
            value={limiteWip}
            onChange={(e) => setLimiteWip(e.target.value)}
            placeholder="Sem limite"
            className="h-8 text-xs"
          />
          <p className="text-2xs text-muted-foreground">
            Impede mover mais cards pra cá quando o limite for atingido.
          </p>
        </div>

        <div className="space-y-1">
          <Label htmlFor={`sla-${coluna.id}`} className="text-xs font-semibold">Tempo máximo na etapa (SLA)</Label>
          <Input
            id={`sla-${coluna.id}`}
            type="number"
            min={1}
            value={slaHoras}
            onChange={(e) => setSlaHoras(e.target.value)}
            placeholder="Sem SLA"
            className="h-8 text-xs"
          />
          <p className="text-2xs text-muted-foreground">
            Em horas. Não bloqueia nada — alimenta os eventos de SLA das automações.
          </p>
        </div>

        <div className="flex justify-end gap-1.5">
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAberto(false)}>Cancelar</Button>
          <Button size="sm" className="h-7 text-xs" onClick={salvar}>Salvar</Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
