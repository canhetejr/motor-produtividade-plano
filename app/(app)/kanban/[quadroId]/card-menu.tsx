'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  MoreHorizontal,
  Clock,
  ArrowUpToLine,
  ArrowRightLeft,
  Copy,
  FilePlus,
  ShieldCheck,
  Users,
  Trash2,
  CheckCircle2,
  RotateCcw,
  ListTree,
  Unlink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { excluirCartao } from '../actions'
import {
  alternarEntregaCartao,
  enviarParaTopo,
  moverCartaoDeQuadro,
  clonarCartao,
  criarTarefaAPartirDe,
  transferirParaEquipe,
  listarQuadrosDisponiveis,
} from '../actions-cartao-menu'
import { converterEmSubtarefa, promoverSubtarefa } from '../actions-subtarefas'
import { buscarCartaoPorCodigo } from '../actions-regras'
import { ajustarHorasRegistradas } from '../actions-tempo'
import { solicitarAprovacao } from '../actions-aprovacao'
import type { Cartao, Coluna, MembroQuadro } from './types'

type QuadroDisponivel = { id: string; nome: string; colunas: { id: string; nome: string }[] }

export function CardMenu({
  cartao,
  quadroId,
  colunas,
  areas,
  membros,
  currentUserId,
  onDeleted,
  onMovedAway,
  onClose,
}: {
  cartao: Cartao
  quadroId: string
  colunas: Coluna[]
  areas: { id: string; nome: string }[]
  membros: MembroQuadro[]
  currentUserId: string
  onDeleted: (id: string) => void
  onMovedAway: (id: string) => void
  onClose: () => void
}) {
  const [painel, setPainel] = useState<null | 'mover' | 'criarDe' | 'transferir' | 'ajustarHoras' | 'aprovacao' | 'subtarefa'>(null)
  const [isPending, startTransition] = useTransition()

  const entregue = !!cartao.entregueEm

  function handleEntrega() {
    startTransition(async () => {
      const result = await alternarEntregaCartao(cartao.id, quadroId, !entregue)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      // Nomear a etapa deixa claro que reabrir devolve o card pro começo do
      // fluxo, não pra onde ele estava antes de ser entregue.
      const etapa = result.data?.etapaDestino
      toast.success(entregue ? `Card reaberto em "${etapa}".` : `Card entregue em "${etapa}".`)
    })
  }

  function handlePromover() {
    startTransition(async () => {
      const result = await promoverSubtarefa(cartao.id, quadroId)
      if (!result.ok) toast.error(result.error)
      else toast.success('Subtarefa promovida a card independente.')
    })
  }

  function handleTopo() {
    startTransition(async () => {
      const result = await enviarParaTopo(cartao.id, quadroId)
      if (!result.ok) toast.error(result.error)
      else toast.success('Card enviado para o topo da etapa.')
    })
  }

  function handleClonar() {
    startTransition(async () => {
      const result = await clonarCartao(cartao.id, quadroId)
      if (!result.ok) toast.error(result.error)
      else toast.success('Card clonado.')
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await excluirCartao(cartao.id, quadroId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Card excluído.')
      onDeleted(cartao.id)
      onClose()
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleEntrega} disabled={isPending}>
            {entregue ? <RotateCcw /> : <CheckCircle2 />} {entregue ? 'Reabrir card' : 'Entregar card'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setPainel('ajustarHoras')}>
            <Clock /> Ajustar horas registradas
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleTopo} disabled={isPending}>
            <ArrowUpToLine /> Enviar para topo da etapa
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setPainel('mover')}>
            <ArrowRightLeft /> Mover de quadro
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleClonar} disabled={isPending}>
            <Copy /> Clonar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setPainel('criarDe')}>
            <FilePlus /> Criar tarefa a partir desta
          </DropdownMenuItem>
          {cartao.cartaoPaiId ? (
            <DropdownMenuItem onClick={handlePromover} disabled={isPending}>
              <Unlink /> Promover a card independente
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => setPainel('subtarefa')}>
              <ListTree /> Converter em subtarefa
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setPainel('aprovacao')}>
            <ShieldCheck /> Solicitar aprovação
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setPainel('transferir')}>
            <Users /> Transferir para equipe
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <AlertDialog>
            <AlertDialogTrigger
              nativeButton={false}
              render={
                <DropdownMenuItem variant="destructive">
                  <Trash2 /> Apagar
                </DropdownMenuItem>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir card?</AlertDialogTitle>
                <AlertDialogDescription>
                  &ldquo;{cartao.titulo}&rdquo; será excluído permanentemente. Essa ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogClose render={<Button variant="outline">Cancelar</Button>} />
                <AlertDialogClose render={<Button variant="destructive" onClick={handleDelete}>Excluir</Button>} />
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DropdownMenuContent>
      </DropdownMenu>

      <MoverDeQuadroDialog
        open={painel === 'mover'}
        onClose={() => setPainel(null)}
        cartaoId={cartao.id}
        quadroOrigemId={quadroId}
        onMoved={() => {
          onMovedAway(cartao.id)
          onClose()
        }}
      />
      <CriarAPartirDeDialog
        open={painel === 'criarDe'}
        onClose={() => setPainel(null)}
        cartaoId={cartao.id}
        quadroId={quadroId}
        colunas={colunas}
      />
      <TransferirEquipeDialog
        open={painel === 'transferir'}
        onClose={() => setPainel(null)}
        cartaoId={cartao.id}
        quadroId={quadroId}
        areas={areas}
      />
      <ConverterSubtarefaDialog
        open={painel === 'subtarefa'}
        onClose={() => setPainel(null)}
        cartaoId={cartao.id}
        quadroId={quadroId}
      />
      <AjustarHorasDialog open={painel === 'ajustarHoras'} onClose={() => setPainel(null)} cartaoId={cartao.id} quadroId={quadroId} />
      <SolicitarAprovacaoDialog
        open={painel === 'aprovacao'}
        onClose={() => setPainel(null)}
        cartaoId={cartao.id}
        quadroId={quadroId}
        membros={membros}
        currentUserId={currentUserId}
      />
    </>
  )
}

function MoverDeQuadroDialog({
  open,
  onClose,
  cartaoId,
  quadroOrigemId,
  onMoved,
}: {
  open: boolean
  onClose: () => void
  cartaoId: string
  quadroOrigemId: string
  onMoved: () => void
}) {
  const [quadros, setQuadros] = useState<QuadroDisponivel[]>([])
  const [quadroDestinoId, setQuadroDestinoId] = useState('')
  const [colunaDestinoId, setColunaDestinoId] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    listarQuadrosDisponiveis(quadroOrigemId).then((r) => {
      if (r.ok) setQuadros(r.data ?? [])
    })
  }, [open, quadroOrigemId])

  const quadroSelecionado = quadros.find((q) => q.id === quadroDestinoId)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!quadroDestinoId || !colunaDestinoId) return
    startTransition(async () => {
      const result = await moverCartaoDeQuadro(cartaoId, quadroOrigemId, quadroDestinoId, colunaDestinoId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Card movido para outro quadro.')
      onMoved()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Mover de quadro</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Select value={quadroDestinoId} onValueChange={(v) => { setQuadroDestinoId(v ?? ''); setColunaDestinoId('') }}>
            <SelectTrigger className="w-full">
              <SelectValue>{(v: string) => quadros.find((q) => q.id === v)?.nome ?? 'Quadro de destino...'}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {quadros.map((q) => <SelectItem key={q.id} value={q.id}>{q.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          {quadroSelecionado && (
            <Select value={colunaDestinoId} onValueChange={(v) => setColunaDestinoId(v ?? '')}>
              <SelectTrigger className="w-full">
                <SelectValue>{(v: string) => quadroSelecionado.colunas.find((c) => c.id === v)?.nome ?? 'Coluna de destino...'}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {quadroSelecionado.colunas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <DialogFooter>
            <Button type="submit" disabled={isPending || !quadroDestinoId || !colunaDestinoId}>Mover</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function CriarAPartirDeDialog({
  open,
  onClose,
  cartaoId,
  quadroId,
  colunas,
}: {
  open: boolean
  onClose: () => void
  cartaoId: string
  quadroId: string
  colunas: Coluna[]
}) {
  const [colunaDestinoId, setColunaDestinoId] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!colunaDestinoId) return
    startTransition(async () => {
      const result = await criarTarefaAPartirDe(cartaoId, colunaDestinoId, quadroId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Novo card criado.')
      onClose()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Criar tarefa a partir desta</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Select value={colunaDestinoId} onValueChange={(v) => setColunaDestinoId(v ?? '')}>
            <SelectTrigger className="w-full">
              <SelectValue>{(v: string) => colunas.find((c) => c.id === v)?.nome ?? 'Coluna de destino...'}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {colunas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button type="submit" disabled={isPending || !colunaDestinoId}>Criar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function TransferirEquipeDialog({
  open,
  onClose,
  cartaoId,
  quadroId,
  areas,
}: {
  open: boolean
  onClose: () => void
  cartaoId: string
  quadroId: string
  areas: { id: string; nome: string }[]
}) {
  const [areaId, setAreaId] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!areaId) return
    startTransition(async () => {
      const result = await transferirParaEquipe(cartaoId, areaId, quadroId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Card transferido.')
      onClose()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Transferir para equipe</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Select value={areaId} onValueChange={(v) => setAreaId(v ?? '')}>
            <SelectTrigger className="w-full">
              <SelectValue>{(v: string) => areas.find((a) => a.id === v)?.nome ?? 'Área/equipe...'}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {areas.map((a) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button type="submit" disabled={isPending || !areaId}>Transferir</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Pede o card pai pelo código (UX-12) em vez de um select com todos os cards
// do quadro: o quadro pode ter centenas, e o código é o identificador que as
// pessoas já usam nos pré-requisitos e nas conversas.
function ConverterSubtarefaDialog({
  open,
  onClose,
  cartaoId,
  quadroId,
}: {
  open: boolean
  onClose: () => void
  cartaoId: string
  quadroId: string
}) {
  const [codigo, setCodigo] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!codigo.trim()) return
    startTransition(async () => {
      const encontrado = await buscarCartaoPorCodigo(quadroId, codigo)
      if (!encontrado.ok || !encontrado.data) {
        toast.error(encontrado.ok ? 'Card não encontrado neste quadro.' : encontrado.error)
        return
      }

      const result = await converterEmSubtarefa(cartaoId, encontrado.data.id, quadroId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(`Agora é subtarefa de "${encontrado.data.titulo}".`)
      setCodigo('')
      onClose()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Converter em subtarefa</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Informe o código do card que passa a ser o pai deste.
          </p>
          <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ex.: UX-12" autoFocus />
          <DialogFooter>
            <Button type="submit" disabled={isPending || !codigo.trim()}>Converter</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AjustarHorasDialog({ open, onClose, cartaoId, quadroId }: { open: boolean; onClose: () => void; cartaoId: string; quadroId: string }) {
  const [tempo, setTempo] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!tempo.trim()) return
    startTransition(async () => {
      const result = await ajustarHorasRegistradas(cartaoId, quadroId, tempo)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Horas ajustadas.')
      setTempo('')
      onClose()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Ajustar horas registradas</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input value={tempo} onChange={(e) => setTempo(e.target.value)} placeholder="01:30" autoFocus />
          <DialogFooter>
            <Button type="submit" disabled={isPending || !tempo.trim()}>Adicionar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function SolicitarAprovacaoDialog({
  open,
  onClose,
  cartaoId,
  quadroId,
  membros,
  currentUserId,
}: {
  open: boolean
  onClose: () => void
  cartaoId: string
  quadroId: string
  membros: MembroQuadro[]
  currentUserId: string
}) {
  const [aprovadorId, setAprovadorId] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!aprovadorId) return
    startTransition(async () => {
      const result = await solicitarAprovacao(cartaoId, aprovadorId, quadroId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Aprovação solicitada.')
      onClose()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Solicitar aprovação</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Select value={aprovadorId} onValueChange={(v) => setAprovadorId(v ?? '')}>
            <SelectTrigger className="w-full">
              <SelectValue>{(v: string) => membros.find((m) => m.id === v)?.nome ?? 'Aprovador...'}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {membros.filter((m) => m.id !== currentUserId).map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button type="submit" disabled={isPending || !aprovadorId}>Solicitar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
