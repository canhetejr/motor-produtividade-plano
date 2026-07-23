'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AlignLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Cartao, Etiqueta, MembroQuadro } from './types'

const PRIORIDADE_LABEL: Record<Cartao['prioridade'], string> = { baixa: 'Baixa', media: 'Média', alta: 'Alta' }
const PRIORIDADE_CLASSE: Record<Cartao['prioridade'], string> = {
  baixa: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  media: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  alta: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
}

const AVATAR_CORES = ['bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500']
function corAvatar(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_CORES[Math.abs(hash) % AVATAR_CORES.length]
}

export function KanbanCard({
  cartao,
  etiquetas,
  membros,
  visivel,
  onClick,
}: {
  cartao: Cartao
  etiquetas: Etiqueta[]
  membros: MembroQuadro[]
  visivel: boolean
  onClick: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cartao.id,
    data: { colunaId: cartao.coluna_id },
  })

  const style = { transform: CSS.Transform.toString(transform), transition }
  const etiquetasCartao = etiquetas.filter((e) => cartao.etiquetas.includes(e.id))
  const responsaveisCartao = membros.filter((m) => cartao.responsaveis.includes(m.id))

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'group relative flex touch-none flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-sm transition-colors hover:border-primary/40 cursor-grab active:cursor-grabbing',
        !visivel && 'hidden',
        isDragging && 'opacity-40'
      )}
      onClick={onClick}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {etiquetasCartao.map((e) => (
          <span
            key={e.id}
            className="text-[9px] font-bold px-1.5 py-0.5 rounded border"
            style={{ color: e.cor, borderColor: e.cor, backgroundColor: `${e.cor}1A` }}
          >
            {e.nome}
          </span>
        ))}
        <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border', PRIORIDADE_CLASSE[cartao.prioridade])}>
          {PRIORIDADE_LABEL[cartao.prioridade]}
        </span>
      </div>

      <div>
        <p className="text-[10px] font-mono text-muted-foreground mb-0.5">{cartao.codigo}</p>
        <h4 className="text-sm font-semibold leading-snug line-clamp-2">{cartao.titulo}</h4>
      </div>

      <div className="flex items-center justify-between mt-1 text-muted-foreground">
        <div className="flex items-center gap-2">
          {cartao.descricao && <AlignLeft className="h-3 w-3" />}
          {cartao.prazo && (
            <span className="text-[10px] font-medium">{new Date(cartao.prazo + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
          )}
        </div>
        {responsaveisCartao.length > 0 && (
          <div className="flex items-center -space-x-1.5">
            {responsaveisCartao.slice(0, 3).map((m) => (
              <div
                key={m.id}
                title={m.nome}
                className={cn(
                  'h-5 w-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white ring-2 ring-card',
                  corAvatar(m.id)
                )}
              >
                {m.nome[0]?.toUpperCase() ?? '?'}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
