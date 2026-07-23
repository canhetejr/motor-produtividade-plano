'use client'

import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus, Trash2, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Coluna } from './types'

export function KanbanColumn({
  coluna,
  cartaoIds,
  total,
  children,
  onAddCard,
  onRename,
  onDelete,
}: {
  coluna: Coluna
  cartaoIds: string[]
  total: number
  children: React.ReactNode
  onAddCard: () => void
  onRename: (nome: string) => void
  onDelete: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.id })
  const [renaming, setRenaming] = useState(false)
  const [nome, setNome] = useState(coluna.nome)

  function salvarNome() {
    if (nome.trim() && nome.trim() !== coluna.nome) onRename(nome.trim())
    setRenaming(false)
  }

  return (
    <div className="flex h-full w-[300px] shrink-0 flex-col rounded-xl border border-border bg-muted/30">
      <div className="group/header flex items-center justify-between gap-2 border-b border-border p-3">
        {renaming ? (
          <div className="flex flex-1 items-center gap-1">
            <Input
              autoFocus
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && salvarNome()}
              className="h-7 text-xs"
            />
            <Button size="icon-xs" variant="ghost" onClick={salvarNome}>
              <Check className="h-3 w-3" />
            </Button>
            <Button size="icon-xs" variant="ghost" onClick={() => { setNome(coluna.nome); setRenaming(false) }}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <>
            <button
              onClick={() => setRenaming(true)}
              className="truncate text-xs font-bold uppercase tracking-wide text-foreground/80 hover:text-foreground"
            >
              {coluna.nome} <span className="text-muted-foreground font-normal normal-case">({total})</span>
            </button>
            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover/header:opacity-100">
              <Button size="icon-xs" variant="ghost" onClick={onAddCard} title="Novo card">
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon-xs" variant="ghost" className="hover:text-destructive" onClick={onDelete} title="Excluir coluna">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
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
