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
import { EstadoBadge, type EstadoBadgeEstado } from '@/components/ui/estado-badge'
import { AvatarGrupo } from '@/components/ui/avatar'
import type { Cartao, Etiqueta, MembroQuadro } from './types'

const PRIORIDADE_LABEL: Record<Cartao['prioridade'], string> = { baixa: 'Baixa', media: 'Média', alta: 'Alta' }
// baixa era azul antes — cor fora da paleta da marca (design.md: roxo + mint +
// base neutra). Prioridade baixa e "nada de especial", que e exatamente o que
// o estado neutro da escala semantica ja significa.
const PRIORIDADE_ESTADO: Record<Cartao['prioridade'], EstadoBadgeEstado> = {
  baixa: 'neutro',
  media: 'atencao',
  alta: 'erro',
}

// Melhoria/Solicitação já usam os tokens de marca (vertice-mint/vertice-purple)
// — não são cor crua, ficam como estão. Só Bug precisa da escala de estado.
const TIPO_CLASSE: Record<Cartao['tipo'], string> = {
  Padrão: 'text-muted-foreground bg-muted border-border',
  Bug: 'text-danger-texto bg-danger-superficie border-danger-borda',
  Melhoria: 'text-vertice-mint-deep bg-vertice-mint/10 border-vertice-mint/20',
  Solicitação: 'text-vertice-purple bg-vertice-purple/10 border-vertice-purple/20',
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

  // touch-manipulation, e não touch-none: o card inteiro é a alça de arraste e
  // ocupa a coluna toda, então `touch-action: none` fazia o navegador ignorar
  // todo gesto sobre ele — no celular não dava pra rolar a coluna, só pelos
  // vãos entre os cards. Como o TouchSensor só ativa depois de 200ms parado
  // (sensors em kanban-board.tsx), o deslize rápido pertence à rolagem e o
  // toque longo ao arraste, sem disputa.
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'group relative flex touch-manipulation flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-sm transition-colors hover:border-primary/40 cursor-grab active:cursor-grabbing',
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
          <EstadoBadge estado="sucesso" tamanho="sm" icone={CheckCircle2}>
            Entregue
          </EstadoBadge>
        )}
        {cartao.temAprovacaoPendente && (
          <EstadoBadge estado="atencao" tamanho="sm" icone={ShieldAlert}>
            Aprovação
          </EstadoBadge>
        )}
        {cartao.cartaoPaiId && (
          <EstadoBadge estado="neutro" tamanho="sm" icone={CornerDownRight} title="Subtarefa de outro card">
            Subtarefa
          </EstadoBadge>
        )}
        {cartao.tipo !== 'Padrão' && (
          <span className={cn('text-4xs font-bold px-1.5 py-0.5 rounded border', TIPO_CLASSE[cartao.tipo])}>
            {cartao.tipo}
          </span>
        )}
        {etiquetasCartao.map((e) => (
          <span
            key={e.id}
            className="text-4xs font-bold px-1.5 py-0.5 rounded border"
            style={{ color: e.cor, borderColor: e.cor, backgroundColor: `${e.cor}1A` }}
          >
            {e.nome}
          </span>
        ))}
        <EstadoBadge estado={PRIORIDADE_ESTADO[cartao.prioridade]} tamanho="sm">
          {PRIORIDADE_LABEL[cartao.prioridade]}
        </EstadoBadge>
      </div>

      <div>
        <p className="text-3xs font-mono text-muted-foreground mb-0.5">{cartao.codigo}</p>
        <h4 className="text-sm font-semibold leading-snug line-clamp-2">{cartao.titulo}</h4>
      </div>

      <div className="flex items-center justify-between mt-1 text-muted-foreground">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {cartao.descricao && <AlignLeft className="h-3 w-3" />}
          {cartao.prazo && (
            <span className="text-3xs font-medium">{new Date(cartao.prazo + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
          )}
          {cartao.totalSubtarefas > 0 && (
            <span className="flex items-center gap-0.5 text-3xs font-medium" title={`${cartao.totalSubtarefas} subtarefa(s)`}>
              <ListTree className="h-3 w-3" />{cartao.totalSubtarefas}
            </span>
          )}
          {cartao.totalAnexos > 0 && (
            <span className="flex items-center gap-0.5 text-3xs font-medium" title={`${cartao.totalAnexos} anexo(s)`}>
              <Paperclip className="h-3 w-3" />{cartao.totalAnexos}
            </span>
          )}
          {cartao.checklist.total > 0 && (
            <span
              className={cn(
                'flex items-center gap-0.5 text-3xs font-medium',
                cartao.checklist.concluidos === cartao.checklist.total && 'text-success-texto'
              )}
              title="Checklist"
            >
              <ListChecks className="h-3 w-3" />
              {cartao.checklist.concluidos}/{cartao.checklist.total}
            </span>
          )}
          {cartao.tempoRegistradoMin > 0 && (
            <span className="flex items-center gap-0.5 text-3xs font-medium" title="Tempo registrado">
              <Clock className="h-3 w-3" />{formatarTempo(cartao.tempoRegistradoMin)}
            </span>
          )}
        </div>
        {responsaveisCartao.length > 0 && (
          // Pilha propria trocada pelo primitivo: cor arco-iris por hash nao
          // e da paleta da marca, um a-letra-so nao e o mesmo criterio de
          // iniciais usado no resto do app, e nao havia suporte a foto — quem
          // tivesse avatar cadastrado nunca via a propria foto aqui.
          <AvatarGrupo
            pessoas={responsaveisCartao.map((m) => ({ id: m.id, nome: m.nome, avatarUrl: m.avatarUrl }))}
            limite={3}
            tamanho="xs"
          />
        )}
      </div>
    </div>
  )
}
