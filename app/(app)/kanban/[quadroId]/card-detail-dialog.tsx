'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/utils/supabase/client'
import { atualizarCartao, excluirCartao, criarEtiqueta, criarComentario, excluirComentario } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Trash2, Users, Tag, Plus, Send } from 'lucide-react'
import type { Cartao, Etiqueta, MembroQuadro } from './types'

type Comentario = { id: string; conteudo: string; created_at: string; colaborador_id: string; colaboradores: { nome: string } | null }

type CardDetailFormProps = {
  cartao: Cartao
  quadroId: string
  etiquetas: Etiqueta[]
  membros: MembroQuadro[]
  currentUserId: string
  onClose: () => void
  onUpdated: (cartao: Cartao) => void
  onDeleted: (cartaoId: string) => void
  onEtiquetaCriada: (etiqueta: Etiqueta) => void
}

export function CardDetailDialog({ cartao, onClose, ...rest }: { cartao: Cartao | null; onClose: () => void } & Omit<CardDetailFormProps, 'cartao' | 'onClose'>) {
  return (
    <Dialog open={!!cartao} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        {cartao && <CardDetailForm key={cartao.id} cartao={cartao} onClose={onClose} {...rest} />}
      </DialogContent>
    </Dialog>
  )
}

function CardDetailForm({ cartao, quadroId, etiquetas, membros, currentUserId, onClose, onUpdated, onDeleted, onEtiquetaCriada }: CardDetailFormProps) {
  const [isPending, startTransition] = useTransition()
  const [prioridade, setPrioridade] = useState<Cartao['prioridade']>(cartao.prioridade)
  const [responsaveis, setResponsaveis] = useState<string[]>(cartao.responsaveis)
  const [cardEtiquetas, setCardEtiquetas] = useState<string[]>(cartao.etiquetas)
  const [novaEtiquetaNome, setNovaEtiquetaNome] = useState('')
  const [novaEtiquetaCor, setNovaEtiquetaCor] = useState('#6B7280')
  const [showNovaEtiqueta, setShowNovaEtiqueta] = useState(false)
  const [comentarios, setComentarios] = useState<Comentario[]>([])
  const [novoComentario, setNovoComentario] = useState('')

  // Componente é remontado por `key={cartao.id}` a cada card aberto, então
  // este efeito só busca os comentários daquele card — não sincroniza
  // estado derivado de props (isso já vem pronto nos useState acima).
  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('comentarios_cartao')
      .select('*, colaboradores(nome)')
      .eq('cartao_id', cartao.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setComentarios((data as unknown as Comentario[]) ?? []))
  }, [cartao.id])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set('prioridade', prioridade)
    responsaveis.forEach((id) => formData.append('responsaveis', id))
    cardEtiquetas.forEach((id) => formData.append('etiquetas', id))
    startTransition(async () => {
      const result = await atualizarCartao(cartao.id, quadroId, formData)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      onUpdated({
        ...cartao,
        titulo: String(formData.get('titulo') ?? cartao.titulo),
        descricao: (formData.get('descricao') as string) || null,
        prioridade,
        prazo: (formData.get('prazo') as string) || null,
        responsaveis,
        etiquetas: cardEtiquetas,
      })
      toast.success('Card atualizado!')
      onClose()
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

  function handleCriarEtiqueta(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await criarEtiqueta(quadroId, formData)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      onEtiquetaCriada(result.data!)
      setCardEtiquetas((prev) => [...prev, result.data!.id])
      setNovaEtiquetaNome('')
      setShowNovaEtiqueta(false)
    })
  }

  function handleComentar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!novoComentario.trim()) return
    const formData = new FormData()
    formData.set('conteudo', novoComentario.trim())
    setNovoComentario('')
    startTransition(async () => {
      const result = await criarComentario(cartao.id, quadroId, formData)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      const supabase = createClient()
      const { data } = await supabase
        .from('comentarios_cartao')
        .select('*, colaboradores(nome)')
        .eq('cartao_id', cartao.id)
        .order('created_at', { ascending: false })
      setComentarios((data as unknown as Comentario[]) ?? [])
    })
  }

  function handleExcluirComentario(id: string) {
    startTransition(async () => {
      const result = await excluirComentario(id, quadroId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setComentarios((prev) => prev.filter((c) => c.id !== id))
    })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center justify-between gap-4 pr-6">
          <span className="font-mono text-xs text-muted-foreground">{cartao.codigo}</span>
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" /> Excluir
                </Button>
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
        </DialogTitle>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
        <div className="space-y-2">
          <Input name="titulo" defaultValue={cartao.titulo} required className="text-lg font-bold h-10" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Prioridade</Label>
            <Select value={prioridade} onValueChange={(v) => setPrioridade((v as Cartao['prioridade']) ?? 'media')}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="baixa">Baixa</SelectItem>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="card-detalhe-prazo">Prazo</Label>
            <Input id="card-detalhe-prazo" name="prazo" type="date" defaultValue={cartao.prazo ?? ''} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="card-detalhe-descricao">Descrição</Label>
          <Textarea id="card-detalhe-descricao" name="descricao" rows={4} defaultValue={cartao.descricao ?? ''} />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2"><Tag className="h-4 w-4 text-muted-foreground" /> Etiquetas</Label>
            <button type="button" onClick={() => setShowNovaEtiqueta((v) => !v)} className="text-xs font-semibold text-primary hover:underline">
              + Nova etiqueta
            </button>
          </div>
          {showNovaEtiqueta && (
            <form onSubmit={handleCriarEtiqueta} className="flex items-center gap-2">
              <input type="color" name="cor" value={novaEtiquetaCor} onChange={(e) => setNovaEtiquetaCor(e.target.value)} className="h-8 w-8 rounded border border-input bg-transparent p-0.5" />
              <Input name="nome" value={novaEtiquetaNome} onChange={(e) => setNovaEtiquetaNome(e.target.value)} placeholder="Nome da etiqueta" className="h-8 flex-1" />
              <Button type="submit" size="icon-sm" variant="outline"><Plus className="h-3.5 w-3.5" /></Button>
            </form>
          )}
          <div className="flex flex-wrap gap-1.5">
            {etiquetas.length === 0 && !showNovaEtiqueta && <p className="text-xs text-muted-foreground">Nenhuma etiqueta neste quadro ainda.</p>}
            {etiquetas.map((et) => {
              const ativo = cardEtiquetas.includes(et.id)
              return (
                <button
                  key={et.id}
                  type="button"
                  onClick={() => setCardEtiquetas((prev) => (ativo ? prev.filter((id) => id !== et.id) : [...prev, et.id]))}
                  className="text-xs font-semibold px-2 py-1 rounded-full border transition-opacity"
                  style={{ color: et.cor, borderColor: et.cor, backgroundColor: `${et.cor}1A`, opacity: ativo ? 1 : 0.4 }}
                >
                  {et.nome}
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" /> Responsáveis</Label>
          <div className="flex flex-wrap gap-3 rounded-lg border border-border p-2">
            {membros.length === 0 ? (
              <p className="text-xs text-muted-foreground p-1">Nenhum membro vinculado a este quadro.</p>
            ) : (
              membros.map((m) => (
                <label key={m.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <Checkbox
                    checked={responsaveis.includes(m.id)}
                    onCheckedChange={(checked) => setResponsaveis((prev) => (checked ? [...prev, m.id] : prev.filter((id) => id !== m.id)))}
                  />
                  {m.nome}
                </label>
              ))
            )}
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar Alterações'}
        </Button>
      </form>

      <Tabs defaultValue="comentarios" className="pt-2 border-t border-border">
        <TabsList>
          <TabsTrigger value="comentarios">Comentários ({comentarios.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="comentarios" className="space-y-3 max-h-64 overflow-y-auto pt-2">
          <form onSubmit={handleComentar} className="flex items-start gap-2">
            <Textarea
              value={novoComentario}
              onChange={(e) => setNovoComentario(e.target.value)}
              placeholder="Escreva um comentário..."
              rows={2}
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={!novoComentario.trim() || isPending}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
          {comentarios.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum comentário ainda.</p>
          ) : (
            comentarios.map((c) => (
              <div key={c.id} className="flex items-start justify-between gap-2 rounded-lg border border-border p-3 text-sm">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-xs">{c.colaboradores?.nome ?? '—'}</span>
                    <span className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleString('pt-BR')}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-muted-foreground">{c.conteudo}</p>
                </div>
                {c.colaborador_id === currentUserId && (
                  <button onClick={() => handleExcluirComentario(c.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </>
  )
}
