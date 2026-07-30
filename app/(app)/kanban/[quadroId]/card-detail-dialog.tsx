'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/utils/supabase/client'
import { atualizarCartao, criarEtiqueta, criarComentario, excluirComentario } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Users, Tag, Plus, Send, Clock, Calendar, CheckSquare, FileText, Building2, Hash, Layers, AlertCircle, Save, CheckCircle2, Play, Pause, MessageSquare, Trash2, History, Activity, Sparkles } from 'lucide-react'
import { CardMenu } from './card-menu'
import { TempoWidget, SeguidoresWidget, ChecklistWidget, AprovacaoWidget } from './card-detail-widgets'
import { RequisitosTab, SubtarefasTab, RegrasTab, AnexosTab, EmailsTab } from './card-detail-tabs'
import type { Cartao, Coluna, Etiqueta, MembroQuadro, MembroNaoAutorizado, Quadro, Aprovacao } from './types'

type Comentario = { id: string; conteudo: string; created_at: string; colaborador_id: string; tipo: 'usuario' | 'sistema'; colaboradores: { nome: string } | null }

const TIPO_LABEL: Record<Cartao['tipo'], string> = { Padrão: 'Padrão', Bug: 'Bug', Melhoria: 'Melhoria', Solicitação: 'Solicitação' }

type CardDetailFormProps = {
  cartao: Cartao
  quadro: Quadro
  colunas: Coluna[]
  etiquetas: Etiqueta[]
  membros: MembroQuadro[]
  membrosNaoAutorizados: MembroNaoAutorizado[]
  areas: { id: string; nome: string }[]
  currentUserId: string
  onClose: () => void
  onUpdated: (cartao: Cartao) => void
  onDeleted: (cartaoId: string) => void
  onEtiquetaCriada: (etiqueta: Etiqueta) => void
}

function getInitials(name: string) {
  return name.trim().split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

export function CardDetailDialog({ cartao, onClose, ...rest }: { cartao: Cartao | null; onClose: () => void } & Omit<CardDetailFormProps, 'cartao' | 'onClose'>) {
  return (
    <Dialog open={!!cartao} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full sm:w-[95vw] sm:max-w-[1550px] h-[92vh] max-h-[92vh] flex flex-col overflow-hidden bg-card border border-border shadow-2xl rounded-2xl p-0 text-foreground">
        {cartao && <CardDetailForm key={cartao.id} cartao={cartao} onClose={onClose} {...rest} />}
      </DialogContent>
    </Dialog>
  )
}

function CardDetailForm({
  cartao,
  quadro,
  colunas,
  etiquetas,
  membros,
  membrosNaoAutorizados,
  areas,
  currentUserId,
  onClose,
  onUpdated,
  onDeleted,
  onEtiquetaCriada,
}: CardDetailFormProps) {
  const [isPending, startTransition] = useTransition()
  const [prioridade, setPrioridade] = useState<Cartao['prioridade']>(cartao.prioridade)
  const [colunaId, setColunaId] = useState(cartao.coluna_id)
  const [tipo, setTipo] = useState<Cartao['tipo']>(cartao.tipo)
  const [centroId, setCentroId] = useState(cartao.centroId ?? '')
  const [recorrencia, setRecorrencia] = useState<string>(cartao.recorrencia?.tipo ?? 'nenhuma')
  const [responsaveis, setResponsaveis] = useState<string[]>(cartao.responsaveis)
  const [cardEtiquetas, setCardEtiquetas] = useState<string[]>(cartao.etiquetas)
  const [novaEtiquetaNome, setNovaEtiquetaNome] = useState('')
  const [novaEtiquetaCor, setNovaEtiquetaCor] = useState('#6B7280')
  const [showNovaEtiqueta, setShowNovaEtiqueta] = useState(false)
  const [mostrarNaoAutorizados, setMostrarNaoAutorizados] = useState(false)
  const [comentarios, setComentarios] = useState<Comentario[]>([])
  const [novoComentario, setNovoComentario] = useState('')
  const [aprovacaoAtual, setAprovacaoAtual] = useState<Aprovacao | null>(null)
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'usuario' | 'sistema'>('todos')

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
    formData.set('colunaId', colunaId)
    formData.set('tipo', tipo)
    formData.set('recorrencia', recorrencia)
    if (centroId) formData.set('centroId', centroId)
    responsaveis.forEach((id) => formData.append('responsaveis', id))
    cardEtiquetas.forEach((id) => formData.append('etiquetas', id))
    startTransition(async () => {
      const result = await atualizarCartao(cartao.id, quadro.id, formData)
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
        coluna_id: colunaId,
        tipo,
        centroId: centroId || null,
        inicioDesejado: (formData.get('inicioDesejado') as string) || null,
        entregueEm: (formData.get('entregueEm') as string) || null,
        tempoEstimadoMin: formData.get('tempoEstimadoMin') ? Number(formData.get('tempoEstimadoMin')) : null,
        tagReferencia: (formData.get('tagReferencia') as string) || null,
        responsaveis,
        etiquetas: cardEtiquetas,
      })
      toast.success('Card atualizado!')
      onClose()
    })
  }

  function handleCriarEtiqueta() {
    if (!novaEtiquetaNome.trim()) return
    const formData = new FormData()
    formData.set('nome', novaEtiquetaNome.trim())
    formData.set('cor', novaEtiquetaCor)
    startTransition(async () => {
      const result = await criarEtiqueta(quadro.id, formData)
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

  function handleComentar() {
    if (!novoComentario.trim()) return
    const formData = new FormData()
    formData.set('conteudo', novoComentario.trim())
    setNovoComentario('')
    startTransition(async () => {
      const result = await criarComentario(cartao.id, quadro.id, formData)
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
      const result = await excluirComentario(id, quadro.id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setComentarios((prev) => prev.filter((c) => c.id !== id))
    })
  }

  const selectTriggerClass = 'w-full h-9 bg-secondary/50 hover:bg-secondary border-border focus:border-primary focus:ring-1 focus:ring-primary rounded-lg text-xs font-medium'

  return (
    <>
      {/* Banner de Aprovação (se houver) */}
      {aprovacaoAtual && (
        <div
          className={
            'shrink-0 px-5 py-2 text-xs font-bold flex items-center justify-between border-b ' +
            (aprovacaoAtual.status === 'APROVADA'
              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
              : aprovacaoAtual.status === 'REJEITADA'
                ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                : 'bg-amber-500/10 text-amber-500 border-amber-500/20')
          }
        >
          <span>
            {aprovacaoAtual.status === 'APROVADA' && 'Solicitação aprovada'}
            {aprovacaoAtual.status === 'REJEITADA' && 'Solicitação rejeitada'}
            {aprovacaoAtual.status === 'PENDENTE' && `Aguardando aprovação de ${aprovacaoAtual.aprovadorNome ?? '—'}`}
          </span>
        </div>
      )}

      {/* Header Compacto do Dialog - Sem lacuna morta */}
      <div className="shrink-0 px-5 py-2.5 border-b border-border bg-secondary/25 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 rounded-md flex items-center gap-1.5">
            <Hash className="w-3 h-3" />
            {cartao.codigo}
          </span>
          <span className="text-xs text-muted-foreground font-semibold truncate">
            {quadro.nome}
          </span>
        </div>

        <CardMenu
          cartao={cartao}
          quadroId={quadro.id}
          colunas={colunas}
          areas={areas}
          membros={membros}
          currentUserId={currentUserId}
          onDeleted={onDeleted}
          onMovedAway={onDeleted}
          onClose={onClose}
        />
      </div>

      {/* Body Grid: Esquerda Form/Abas Espaçoso, Direita Sidebar de Atributos Otimizada */}
      <div className="flex-1 overflow-y-auto lg:overflow-hidden grid grid-cols-1 lg:grid-cols-[1fr_340px] divide-y lg:divide-y-0 lg:divide-x divide-border min-h-0">
        {/* Coluna Esquerda: Título, Abas e Botão Salvar */}
        <form id="card-detalhe-form" onSubmit={handleSubmit} className="p-5 sm:p-6 flex flex-col lg:overflow-hidden justify-between space-y-4">
          <div className="space-y-4 lg:overflow-y-auto pr-2 pb-2 custom-scrollbar flex-1 flex flex-col">
            {/* Input de Título - Direto sem folga superior */}
            <div>
              <Input 
                name="titulo" 
                defaultValue={cartao.titulo} 
                required 
                className="text-xl sm:text-2xl font-extrabold bg-secondary/30 border-border hover:bg-secondary/60 focus:border-primary focus:bg-background rounded-lg px-3.5 py-2 text-foreground transition-all shadow-xs" 
                placeholder="Título do card..."
              />
            </div>

            {/* Navegação por Abas */}
            <Tabs defaultValue="descricao" className="w-full flex-1 flex flex-col">
              <div className="overflow-x-auto pb-1 custom-scrollbar shrink-0">
                <TabsList className="w-max max-w-full justify-start bg-secondary/40 p-1 border border-border rounded-xl gap-1">
                  <TabsTrigger value="descricao" className="rounded-lg text-xs font-semibold px-3.5 py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    Descrição
                  </TabsTrigger>
                  <TabsTrigger value="requisitos" className="rounded-lg text-xs font-semibold px-3.5 py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    Requisitos da etapa
                  </TabsTrigger>
                  <TabsTrigger value="comentarios" className="rounded-lg text-xs font-semibold px-3.5 py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    Comentários ({comentarios.length})
                  </TabsTrigger>
                  <TabsTrigger value="emails" className="rounded-lg text-xs font-semibold px-3.5 py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    Emails
                  </TabsTrigger>
                  <TabsTrigger value="anexos" className="rounded-lg text-xs font-semibold px-3.5 py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    Anexos
                  </TabsTrigger>
                  <TabsTrigger value="subtarefas" className="rounded-lg text-xs font-semibold px-3.5 py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    Subtarefas
                  </TabsTrigger>
                  <TabsTrigger value="regras" className="rounded-lg text-xs font-semibold px-3.5 py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    Regras
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="descricao" className="pt-3 flex-1 flex flex-col">
                <Textarea 
                  name="descricao" 
                  rows={10} 
                  defaultValue={cartao.descricao ?? ''} 
                  placeholder="Descreva a tarefa detalhadamente..." 
                  className="bg-secondary/30 hover:bg-secondary/60 border-border focus:border-primary rounded-xl text-xs sm:text-sm leading-relaxed p-4 flex-1 min-h-[220px]"
                />
              </TabsContent>

              <TabsContent value="requisitos" className="pt-3">
                <RequisitosTab cartaoId={cartao.id} colunaId={colunaId} quadroId={quadro.id} />
              </TabsContent>

              <TabsContent value="comentarios" className="space-y-4 pt-3 flex-1 flex flex-col min-h-0">
                {/* Área de Novo Comentário */}
                <div className="rounded-xl border border-border/80 bg-secondary/20 p-3.5 space-y-2.5 shadow-xs">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/20 border border-primary/30 text-primary font-bold flex items-center justify-center text-xs shrink-0 mt-0.5 shadow-xs">
                      {getInitials(membros.find((m) => m.id === currentUserId)?.nome ?? 'Eu')}
                    </div>
                    <div className="flex-1 space-y-2">
                      <Textarea
                        value={novoComentario}
                        onChange={(e) => setNovoComentario(e.target.value)}
                        onKeyDown={(e) => {
                          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                            e.preventDefault()
                            handleComentar()
                          }
                        }}
                        placeholder="Escreva um comentário ou mensagem..."
                        rows={2}
                        className="w-full bg-background/80 hover:bg-background border-border/70 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl text-xs p-3 transition-all placeholder:text-muted-foreground/60 shadow-xs resize-none"
                      />
                      <div className="flex items-center justify-between pt-0.5">
                        <span className="text-[11px] text-muted-foreground/70 flex items-center gap-1">
                          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-muted/60 border border-border/60 rounded text-muted-foreground">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-muted/60 border border-border/60 rounded text-muted-foreground">Enter</kbd> para enviar
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          disabled={!novoComentario.trim() || isPending}
                          onClick={handleComentar}
                          className="h-8 px-4 bg-primary text-primary-foreground font-semibold rounded-lg shrink-0 text-xs shadow-xs hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                          <span>Comentar</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Filtros e Cabeçalho da Timeline */}
                <div className="flex items-center justify-between border-b border-border/50 pb-2 shrink-0 pt-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <MessageSquare className="h-3.5 w-3.5 text-primary" />
                    <span>Atividade e Comentários</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary font-mono font-bold text-foreground">
                      {comentarios.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 bg-secondary/40 p-0.5 rounded-lg border border-border/50 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setFiltroTipo('todos')}
                      className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                        filtroTipo === 'todos'
                          ? 'bg-background text-foreground shadow-xs font-semibold'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Todos ({comentarios.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFiltroTipo('usuario')}
                      className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                        filtroTipo === 'usuario'
                          ? 'bg-background text-foreground shadow-xs font-semibold'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Comentários ({comentarios.filter((c) => c.tipo !== 'sistema').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFiltroTipo('sistema')}
                      className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                        filtroTipo === 'sistema'
                          ? 'bg-background text-foreground shadow-xs font-semibold'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Histórico ({comentarios.filter((c) => c.tipo === 'sistema').length})
                    </button>
                  </div>
                </div>

                {/* Lista de Comentários / Timeline */}
                <div className="space-y-3 flex-1 overflow-y-auto pr-1 custom-scrollbar">
                  {comentarios.filter((c) => {
                    if (filtroTipo === 'usuario') return c.tipo !== 'sistema'
                    if (filtroTipo === 'sistema') return c.tipo === 'sistema'
                    return true
                  }).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 px-4 text-center bg-secondary/10 rounded-xl border border-dashed border-border/60">
                      <MessageSquare className="h-8 w-8 text-muted-foreground/40 mb-2" />
                      <p className="text-xs font-semibold text-muted-foreground">Nenhum comentário ou atividade encontrada.</p>
                      <p className="text-[11px] text-muted-foreground/60 mt-0.5">Seja o primeiro a deixar um comentário nesta tarefa.</p>
                    </div>
                  ) : (
                    comentarios
                      .filter((c) => {
                        if (filtroTipo === 'usuario') return c.tipo !== 'sistema'
                        if (filtroTipo === 'sistema') return c.tipo === 'sistema'
                        return true
                      })
                      .map((c) =>
                        c.tipo === 'sistema' ? (
                          <div key={c.id} className="relative pl-6 py-1.5 flex items-baseline gap-2.5 text-xs text-muted-foreground group">
                            <span className="absolute left-2.5 top-0 bottom-0 w-px bg-border/60" />
                            <span className="absolute left-1.5 top-2.5 h-2 w-2 rounded-full bg-primary/40 border border-primary/60 group-hover:scale-125 transition-transform" />

                            <div className="flex-1 flex flex-wrap items-center justify-between gap-2 bg-secondary/20 hover:bg-secondary/30 border border-border/40 rounded-lg px-3 py-2 transition-colors">
                              <span className="font-medium text-foreground/80 leading-relaxed text-[11px]">
                                {c.conteudo}
                              </span>
                              <span className="text-[10px] text-muted-foreground/70 font-mono shrink-0">
                                {new Date(c.created_at).toLocaleString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div
                            key={c.id}
                            className={`group relative flex items-start gap-3 rounded-xl border p-4 text-xs transition-all shadow-xs ${
                              c.colaborador_id === currentUserId
                                ? 'bg-primary/5 border-primary/20 hover:border-primary/40'
                                : 'bg-secondary/20 border-border/80 hover:border-border'
                            }`}
                          >
                            <div
                              className={`h-9 w-9 rounded-full font-bold flex items-center justify-center text-xs shrink-0 shadow-xs border ${
                                c.colaborador_id === currentUserId
                                  ? 'bg-primary text-primary-foreground border-primary/30'
                                  : 'bg-secondary border-border text-foreground'
                              }`}
                            >
                              {getInitials(c.colaboradores?.nome ?? '—')}
                            </div>

                            <div className="flex-1 min-w-0 space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-xs text-foreground">
                                    {c.colaboradores?.nome ?? '—'}
                                  </span>
                                  {c.colaborador_id === currentUserId && (
                                    <span className="text-[9px] font-extrabold uppercase tracking-wider bg-primary/20 text-primary px-1.5 py-0.5 rounded-full border border-primary/30">
                                      Você
                                    </span>
                                  )}
                                  <span className="text-[10px] text-muted-foreground/70">
                                    • {new Date(c.created_at).toLocaleString('pt-BR', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                </div>

                                {c.colaborador_id === currentUserId && (
                                  <button
                                    type="button"
                                    onClick={() => handleExcluirComentario(c.id)}
                                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 p-1 rounded-md transition-all cursor-pointer"
                                    title="Excluir comentário"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>

                              <p className="whitespace-pre-wrap text-foreground/90 leading-relaxed text-xs">
                                {c.conteudo}
                              </p>
                            </div>
                          </div>
                        )
                      )
                  )}
                </div>
              </TabsContent>

              <TabsContent value="emails" className="pt-3">
                <EmailsTab cartaoId={cartao.id} quadroId={quadro.id} />
              </TabsContent>

              <TabsContent value="anexos" className="pt-3">
                <AnexosTab cartaoId={cartao.id} quadroId={quadro.id} />
              </TabsContent>

              <TabsContent value="subtarefas" className="pt-3">
                <SubtarefasTab cartao={cartao} quadroId={quadro.id} onSelect={() => toast.info('Abra o card pela busca do quadro para editar a subtarefa.')} />
              </TabsContent>

              <TabsContent value="regras" className="pt-3">
                <RegrasTab cartao={cartao} quadroId={quadro.id} membros={membros} />
              </TabsContent>
            </Tabs>
          </div>

          {/* Botão de Salvar Alterações */}
          <Button type="submit" className="w-full shrink-0 h-11 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2" disabled={isPending}>
            {isPending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                Salvar Alterações
              </span>
            )}
          </Button>
        </form>

        {/* Coluna Direita (Sidebar de Atributos Otimizada) */}
        <aside className="p-5 sm:p-6 space-y-4 lg:overflow-y-auto bg-secondary/15 custom-scrollbar text-xs">
          {/* Quadro Info */}
          <div className="space-y-1 pb-3 border-b border-border">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">Quadro</span>
            <p className="text-xs font-bold text-foreground">{quadro.nome}</p>
          </div>

          {/* 1. Timer / Play no TOPO para Acesso Rápido */}
          <div className="bg-primary/10 border border-primary/25 rounded-xl p-3.5 space-y-2">
            <TempoWidget cartaoId={cartao.id} quadroId={quadro.id} tempoEstimadoMin={cartao.tempoEstimadoMin} />
          </div>

          {/* 2. Etapa / Coluna */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-primary" /> Etapa
            </span>
            <Select value={colunaId} onValueChange={(v) => v && setColunaId(v)}>
              <SelectTrigger className={selectTriggerClass}>
                <SelectValue>{(v: string) => colunas.find((c) => c.id === v)?.nome ?? v}</SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-lg border border-border">
                {colunas.map((c) => <SelectItem key={c.id} value={c.id} className="text-xs cursor-pointer">{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* 3. Tags & Tipo */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-primary" /> Tags
              </span>
              <button type="button" onClick={() => setShowNovaEtiqueta((v) => !v)} className="text-[11px] font-bold text-primary hover:underline">
                + Nova
              </button>
            </div>
            {showNovaEtiqueta && (
              <div className="flex items-center gap-1.5 my-2">
                <input type="color" name="cor" value={novaEtiquetaCor} onChange={(e) => setNovaEtiquetaCor(e.target.value)} className="h-7 w-7 rounded border border-border bg-transparent p-0.5 cursor-pointer" />
                <Input 
                  name="nome" 
                  value={novaEtiquetaNome} 
                  onChange={(e) => setNovaEtiquetaNome(e.target.value)} 
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleCriarEtiqueta()
                    }
                  }}
                  placeholder="Nome" 
                  className="h-7 flex-1 text-xs bg-secondary/50 border-border rounded-md" 
                />
                <Button type="button" size="icon-sm" variant="outline" onClick={handleCriarEtiqueta} className="h-7 w-7 rounded-md"><Plus className="h-3 w-3" /></Button>
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {etiquetas.map((et) => {
                const ativo = cardEtiquetas.includes(et.id)
                return (
                  <button
                    key={et.id}
                    type="button"
                    onClick={() => setCardEtiquetas((prev) => (ativo ? prev.filter((id) => id !== et.id) : [...prev, et.id]))}
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-all cursor-pointer"
                    style={{ color: et.cor, borderColor: et.cor, backgroundColor: `${et.cor}1A`, opacity: ativo ? 1 : 0.4 }}
                  >
                    {et.nome}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">Tipo</span>
            <Select value={tipo} onValueChange={(v) => v && setTipo(v as Cartao['tipo'])}>
              <SelectTrigger className={selectTriggerClass}>
                <SelectValue>{(v: Cartao['tipo']) => TIPO_LABEL[v]}</SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-lg border border-border">
                {(Object.keys(TIPO_LABEL) as Cartao['tipo'][]).map((t) => <SelectItem key={t} value={t} className="text-xs cursor-pointer">{TIPO_LABEL[t]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* 4. Prioridade & Estimativa */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1.5">
              <Label htmlFor="cd-prioridade" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">Prioridade</Label>
              <Select value={prioridade} onValueChange={(v) => setPrioridade((v as Cartao['prioridade']) ?? 'media')}>
                <SelectTrigger id="cd-prioridade" className={selectTriggerClass}><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-lg border border-border">
                  <SelectItem value="baixa" className="text-xs cursor-pointer">Baixa</SelectItem>
                  <SelectItem value="media" className="text-xs cursor-pointer">Média</SelectItem>
                  <SelectItem value="alta" className="text-xs cursor-pointer">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cd-tempo-estimado" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">Estimativa (min)</Label>
              <Input id="cd-tempo-estimado" form="card-detalhe-form" name="tempoEstimadoMin" type="number" min={1} defaultValue={cartao.tempoEstimadoMin ?? ''} className="h-9 bg-secondary/50 border-border rounded-lg text-xs font-bold" />
            </div>
          </div>

          {/* 5. Datas Desejadas */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1.5">
              <Label htmlFor="cd-inicio" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">Início desejado</Label>
              <Input id="cd-inicio" form="card-detalhe-form" name="inicioDesejado" type="date" defaultValue={cartao.inicioDesejado ?? ''} className="h-9 bg-secondary/50 border-border rounded-lg text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cd-prazo" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">Entrega desejada</Label>
              <Input id="cd-prazo" form="card-detalhe-form" name="prazo" type="date" defaultValue={cartao.prazo ?? ''} className="h-9 bg-secondary/50 border-border rounded-lg text-xs" />
            </div>
          </div>

          {/* 6. Repetição & Data Conclusão */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1.5">
              <Label htmlFor="cd-repeticao" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">Repetição</Label>
              <Select value={recorrencia} onValueChange={(v) => v && setRecorrencia(v)}>
                <SelectTrigger id="cd-repeticao" className={selectTriggerClass}><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-lg border border-border">
                  <SelectItem value="nenhuma" className="text-xs cursor-pointer">Nenhuma</SelectItem>
                  <SelectItem value="diaria" className="text-xs cursor-pointer">Diária</SelectItem>
                  <SelectItem value="semanal" className="text-xs cursor-pointer">Semanal</SelectItem>
                  <SelectItem value="mensal" className="text-xs cursor-pointer">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cd-entrega" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">Data entrega</Label>
              <Input id="cd-entrega" form="card-detalhe-form" name="entregueEm" type="date" defaultValue={cartao.entregueEm ? cartao.entregueEm.slice(0, 10) : ''} className="h-9 bg-secondary/50 border-border rounded-lg text-xs" />
            </div>
          </div>

          {/* 7. Responsáveis */}
          <div className="space-y-1.5 pt-2 border-t border-border/60">
            <Label className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              <Users className="h-3.5 w-3.5 text-primary" /> Responsáveis
            </Label>
            <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-secondary/30 p-2.5 max-h-48 overflow-y-auto custom-scrollbar">
              {membros.length === 0 ? (
                <p className="text-xs text-muted-foreground p-1">Nenhum membro vinculado a este quadro.</p>
              ) : (
                membros.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 text-xs cursor-pointer p-1.5 rounded-md hover:bg-secondary/60 transition-colors">
                    <Checkbox
                      checked={responsaveis.includes(m.id)}
                      onCheckedChange={(checked) => setResponsaveis((prev) => (checked ? [...prev, m.id] : prev.filter((id) => id !== m.id)))}
                    />
                    <div className="h-5.5 w-5.5 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center text-[9px] font-bold shrink-0">
                      {getInitials(m.nome)}
                    </div>
                    <span className="font-medium text-foreground truncate">{m.nome}</span>
                  </label>
                ))
              )}
            </div>
            {membrosNaoAutorizados.length > 0 && (
              <div>
                <button type="button" onClick={() => setMostrarNaoAutorizados((v) => !v)} className="text-[11px] text-muted-foreground hover:underline">
                  Não autorizados ({membrosNaoAutorizados.length})
                </button>
                {mostrarNaoAutorizados && (
                  <div className="mt-1 flex flex-wrap gap-1.5 rounded-lg border border-dashed border-border p-2 opacity-50">
                    {membrosNaoAutorizados.map((m) => (
                      <span key={m.id} className="text-[11px]">{m.nome}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 8. Outros Widgets & Atributos (Centro & TAG) */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">Centro</span>
              <Select value={centroId} onValueChange={(v) => setCentroId(v ?? '')}>
                <SelectTrigger className={selectTriggerClass}>
                  <SelectValue placeholder="—">{(v: string) => areas.find((a) => a.id === v)?.nome ?? '—'}</SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-lg border border-border">
                  {areas.map((a) => <SelectItem key={a.id} value={a.id} className="text-xs cursor-pointer">{a.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cd-tag" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">TAG (Ref)</Label>
              <Input id="cd-tag" form="card-detalhe-form" name="tagReferencia" defaultValue={cartao.tagReferencia ?? ''} placeholder="Ref" className="h-9 bg-secondary/50 border-border rounded-lg text-xs" />
            </div>
          </div>

          <SeguidoresWidget cartaoId={cartao.id} quadroId={quadro.id} currentUserId={currentUserId} membros={membros} />
          <ChecklistWidget cartaoId={cartao.id} quadroId={quadro.id} />
          <AprovacaoWidget cartaoId={cartao.id} quadroId={quadro.id} currentUserId={currentUserId} membros={membros} onStatusChange={setAprovacaoAtual} />
        </aside>
      </div>
    </>
  )
}
