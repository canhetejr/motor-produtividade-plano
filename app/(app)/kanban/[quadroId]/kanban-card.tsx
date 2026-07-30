'use client'

import { useRef } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  AlignLeft,
  ListTree,
  Paperclip,
  ListChecks,
  Clock,
  CheckCircle2,
  ShieldAlert,
  CornerDownRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatarTempo } from '@/lib/tempo'
import type { Cartao, Etiqueta, MembroQuadro } from './types'

const PRIORIDADE_LABEL: Record<Cartao['prioridade'], string> = { baixa: 'Baixa', media: 'Média', alta: 'Alta' }
const PRIORIDADE_CLASSE: Record<Cartao['prioridade'], string> = {
  baixa: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  media: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  alta: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
}

const TIPO_CLASSE: Record<Cartao['tipo'], string> = {
  Padrão: 'text-muted-foreground bg-muted border-border',
  Bug: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
  Melhoria: 'text-vertice-mint-deep bg-vertice-mint/10 border-vertice-mint/20',
  Solicitação: 'text-vertice-purple bg-vertice-purple/10 border-vertice-purple/20',
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

  // O card inteiro é a alça de arraste, então o clique que encerra um drag
  // também chegaria aqui e abriria o detalhe sem querer. Só conta como clique
  // se o ponteiro praticamente não andou (mesmo limiar do MouseSensor).
  const inicioPonteiro = useRef<{ x: number; y: number } | null>(null)

  function handleClick(event: React.MouseEvent) {
    const inicio = inicioPonteiro.current
    inicioPonteiro.current = null
    if (inicio && Math.hypot(event.clientX - inicio.x, event.clientY - inicio.y) > 8) return
    onClick()
  }

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
      onPointerDown={(e) => {
        inicioPonteiro.current = { x: e.clientX, y: e.clientY }
      }}
      onClick={handleClick}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {cartao.entregueEm && (
          <span className="flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded border text-emerald-500 bg-emerald-500/10 border-emerald-500/20">
            <CheckCircle2 className="h-2.5 w-2.5" /> Entregue
          </span>
        )}
        {cartao.temAprovacaoPendente && (
          <span className="flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded border text-amber-500 bg-amber-500/10 border-amber-500/20">
            <ShieldAlert className="h-2.5 w-2.5" /> Aprovação
          </span>
        )}
        {cartao.cartaoPaiId && (
          <span className="flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded border text-muted-foreground bg-muted border-border" title="Subtarefa de outro card">
            <CornerDownRight className="h-2.5 w-2.5" /> Subtarefa
          </span>
        )}
        {cartao.tipo !== 'Padrão' && (
          <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border', TIPO_CLASSE[cartao.tipo])}>
            {cartao.tipo}
          </span>
        )}
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
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {cartao.descricao && <AlignLeft className="h-3 w-3" />}
          {cartao.prazo && (
            <span className="text-[10px] font-medium">{new Date(cartao.prazo + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
          )}
          {cartao.totalSubtarefas > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] font-medium" title={`${cartao.totalSubtarefas} subtarefa(s)`}>
              <ListTree className="h-3 w-3" />{cartao.totalSubtarefas}
            </span>
          )}
          {cartao.totalAnexos > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] font-medium" title={`${cartao.totalAnexos} anexo(s)`}>
              <Paperclip className="h-3 w-3" />{cartao.totalAnexos}
            </span>
          )}
          {cartao.checklist.total > 0 && (
            <span
              className={cn(
                'flex items-center gap-0.5 text-[10px] font-medium',
                cartao.checklist.concluidos === cartao.checklist.total && 'text-emerald-500'
              )}
              title="Checklist"
            >
              <ListChecks className="h-3 w-3" />
              {cartao.checklist.concluidos}/{cartao.checklist.total}
            </span>
          )}
          {cartao.tempoRegistradoMin > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] font-medium" title="Tempo registrado">
              <Clock className="h-3 w-3" />{formatarTempo(cartao.tempoRegistradoMin)}
            </span>
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
