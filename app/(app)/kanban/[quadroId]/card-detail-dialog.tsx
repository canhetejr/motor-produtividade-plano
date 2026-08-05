'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/utils/supabase/client'
import { atualizarCartao, criarEtiqueta, excluirEtiqueta, criarComentario, excluirComentario } from '../actions'
import { DependenciasWidget } from './dependencias-widget'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BottomSheet, BottomSheetContent } from '@/components/ui/bottom-sheet'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Users, Tag, Plus, Send, Hash, Layers, Save, MessageSquare, Trash2, CheckCircle2, X, ClipboardList } from 'lucide-react'
import { CardMenu } from './card-menu'
import { TempoWidget, TimerInline, TempoNaEtapa, SeguidoresWidget, ChecklistWidget, AprovacaoWidget, useTimerCartao } from './card-detail-widgets'
import { CamposCustomizados } from './campos-customizados'
import { SeletorDemanda } from './create-card-dialog'
import { RequisitosTab, SubtarefasTab, RegrasTab, AnexosTab, EmailsTab } from './card-detail-tabs'
import { RichTextEditorLazy as RichTextEditor } from '@/components/ui/rich-text-editor-lazy'
import { RichTextView } from '@/components/ui/rich-text-view'
import { htmlVazio } from '@/lib/rich-text-texto'
import { demandaPermitidaParaResponsaveis, demandasPermitidasParaResponsaveis } from '@/lib/demandas-responsaveis'
import type { Cartao, Coluna, Etiqueta, MembroQuadro, MembroNaoAutorizado, Quadro, Aprovacao, CampoCustomizado, DemandaOpcao } from './types'

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
  onEtiquetaExcluida: (etiquetaId: string) => void
  /** Troca o card aberto no dialog — usado ao clicar numa subtarefa. */
  onAbrirCartao: (cartaoId: string) => void
  isGestor: boolean
  camposCustomizados: CampoCustomizado[]
  demandas: DemandaOpcao[]
  /** Cards do quadro, para escolher bloqueadores. */
  cartoesDoQuadro: { id: string; codigo: string | null; titulo: string }[]
}


export function CardDetailDialog({ cartao, onClose, ...rest }: { cartao: Cartao | null; onClose: () => void } & Omit<CardDetailFormProps, 'cartao' | 'onClose'>) {
  // BottomSheet, e nao Dialog: no celular o card abre subindo da borda de
  // baixo, onde o polegar ja esta — e o pedido explicito do brief ("abertura
  // do card em bottom sheet"). Acima de sm ele volta a ser um dialogo grande e
  // centralizado, quase em tela cheia, que e como este card sempre funcionou
  // no desktop. So o invólucro muda; CardDetailForm (as 900+ linhas de abas,
  // widgets e o editor) nao sabe nem precisa saber qual dos dois esta por
  // fora — nao usa nenhuma outra peca do Dialog alem do wrapper.
  return (
    <BottomSheet open={!!cartao} onOpenChange={(open) => !open && onClose()}>
      <BottomSheetContent className="h-[92dvh] max-h-[92dvh] w-full gap-0 overflow-hidden rounded-t-2xl border-border bg-card p-0 text-foreground shadow-2xl sm:w-[95vw] sm:max-w-[1550px] sm:rounded-2xl">
        {cartao && <CardDetailForm key={cartao.id} cartao={cartao} onClose={onClose} {...rest} />}
      </BottomSheetContent>
    </BottomSheet>
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
  onEtiquetaExcluida,
  onAbrirCartao,
  isGestor,
  camposCustomizados,
  demandas,
  cartoesDoQuadro,
}: CardDetailFormProps) {
  const [isPending, startTransition] = useTransition()
  const [prioridade, setPrioridade] = useState<Cartao['prioridade']>(cartao.prioridade)
  const [colunaId, setColunaId] = useState(cartao.coluna_id)
  const [tipo, setTipo] = useState<Cartao['tipo']>(cartao.tipo)
  const [centroId, setCentroId] = useState(cartao.centroId ?? '')
  const [demandaId, setDemandaId] = useState(cartao.demandaId ?? '')
  const [recorrencia, setRecorrencia] = useState<string>(cartao.recorrencia?.tipo ?? 'nenhuma')
  const [responsaveis, setResponsaveis] = useState<string[]>(cartao.responsaveis)
  const [cardEtiquetas, setCardEtiquetas] = useState<string[]>(cartao.etiquetas)
  const [novaEtiquetaNome, setNovaEtiquetaNome] = useState('')
  const [novaEtiquetaCor, setNovaEtiquetaCor] = useState('#6B7280')
  const [showNovaEtiqueta, setShowNovaEtiqueta] = useState(false)
  const [mostrarNaoAutorizados, setMostrarNaoAutorizados] = useState(false)
  const [comentarios, setComentarios] = useState<Comentario[]>([])
  const [novoComentario, setNovoComentario] = useState('')
  const [comentarioKey, setComentarioKey] = useState(0)
  const [aprovacaoAtual, setAprovacaoAtual] = useState<Aprovacao | null>(null)
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'usuario' | 'sistema'>('todos')
  const demandasDisponiveis = demandasPermitidasParaResponsaveis(demandas, membros, responsaveis)

  // Uma instância só do cronômetro para o card inteiro. O play do cabeçalho e
  // o bloco "Tempo nesta tarefa" da sidebar leem o MESMO estado — com um hook
  // em cada, os dois divergiam ao clicar em qualquer um deles.
  const timer = useTimerCartao(cartao.id, quadro.id, {
    cartaoTitulo: cartao.titulo,
    colunaNome: colunas.find((coluna) => coluna.id === cartao.coluna_id)?.nome ?? null,
    tempoEstimadoMin: cartao.tempoEstimadoMin,
  })

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
    if (demandaId) formData.set('demandaId', demandaId)
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
        demandaId: demandaId || null,
        inicioDesejado: (formData.get('inicioDesejado') as string) || null,
        tempoEstimadoMin: formData.get('tempoEstimadoMin') ? Number(formData.get('tempoEstimadoMin')) : null,
        tagReferencia: (formData.get('tagReferencia') as string) || null,
        responsaveis,
        etiquetas: cardEtiquetas,
      })
      toast.success('Card atualizado!')
      onClose()
    })
  }

  function definirResponsaveis(proximos: string[]) {
    setResponsaveis(proximos)
    if (!demandaPermitidaParaResponsaveis(demandaId, demandas, membros, proximos)) setDemandaId('')
  }

  function handleCriarEtiqueta() {
    if (!novaEtiquetaNome.trim()) return
    const formData = new FormData()
    formData.set('nome', novaEtiquetaNome.trim())
    formData.set('cor', novaEtiquetaCor)
    startTransition(async () => {
      const result = await criarEtiqueta(quadro.id, formData)
      if (!result.ok || !result.data) {
        toast.error(result.ok ? 'Falha ao criar a etiqueta.' : result.error)
        return
      }
      const criada = result.data
      onEtiquetaCriada(criada)
      setCardEtiquetas((prev) => [...prev, criada.id])
      setNovaEtiquetaNome('')
      setShowNovaEtiqueta(false)
    })
  }

  function handleExcluirEtiqueta(etiqueta: Etiqueta) {
    // Etiqueta é do quadro inteiro, não deste card — vale confirmar.
    if (!confirm(`Excluir a etiqueta "${etiqueta.nome}" de todo o quadro?`)) return
    startTransition(async () => {
      const result = await excluirEtiqueta(etiqueta.id, quadro.id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setCardEtiquetas((prev) => prev.filter((id) => id !== etiqueta.id))
      onEtiquetaExcluida(etiqueta.id)
      toast.success('Etiqueta excluída.')
    })
  }

  function handleComentar() {
    // htmlVazio e não `.trim()`: o editor deixa "<p></p>" num campo em branco,
    // que passaria como conteúdo.
    if (htmlVazio(novoComentario)) return
    const formData = new FormData()
    formData.set('conteudo', novoComentario)
    setNovoComentario('')
    // O editor lê o conteúdo só na montagem, então limpar o estado não limpa a
    // caixa — remontar é o jeito de esvaziar sem lutar contra o ProseMirror.
    setComentarioKey((k) => k + 1)
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

  const comentariosDeUsuario = comentarios.filter((c) => c.tipo !== 'sistema')
  const comentariosDeSistema = comentarios.filter((c) => c.tipo === 'sistema')
  const comentariosFiltrados =
    filtroTipo === 'usuario' ? comentariosDeUsuario : filtroTipo === 'sistema' ? comentariosDeSistema : comentarios

  const slaEtapaAtual = colunas.find((c) => c.id === colunaId)?.slaHoras ?? null

  const selectTriggerClass = 'w-full h-9 bg-secondary/50 hover:bg-secondary border-border focus:border-primary focus:ring-1 focus:ring-primary rounded-lg text-xs font-medium'

  return (
    <>
      {/* Banner de Aprovação (se houver) */}
      {aprovacaoAtual && (
        <div
          className={
            'shrink-0 px-5 py-2 text-xs font-bold flex items-center justify-between border-b ' +
            (aprovacaoAtual.status === 'APROVADA'
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
              : aprovacaoAtual.status === 'REJEITADA'
                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20')
          }
        >
          <span>
            {aprovacaoAtual.status === 'APROVADA' && 'Solicitação aprovada'}
            {aprovacaoAtual.status === 'REJEITADA' && 'Solicitação rejeitada'}
            {aprovacaoAtual.status === 'PENDENTE' && `Aguardando aprovação de ${aprovacaoAtual.aprovadorNome ?? '—'}`}
          </span>
        </div>
      )}

      {/* Header: play/cronômetro à esquerda, como na ferramenta de referência —
          iniciar o tempo é a ação mais frequente e estava enterrada na sidebar. */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-secondary/25 px-3 py-2.5 sm:gap-4 sm:px-5">
        <div className="flex items-center gap-2 min-w-0">
          <TimerInline timer={timer} />
          <span className="font-mono text-xs font-bold bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 rounded-md flex items-center gap-1.5">
            <Hash className="w-3 h-3" />
            {cartao.codigo}
          </span>
          <span className="hidden truncate text-xs font-semibold text-muted-foreground sm:inline">
            {quadro.nome}
          </span>
          {cartao.entregueEm && (
            <span className="flex shrink-0 items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-3xs font-bold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3" /> <span className="hidden sm:inline">Entregue</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
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
          <div className="h-4 w-px bg-border/80 mx-0.5" />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-lg transition-colors cursor-pointer"
            title="Fechar (Esc)"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Fechar</span>
          </Button>
        </div>
      </div>

      {/* Body Grid: Esquerda Form/Abas Espaçoso, Direita Sidebar de Atributos Otimizada */}
      <div className="flex-1 overflow-y-auto lg:overflow-hidden grid grid-cols-1 lg:grid-cols-[1fr_340px] divide-y lg:divide-y-0 lg:divide-x divide-border min-h-0">
        {/* Coluna Esquerda: Título, Abas e Botão Salvar */}
        <form id="card-detalhe-form" onSubmit={handleSubmit} className="flex flex-col justify-between space-y-4 p-4 sm:p-6 lg:overflow-hidden">
          <div className="space-y-4 lg:overflow-y-auto pr-2 pb-2 custom-scrollbar flex-1 flex flex-col">
            {/* Input de Título - Direto sem folga superior */}
            <div>
              <Input 
                name="titulo" 
                defaultValue={cartao.titulo} 
                required 
                className="rounded-lg border-border bg-secondary/30 px-3.5 py-2 text-xl font-bold text-foreground shadow-xs transition-all hover:bg-secondary/60 focus:border-primary focus:bg-background"
                placeholder="Título do card..."
              />
            </div>

            {/* Navegação por Abas */}
            <Tabs defaultValue="descricao" className="w-full flex-1 flex flex-col">
              <div className="overflow-x-auto pb-1 custom-scrollbar shrink-0">
                <TabsList className="w-max max-w-full justify-start bg-secondary/40 p-1 border border-border rounded-xl gap-1">
                  <TabsTrigger value="descricao" className="rounded-lg text-xs font-semibold px-3.5 py-1.5 data-active:bg-primary data-active:text-primary-foreground">
                    Descrição
                  </TabsTrigger>
                  <TabsTrigger value="requisitos" className="rounded-lg text-xs font-semibold px-3.5 py-1.5 data-active:bg-primary data-active:text-primary-foreground">
                    Requisitos da etapa
                  </TabsTrigger>
                  <TabsTrigger value="comentarios" className="rounded-lg text-xs font-semibold px-3.5 py-1.5 data-active:bg-primary data-active:text-primary-foreground">
                    Comentários ({comentarios.length})
                  </TabsTrigger>
                  <TabsTrigger value="emails" className="rounded-lg text-xs font-semibold px-3.5 py-1.5 data-active:bg-primary data-active:text-primary-foreground">
                    Emails
                  </TabsTrigger>
                  <TabsTrigger value="anexos" className="rounded-lg text-xs font-semibold px-3.5 py-1.5 data-active:bg-primary data-active:text-primary-foreground">
                    Anexos{cartao.totalAnexos > 0 ? ` (${cartao.totalAnexos})` : ''}
                  </TabsTrigger>
                  <TabsTrigger value="subtarefas" className="rounded-lg text-xs font-semibold px-3.5 py-1.5 data-active:bg-primary data-active:text-primary-foreground">
                    Subtarefas{cartao.totalSubtarefas > 0 ? ` (${cartao.totalSubtarefas})` : ''}
                  </TabsTrigger>
                  <TabsTrigger value="regras" className="rounded-lg text-xs font-semibold px-3.5 py-1.5 data-active:bg-primary data-active:text-primary-foreground">
                    Regras
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="descricao" className="pt-3 flex-1 flex flex-col">
                {/* `key` no id do card: o editor lê o conteúdo só na montagem,
                    então sem isto trocar de card pela busca ou por subtarefa
                    manteria a descrição do card anterior na tela. */}
                <RichTextEditor
                  key={cartao.id}
                  name="descricao"
                  conteudoInicial={cartao.descricao}
                  placeholder="Descreva a tarefa detalhadamente..."
                  minHeight="min-h-[220px]"
                  className="flex-1"
                />
              </TabsContent>

              <TabsContent value="requisitos" className="pt-3">
                <RequisitosTab
                  cartaoId={cartao.id}
                  colunaId={colunaId}
                  colunaNome={colunas.find((c) => c.id === colunaId)?.nome ?? '—'}
                  quadroId={quadro.id}
                  isGestor={isGestor}
                />
              </TabsContent>

              <TabsContent value="comentarios" className="space-y-4 pt-3 flex-1 flex flex-col min-h-0">
                {/* Área de Novo Comentário */}
                <div className="rounded-xl border border-border/80 bg-secondary/20 p-3.5 space-y-2.5 shadow-xs">
                  <div className="flex items-start gap-3">
                    <Avatar
                      nome={membros.find((m) => m.id === currentUserId)?.nome ?? 'Eu'}
                      tamanho="sm"
                      className="mt-0.5"
                    />
                    <div
                      className="flex-1 space-y-2"
                      onKeyDown={(e) => {
                        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                          e.preventDefault()
                          handleComentar()
                        }
                      }}
                    >
                      <RichTextEditor
                        key={comentarioKey}
                        conteudoInicial=""
                        onChange={setNovoComentario}
                        placeholder="Escreva um comentário ou mensagem..."
                        minHeight="min-h-16"
                        className="bg-background/80"
                      />
                      <div className="flex items-center justify-between pt-0.5">
                        <span className="text-2xs text-muted-foreground/70 flex items-center gap-1">
                          <kbd className="px-1.5 py-0.5 text-3xs font-mono bg-muted/60 border border-border/60 rounded text-muted-foreground">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 text-3xs font-mono bg-muted/60 border border-border/60 rounded text-muted-foreground">Enter</kbd> para enviar
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          disabled={htmlVazio(novoComentario) || isPending}
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
                    <span className="text-3xs px-1.5 py-0.5 rounded-full bg-secondary font-mono font-bold text-foreground">
                      {comentarios.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 bg-secondary/40 p-0.5 rounded-lg border border-border/50 text-2xs">
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
                      Comentários ({comentariosDeUsuario.length})
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
                      Histórico ({comentariosDeSistema.length})
                    </button>
                  </div>
                </div>

                {/* Lista de Comentários / Timeline */}
                <div className="space-y-3 flex-1 overflow-y-auto pr-1 custom-scrollbar">
                  {comentariosFiltrados.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 px-4 text-center bg-secondary/10 rounded-xl border border-dashed border-border/60">
                      <MessageSquare className="h-8 w-8 text-muted-foreground/40 mb-2" />
                      <p className="text-xs font-semibold text-muted-foreground">Nenhum comentário ou atividade encontrada.</p>
                      <p className="text-2xs text-muted-foreground/60 mt-0.5">Seja o primeiro a deixar um comentário nesta tarefa.</p>
                    </div>
                  ) : (
                    comentariosFiltrados
                      .map((c) =>
                        c.tipo === 'sistema' ? (
                          <div key={c.id} className="relative pl-6 py-1.5 flex items-baseline gap-2.5 text-xs text-muted-foreground group">
                            <span className="absolute left-2.5 top-0 bottom-0 w-px bg-border/60" />
                            <span className="absolute left-1.5 top-2.5 h-2 w-2 rounded-full bg-primary/40 border border-primary/60 group-hover:scale-125 transition-transform" />

                            <div className="flex-1 flex flex-wrap items-center justify-between gap-2 bg-secondary/20 hover:bg-secondary/30 border border-border/40 rounded-lg px-3 py-2 transition-colors">
                              <span className="font-medium text-foreground/80 leading-relaxed text-2xs">
                                {c.conteudo}
                              </span>
                              <span className="text-3xs text-muted-foreground/70 font-mono shrink-0">
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
                            {/* O proprio comentario ganha o avatar solido; os
                                demais, o tom neutro — distingue autoria sem
                                depender de ler o nome. */}
                            <Avatar
                              nome={c.colaboradores?.nome ?? '—'}
                              tamanho="md"
                              tom={c.colaborador_id === currentUserId ? 'marca' : 'neutro'}
                              aria-label={c.colaboradores?.nome ?? 'Autor desconhecido'}
                              className={
                                c.colaborador_id === currentUserId
                                  ? 'bg-primary text-primary-foreground ring-primary/30'
                                  : undefined
                              }
                            />

                            <div className="flex-1 min-w-0 space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-xs text-foreground">
                                    {c.colaboradores?.nome ?? '—'}
                                  </span>
                                  {c.colaborador_id === currentUserId && (
                                    <span className="text-4xs font-extrabold uppercase tracking-wider bg-primary/20 text-primary px-1.5 py-0.5 rounded-full border border-primary/30">
                                      Você
                                    </span>
                                  )}
                                  <span className="text-3xs text-muted-foreground/70">
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
                                    className="max-md:opacity-100 focus-within:opacity-100 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 p-1 rounded-md transition-all cursor-pointer"
                                    title="Excluir comentário"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>

                              {/* Só o comentário de usuário é rico. O de
                                  sistema ("moveu para X", "ajustou horas") é
                                  texto montado pelo servidor e segue como
                                  texto — nada a formatar ali. */}
                              <RichTextView html={c.conteudo} className="text-xs" />
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
                <SubtarefasTab cartao={cartao} quadroId={quadro.id} onSelect={onAbrirCartao} />
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
        <aside className="space-y-4 bg-secondary/15 p-4 text-xs custom-scrollbar sm:p-6 lg:overflow-y-auto">
          {/* Quadro Info */}
          <div className="space-y-1 pb-3 border-b border-border">
            <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider block">Quadro</span>
            <p className="text-xs font-bold text-foreground">{quadro.nome}</p>
          </div>

          {/* Demanda: é o que faz o tempo deste card contar no índice. Fica
              colado no bloco de tempo de propósito. */}
          <div className="space-y-1.5">
            <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <ClipboardList className="h-3.5 w-3.5 text-primary" /> Demanda
            </span>
            <SeletorDemanda
              demandas={demandasDisponiveis}
              valor={demandaId}
              onChange={setDemandaId}
              className={selectTriggerClass}
              disabled={!demandaId && (responsaveis.length === 0 || demandasDisponiveis.length === 0)}
              placeholder={responsaveis.length === 0 ? 'Selecione o responsável' : 'Sem demanda disponível'}
            />
            {responsaveis.length > 0 && demandasDisponiveis.length === 0 && (
              <p className="text-3xs text-amber-600 dark:text-amber-400">Os responsáveis precisam pertencer à mesma área para vincular uma demanda.</p>
            )}
          </div>

          {/* 1. Timer / Play no TOPO para Acesso Rápido */}
          <div className="bg-primary/10 border border-primary/25 rounded-xl p-3.5 space-y-2">
            <TempoWidget
              timer={timer}
              quadroId={quadro.id}
              tempoEstimadoMin={cartao.tempoEstimadoMin}
              semDemanda={!demandaId}
              segundosSubtarefas={cartao.tempoSubtarefasMin * 60}
            />
          </div>

          {/* 2. Etapa / Coluna + há quanto tempo o card está nela */}
          <div className="space-y-1.5">
            <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
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
            {cartao.etapaDesde && <TempoNaEtapa etapaDesde={cartao.etapaDesde} slaHoras={slaEtapaAtual} />}
          </div>

          {camposCustomizados.length > 0 && (
            <div className="space-y-4 pt-2 border-t border-border/60">
              <CamposCustomizados
                cartaoId={cartao.id}
                quadroId={quadro.id}
                campos={camposCustomizados}
                membros={membros}
                rotuloClasse="text-2xs font-semibold text-muted-foreground uppercase tracking-wider block"
              />
            </div>
          )}

          {/* 3. Tags & Tipo */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-primary" /> Tags
              </span>
              <button type="button" onClick={() => setShowNovaEtiqueta((v) => !v)} className="text-2xs font-bold text-primary hover:underline">
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
                <Button type="button" size="icon-sm" variant="outline" aria-label="Criar etiqueta" onClick={handleCriarEtiqueta} className="h-7 w-7 rounded-md"><Plus className="h-3 w-3" /></Button>
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {etiquetas.map((et) => {
                const ativo = cardEtiquetas.includes(et.id)
                return (
                  <span
                    key={et.id}
                    className="group/etiqueta inline-flex items-center gap-1 text-2xs font-semibold pl-2 pr-1 py-0.5 rounded-full border transition-all"
                    style={{ color: et.cor, borderColor: et.cor, backgroundColor: `${et.cor}1A`, opacity: ativo ? 1 : 0.4 }}
                  >
                    <button
                      type="button"
                      onClick={() => setCardEtiquetas((prev) => (ativo ? prev.filter((id) => id !== et.id) : [...prev, et.id]))}
                      className="cursor-pointer"
                      title={ativo ? 'Tirar do card' : 'Aplicar ao card'}
                    >
                      {et.nome}
                    </button>
                    {isGestor && (
                      <button
                        type="button"
                        onClick={() => handleExcluirEtiqueta(et)}
                        className="max-md:opacity-100 focus-within:opacity-100 opacity-0 transition-opacity group-hover/etiqueta:opacity-100 cursor-pointer hover:text-destructive"
                        title="Excluir etiqueta do quadro"
                        aria-label={`Excluir etiqueta ${et.nome}`}
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </span>
                )
              })}
            </div>
          </div>

          <DependenciasWidget
            cartaoId={cartao.id}
            quadroId={quadro.id}
            candidatos={cartoesDoQuadro.filter((c) => c.id !== cartao.id)}
          />

          <div className="space-y-1.5">
            <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider block">Tipo</span>
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
              <Label htmlFor="cd-prioridade" className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider block">Prioridade</Label>
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
              <Label htmlFor="cd-tempo-estimado" className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider block">Estimativa (min)</Label>
              <Input id="cd-tempo-estimado" form="card-detalhe-form" name="tempoEstimadoMin" type="number" min={1} defaultValue={cartao.tempoEstimadoMin ?? ''} className="h-9 bg-secondary/50 border-border rounded-lg text-xs font-bold" />
            </div>
          </div>

          {/* 5. Datas Desejadas */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1.5">
              <Label htmlFor="cd-inicio" className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider block">Início desejado</Label>
              <Input id="cd-inicio" form="card-detalhe-form" name="inicioDesejado" type="date" defaultValue={cartao.inicioDesejado ?? ''} className="h-9 bg-secondary/50 border-border rounded-lg text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cd-prazo" className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider block">Entrega desejada</Label>
              <Input id="cd-prazo" form="card-detalhe-form" name="prazo" type="date" defaultValue={cartao.prazo ?? ''} className="h-9 bg-secondary/50 border-border rounded-lg text-xs" />
            </div>
          </div>

          {/* 6. Repetição & Data Conclusão */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1.5">
              <Label htmlFor="cd-repeticao" className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider block">Repetição</Label>
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
            {/* Entrega é derivada da etapa (trigger cartoes_aplicar_entrega),
                não um campo editável — ter as duas coisas dava duas fontes de
                verdade pro mesmo dado. */}
            <div className="space-y-1.5">
              <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider block">Data entrega</span>
              <div className="h-9 flex items-center gap-1.5 rounded-lg border border-border bg-secondary/30 px-2.5">
                {cartao.entregueEm ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-semibold text-foreground truncate">
                      {new Date(cartao.entregueEm).toLocaleDateString('pt-BR')}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">Em aberto</span>
                )}
              </div>
            </div>
          </div>

          {/* 7. Responsáveis — Exibição em Avatares com Popover de Alocação */}
          <div className="space-y-2 pt-2 border-t border-border/60">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5 text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
                <Users className="h-3.5 w-3.5 text-primary" /> Responsáveis
              </Label>
              <span className="text-[11px] text-muted-foreground font-medium">
                {responsaveis.length} alocado{responsaveis.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 min-h-[36px]">
              {/* Fotos/Avatares de quem já está alocado */}
              {membros
                .filter((m) => responsaveis.includes(m.id))
                .map((m) => (
                  <div
                    key={m.id}
                    className="group relative flex items-center gap-1.5 bg-secondary/60 hover:bg-secondary border border-border/80 rounded-full pl-1 pr-2 py-0.5 text-xs transition-all shadow-xs"
                    title={m.nome}
                  >
                    <Avatar nome={m.nome} tamanho="xs" aria-label={m.nome} />
                    <span className="font-semibold text-foreground max-w-[110px] truncate text-[11px]">{m.nome}</span>
                    <button
                      type="button"
                      onClick={() => definirResponsaveis(responsaveis.filter((id) => id !== m.id))}
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full p-0.5 transition-colors cursor-pointer"
                      title={`Desalocar ${m.nome}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}

              {/* Botão com ícone de + para alocar outros */}
              <Popover>
                <PopoverTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 rounded-full p-0 flex items-center justify-center border-dashed border-primary/50 hover:border-primary text-primary hover:bg-primary/10 transition-colors shadow-xs"
                      title="Alocar responsável"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  }
                />
                <PopoverContent align="start" className="w-64 p-3 bg-card border border-border shadow-xl rounded-xl space-y-2">
                  <div className="text-xs font-bold text-foreground border-b border-border/60 pb-1.5 flex items-center justify-between">
                    <span>Alocar Responsáveis</span>
                    <span className="text-[10px] text-muted-foreground font-normal">{responsaveis.length} selecionado(s)</span>
                  </div>
                  <div className="max-h-56 overflow-y-auto space-y-1 custom-scrollbar pr-1">
                    {membros.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-2 text-center">Nenhum membro no quadro.</p>
                    ) : (
                      membros.map((m) => {
                        const isSelected = responsaveis.includes(m.id)
                        return (
                          <div
                            key={m.id}
                            onClick={() => definirResponsaveis(
                              isSelected ? responsaveis.filter((id) => id !== m.id) : [...responsaveis, m.id]
                            )}
                            className={`flex items-center justify-between gap-2 p-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-primary/15 text-primary font-semibold'
                                : 'hover:bg-muted/60 text-foreground'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Avatar
                                nome={m.nome}
                                tamanho="xs"
                                tom={responsaveis.includes(m.id) ? 'marca' : 'neutro'}
                              />
                              <span className="truncate">{m.nome}</span>
                            </div>
                            <Checkbox checked={isSelected} className="pointer-events-none" />
                          </div>
                        )
                      })
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              {responsaveis.length === 0 && (
                <span className="text-xs text-muted-foreground italic">Nenhum responsável alocado</span>
              )}
            </div>

            {membrosNaoAutorizados.length > 0 && (
              <div>
                <button type="button" onClick={() => setMostrarNaoAutorizados((v) => !v)} className="text-2xs text-muted-foreground hover:underline">
                  Não autorizados ({membrosNaoAutorizados.length})
                </button>
                {mostrarNaoAutorizados && (
                  <div className="mt-1 flex flex-wrap gap-1.5 rounded-lg border border-dashed border-border p-2 opacity-50">
                    {membrosNaoAutorizados.map((m) => (
                      <span key={m.id} className="text-2xs">{m.nome}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 8. Outros Widgets & Atributos (Centro & TAG) */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1.5">
              <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider block">Centro</span>
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
              <Label htmlFor="cd-tag" className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider block">TAG (Ref)</Label>
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
