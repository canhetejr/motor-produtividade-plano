'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { criarFormulario, atualizarFormulario, type CampoFormularioInput } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Loader2,
  Plus,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Type,
  AlignLeft,
  ListFilter,
  Calendar,
  AlertCircle,
  Link2,
  Settings,
  LayoutList,
  Eye,
  CheckCircle2,
  Palette,
  X,
  FileText,
  HelpCircle,
  Tag,
  Check,
} from 'lucide-react'
import type { Coluna, Formulario } from './types'
import type { TipoCampoFormulario, MapeamentoCampoFormulario } from '@/lib/database.types'

const TIPO_INFO: Record<TipoCampoFormulario, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  texto: { label: 'Texto curto', icon: Type },
  texto_longo: { label: 'Texto longo', icon: AlignLeft },
  selecao: { label: 'Seleção / Menu', icon: ListFilter },
  data: { label: 'Data', icon: Calendar },
  prioridade: { label: 'Prioridade', icon: AlertCircle },
}

const MAPEAMENTO_INFO: Record<MapeamentoCampoFormulario, { label: string; badge: string; desc: string }> = {
  titulo: { label: 'Título do card', badge: 'Título', desc: 'Preenche o nome do card no Kanban' },
  descricao: { label: 'Descrição do card', badge: 'Descrição', desc: 'Preenche o texto de detalhes do card' },
  prazo: { label: 'Prazo do card', badge: 'Prazo', desc: 'Define a data limite no Kanban' },
  prioridade: { label: 'Prioridade do card', badge: 'Urgência', desc: 'Define o nível (baixa, média, alta)' },
  personalizado: { label: 'Campo personalizado', badge: 'Info extra', desc: 'Salvo nos detalhes do formulário' },
}

const PALETA_CORES = [
  { hex: '#820AD1', nome: 'Roxo' },
  { hex: '#2563EB', nome: 'Azul' },
  { hex: '#10B981', nome: 'Verde' },
  { hex: '#E11D48', nome: 'Rosa' },
  { hex: '#F59E0B', nome: 'Laranja' },
  { hex: '#0F172A', nome: 'Grafite' },
]

type CampoLocal = CampoFormularioInput & { localId: string }

function novoCampoLocal(): CampoLocal {
  return {
    localId: crypto.randomUUID(),
    rotulo: '',
    tipo: 'texto',
    placeholder: '',
    obrigatorio: false,
    opcoes: [],
    mapeado_para: 'personalizado',
  }
}

const PRESETS_CAMPOS: { label: string; campo: Omit<CampoLocal, 'localId'> }[] = [
  {
    label: '+ Nome do Solicitante',
    campo: {
      rotulo: 'Seu Nome Completo',
      tipo: 'texto',
      placeholder: 'Ex: Maria Silva',
      obrigatorio: true,
      opcoes: [],
      mapeado_para: 'titulo',
    },
  },
  {
    label: '+ E-mail para Contato',
    campo: {
      rotulo: 'E-mail para Contato',
      tipo: 'texto',
      placeholder: 'nome@empresa.com',
      obrigatorio: true,
      opcoes: [],
      mapeado_para: 'personalizado',
    },
  },
  {
    label: '+ Descrição da Solicitação',
    campo: {
      rotulo: 'Detalhes da Solicitação',
      tipo: 'texto_longo',
      placeholder: 'Descreva em detalhes o que você precisa...',
      obrigatorio: true,
      opcoes: [],
      mapeado_para: 'descricao',
    },
  },
  {
    label: '+ Prazo Desejado',
    campo: {
      rotulo: 'Data Limite Desejada',
      tipo: 'data',
      placeholder: '',
      obrigatorio: false,
      opcoes: [],
      mapeado_para: 'prazo',
    },
  },
  {
    label: '+ Urgência',
    campo: {
      rotulo: 'Nível de Urgência',
      tipo: 'prioridade',
      placeholder: '',
      obrigatorio: true,
      opcoes: [],
      mapeado_para: 'prioridade',
    },
  },
]

export function FormularioBuilderDialog({
  open,
  onOpenChange,
  quadroId,
  colunas,
  formulario,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  quadroId: string
  colunas: Coluna[]
  formulario: Formulario | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
        <DialogHeader className="p-5 pb-4 border-b border-border bg-card/60 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-inner">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">
                {formulario ? 'Editar Formulário Público' : 'Novo Formulário Público'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Personalize os campos e configurações para receber demandas externas direto no Kanban.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <FormularioBuilderForm
          key={formulario?.id ?? 'novo'}
          quadroId={quadroId}
          colunas={colunas}
          formulario={formulario}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function FormularioBuilderForm({
  quadroId,
  colunas,
  formulario,
  onClose,
}: {
  quadroId: string
  colunas: Coluna[]
  formulario: Formulario | null
  onClose: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<'config' | 'campos' | 'preview'>('campos')
  const [titulo, setTitulo] = useState(formulario?.titulo ?? '')
  const [descricao, setDescricao] = useState(formulario?.descricao ?? '')
  const [slug, setSlug] = useState(formulario?.slug ?? '')
  const [colunaId, setColunaId] = useState(formulario?.coluna_id ?? colunas[0]?.id ?? '')
  const [corTema, setCorTema] = useState(formulario?.cor_tema ?? '#820AD1')
  const [mensagemSucesso, setMensagemSucesso] = useState(
    formulario?.mensagem_sucesso ?? 'Recebemos sua solicitação — um card já foi criado no nosso quadro.'
  )
  const [campos, setCampos] = useState<CampoLocal[]>(
    formulario ? formulario.campos.map((c) => ({ ...c, localId: c.id })) : [
      {
        localId: crypto.randomUUID(),
        rotulo: 'Título da Solicitação',
        tipo: 'texto',
        placeholder: 'Ex: Solicitar ajuste no relatório X',
        obrigatorio: true,
        opcoes: [],
        mapeado_para: 'titulo',
      },
      {
        localId: crypto.randomUUID(),
        rotulo: 'Detalhes da Demanda',
        tipo: 'texto_longo',
        placeholder: 'Descreva tudo o que precisa ser feito...',
        obrigatorio: false,
        opcoes: [],
        mapeado_para: 'descricao',
      }
    ]
  )

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://seu-sistema.com'
  const fullUrl = `${baseUrl}/formularios/${slug || 'sua-url'}`

  function atualizarCampo(localId: string, patch: Partial<CampoLocal>) {
    setCampos((prev) => prev.map((c) => (c.localId === localId ? { ...c, ...patch } : c)))
  }

  function removerCampo(localId: string) {
    setCampos((prev) => prev.filter((c) => c.localId !== localId))
  }

  function moverCampo(index: number, direcao: 'up' | 'down') {
    const targetIndex = direcao === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= campos.length) return
    const novosCampos = [...campos]
    const temp = novosCampos[index]
    novosCampos[index] = novosCampos[targetIndex]
    novosCampos[targetIndex] = temp
    setCampos(novosCampos)
  }

  function duplicarCampo(index: number) {
    const original = campos[index]
    const duplicado: CampoLocal = {
      ...original,
      localId: crypto.randomUUID(),
      rotulo: `${original.rotulo} (cópia)`,
    }
    const novosCampos = [...campos]
    novosCampos.splice(index + 1, 0, duplicado)
    setCampos(novosCampos)
  }

  function adicionarPreset(preset: Omit<CampoLocal, 'localId'>) {
    setCampos((prev) => [...prev, { ...preset, localId: crypto.randomUUID() }])
    toast.success(`Campo "${preset.rotulo}" adicionado!`)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!titulo.trim()) {
      setActiveTab('config')
      toast.error('Informe o título do formulário.')
      return
    }
    if (!slug.trim()) {
      setActiveTab('config')
      toast.error('Informe o link do formulário.')
      return
    }
    if (!colunaId) {
      setActiveTab('config')
      toast.error('Selecione a coluna de destino.')
      return
    }
    if (campos.length === 0) {
      setActiveTab('campos')
      toast.error('Adicione pelo menos um campo ao formulário.')
      return
    }

    const semRotulo = campos.find((c) => !c.rotulo.trim())
    if (semRotulo) {
      setActiveTab('campos')
      toast.error('Todos os campos devem possuir um rótulo preenchido.')
      return
    }

    const dados = {
      coluna_id: colunaId,
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      slug: slug.trim(),
      cor_tema: corTema,
      mensagem_sucesso: mensagemSucesso.trim(),
      mostrar_marca: true,
      campos: campos.map(({ localId, ...campo }) => { void localId; return campo }),
    }

    startTransition(async () => {
      const result = formulario ? await atualizarFormulario(formulario.id, quadroId, dados) : await criarFormulario(quadroId, dados)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(formulario ? 'Formulário atualizado com sucesso!' : 'Formulário criado com sucesso!')
      onClose()
    })
  }

  const colunaSelecionada = colunas.find((c) => c.id === colunaId)

  return (
    <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Tab Header Navigation */}
      <div className="px-5 pt-3 border-b border-border bg-card/30 flex items-center justify-between">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList variant="line" className="h-10 gap-4">
            <TabsTrigger value="campos" className="gap-2 text-xs font-semibold px-3 py-2 border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary">
              <LayoutList className="h-4 w-4" />
              Campos ({campos.length})
            </TabsTrigger>
            <TabsTrigger value="config" className="gap-2 text-xs font-semibold px-3 py-2 border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary">
              <Settings className="h-4 w-4" />
              Configurações
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-2 text-xs font-semibold px-3 py-2 border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary">
              <Eye className="h-4 w-4" />
              Pré-visualização
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Main Tab Body */}
      <div className="flex-1 overflow-y-auto p-5">
        {/* TAB 1: CAMPOS DO FORMULÁRIO */}
        {activeTab === 'campos' && (
          <div className="space-y-4">
            {/* Quick Presets Bar */}
            <div className="rounded-xl border border-border/80 bg-muted/40 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" /> Adicionar campos rápidos
                </span>
                <span className="text-[11px] text-muted-foreground">Clique para inserir direto</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS_CAMPOS.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => adicionarPreset(p.campo)}
                    className="inline-flex items-center gap-1 text-xs font-medium bg-background hover:bg-primary/10 hover:text-primary border border-border rounded-lg px-2.5 py-1 transition-all shadow-xs"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Campos List Header */}
            <div className="flex items-center justify-between pt-1">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                Estrutura de Perguntas
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {campos.length} {campos.length === 1 ? 'campo' : 'campos'}
                </Badge>
              </h3>
              <Button
                type="button"
                size="sm"
                className="gap-1.5 font-medium shadow-xs"
                onClick={() => setCampos((prev) => [...prev, novoCampoLocal()])}
              >
                <Plus className="h-4 w-4" /> Adicionar Campo
              </Button>
            </div>

            {/* Empty State */}
            {campos.length === 0 && (
              <div className="rounded-xl border border-dashed border-border p-10 text-center space-y-3">
                <FileText className="h-8 w-8 text-muted-foreground/50 mx-auto" />
                <p className="text-sm text-muted-foreground">Nenhum campo no formulário ainda.</p>
                <Button type="button" variant="outline" size="sm" onClick={() => setCampos([novoCampoLocal()])}>
                  <Plus className="h-4 w-4 mr-1" /> Criar primeiro campo
                </Button>
              </div>
            )}

            {/* Fields Accordion / Card List */}
            <div className="space-y-3">
              {campos.map((campo, index) => {
                const IconeTipo = TIPO_INFO[campo.tipo]?.icon || Type
                const mapInfo = MAPEAMENTO_INFO[campo.mapeado_para]

                return (
                  <div
                    key={campo.localId}
                    className="group relative rounded-xl border border-border bg-card p-4 space-y-3 shadow-xs hover:border-primary/40 transition-all"
                  >
                    {/* Top Row: Reorder, Number, Title, Actions */}
                    <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-3">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {/* Order & Reorder Controls */}
                        <div className="flex items-center gap-0.5 bg-muted/60 rounded-md p-0.5 shrink-0">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => moverCampo(index, 'up')}
                            className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none rounded hover:bg-background transition-colors"
                            title="Mover para cima"
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <span className="text-xs font-mono font-semibold px-1 text-foreground/70">
                            #{index + 1}
                          </span>
                          <button
                            type="button"
                            disabled={index === campos.length - 1}
                            onClick={() => moverCampo(index, 'down')}
                            className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none rounded hover:bg-background transition-colors"
                            title="Mover para baixo"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Title Input */}
                        <Input
                          value={campo.rotulo}
                          onChange={(e) => atualizarCampo(campo.localId, { rotulo: e.target.value })}
                          placeholder="Rótulo / Pergunta do campo (Ex: Seu E-mail)"
                          required
                          className="font-medium text-sm border-transparent hover:border-input focus:border-input bg-transparent focus:bg-background transition-all flex-1"
                        />
                      </div>

                      {/* Right Action Buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge variant="outline" className="text-[10px] bg-muted/40 font-normal hidden sm:inline-flex">
                          {mapInfo?.badge}
                        </Badge>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          className="text-muted-foreground hover:text-foreground"
                          title="Duplicar campo"
                          onClick={() => duplicarCampo(index)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title="Remover campo"
                          onClick={() => removerCampo(campo.localId)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Field Settings Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Tipo do Campo */}
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Tipo de entrada</Label>
                        <Select
                          value={campo.tipo}
                          onValueChange={(v) => atualizarCampo(campo.localId, { tipo: (v as TipoCampoFormulario) ?? 'texto' })}
                        >
                          <SelectTrigger className="h-9 w-full text-xs">
                            <div className="flex items-center gap-2 truncate">
                              <IconeTipo className="h-3.5 w-3.5 text-primary shrink-0" />
                              <SelectValue />
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(TIPO_INFO) as TipoCampoFormulario[]).map((t) => {
                              const ItemIcon = TIPO_INFO[t].icon
                              return (
                                <SelectItem key={t} value={t} className="text-xs">
                                  <div className="flex items-center gap-2">
                                    <ItemIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span>{TIPO_INFO[t].label}</span>
                                  </div>
                                </SelectItem>
                              )
                            })}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Mapeado Para */}
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Destino no Kanban</Label>
                        <Select
                          value={campo.mapeado_para}
                          onValueChange={(v) =>
                            atualizarCampo(campo.localId, { mapeado_para: (v as MapeamentoCampoFormulario) ?? 'personalizado' })
                          }
                        >
                          <SelectTrigger className="h-9 w-full text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(MAPEAMENTO_INFO) as MapeamentoCampoFormulario[]).map((m) => (
                              <SelectItem key={m} value={m} className="text-xs">
                                <div className="flex flex-col">
                                  <span className="font-medium">{MAPEAMENTO_INFO[m].label}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Obrigatório Switch/Checkbox */}
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Preenchimento</Label>
                        <label className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-xs cursor-pointer hover:bg-muted/30 transition-colors">
                          <Checkbox
                            checked={campo.obrigatorio}
                            onCheckedChange={(checked) => atualizarCampo(campo.localId, { obrigatorio: !!checked })}
                          />
                          <span className="font-medium">Obrigatório</span>
                          {campo.obrigatorio && <span className="text-destructive font-bold ml-auto">*</span>}
                        </label>
                      </div>
                    </div>

                    {/* Additional Configs based on Type */}
                    {(campo.tipo === 'texto' || campo.tipo === 'texto_longo') && (
                      <div className="space-y-1 pt-1">
                        <Label className="text-[11px] text-muted-foreground">Placeholder (Dica dentro do campo)</Label>
                        <Input
                          value={campo.placeholder}
                          onChange={(e) => atualizarCampo(campo.localId, { placeholder: e.target.value })}
                          placeholder="Ex: Digite aqui sua resposta..."
                          className="h-8 text-xs"
                        />
                      </div>
                    )}

                    {campo.tipo === 'selecao' && (
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-[11px] text-muted-foreground">Opções do Menu (separadas por vírgula)</Label>
                          <span className="text-[10px] text-muted-foreground">Ex: Opção A, Opção B, Opção C</span>
                        </div>
                        <Input
                          value={campo.opcoes.join(', ')}
                          onChange={(e) =>
                            atualizarCampo(campo.localId, {
                              opcoes: e.target.value.split(',').map((o) => o.trim()).filter(Boolean),
                            })
                          }
                          placeholder="Opção 1, Opção 2, Opção 3"
                          className="h-8 text-xs"
                        />

                        {/* Interactive Chips Preview */}
                        {campo.opcoes.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {campo.opcoes.map((opt, optIdx) => (
                              <Badge key={optIdx} variant="secondary" className="gap-1 text-[11px] py-0.5 bg-muted">
                                <Tag className="h-3 w-3 text-muted-foreground" />
                                {opt}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const novasOpcoes = campo.opcoes.filter((_, idx) => idx !== optIdx)
                                    atualizarCampo(campo.localId, { opcoes: novasOpcoes })
                                  }}
                                  className="hover:text-destructive ml-1"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* TAB 2: CONFIGURAÇÕES GERAIS */}
        {activeTab === 'config' && (
          <div className="space-y-5">
            {/* Title & Slug */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="formulario-titulo" className="text-xs font-semibold">
                  Título do Formulário <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="formulario-titulo"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  required
                  placeholder="Ex: Solicitação de Suporte TI"
                  className="h-9"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="formulario-slug" className="text-xs font-semibold">
                  Identificador na URL (Slug) <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="formulario-slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                    required
                    placeholder="suporte-ti"
                    className="h-9 pl-7 font-mono text-xs"
                  />
                  <Link2 className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
                </div>
              </div>
            </div>

            {/* Live URL Banner */}
            <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-center gap-2 text-xs">
              <Link2 className="h-4 w-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0 font-mono text-muted-foreground truncate">
                Link Público: <span className="text-foreground font-semibold">{fullUrl}</span>
              </div>
              <Button
                type="button"
                size="xs"
                variant="outline"
                className="gap-1 shrink-0 text-[11px]"
                onClick={() => {
                  navigator.clipboard.writeText(fullUrl)
                  toast.success('Link copiado!')
                }}
              >
                Copiar Link
              </Button>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="formulario-descricao" className="text-xs font-semibold">
                Descrição pública (opcional)
              </Label>
              <Textarea
                id="formulario-descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={2}
                placeholder="Explique ao visitante como preencher ou qual o objetivo desta solicitação..."
                className="text-xs"
              />
            </div>

            {/* Destination Column & Success Message */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">
                  Coluna de Destino no Kanban <span className="text-destructive">*</span>
                </Label>
                <Select value={colunaId} onValueChange={(v) => setColunaId(v ?? '')}>
                  <SelectTrigger className="h-9 w-full text-xs">
                    <SelectValue placeholder="Selecione a coluna...">
                      {colunaSelecionada ? (
                        <span className="font-medium">{colunaSelecionada.nome}</span>
                      ) : (
                        'Selecione uma coluna'
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {colunas.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Cards criados por este formulário cairão nesta coluna automaticamente.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="formulario-mensagem" className="text-xs font-semibold">
                  Mensagem de Sucesso <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="formulario-mensagem"
                  value={mensagemSucesso}
                  onChange={(e) => setMensagemSucesso(e.target.value)}
                  required
                  placeholder="Recebemos sua solicitação!"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Theme Color Picker */}
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-muted-foreground" />
                <Label className="text-xs font-semibold">Cor de Destaque / Tema</Label>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {PALETA_CORES.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setCorTema(c.hex)}
                    className="flex items-center gap-1.5 rounded-lg border border-border p-1.5 text-xs font-medium hover:scale-105 transition-transform"
                    style={{ backgroundColor: corTema === c.hex ? `${c.hex}15` : 'transparent' }}
                  >
                    <span className="h-5 w-5 rounded-full border border-black/10 shadow-xs flex items-center justify-center" style={{ backgroundColor: c.hex }}>
                      {corTema === c.hex && <Check className="h-3 w-3 text-white" />}
                    </span>
                    <span className="pr-1 text-muted-foreground">{c.nome}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PRÉ-VISUALIZAÇÃO AO VIVO */}
        {activeTab === 'preview' && (
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <span className="text-xs text-muted-foreground">Visualização aproximada de como o visitante verá o formulário público:</span>
            </div>

            {/* Form Outer Card Demo */}
            <div className="max-w-md mx-auto rounded-2xl border border-border bg-card shadow-xl overflow-hidden">
              {/* Colored Top Header Bar */}
              <div className="h-3 w-full" style={{ backgroundColor: corTema }} />

              <div className="p-6 space-y-5">
                {/* Form Title & Description */}
                <div className="space-y-1 text-center">
                  <h2 className="text-xl font-bold text-foreground">{titulo || 'Título do Formulário'}</h2>
                  {descricao && <p className="text-xs text-muted-foreground">{descricao}</p>}
                </div>

                {/* Form Fields Demo */}
                <div className="space-y-4">
                  {campos.map((c, i) => (
                    <div key={i} className="space-y-1.5 text-left">
                      <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                        {c.rotulo || 'Pergunta sem título'}
                        {c.obrigatorio && <span className="text-destructive">*</span>}
                      </label>

                      {c.tipo === 'texto' && (
                        <Input disabled placeholder={c.placeholder || 'Preencha aqui...'} className="h-9 text-xs bg-muted/20" />
                      )}

                      {c.tipo === 'texto_longo' && (
                        <Textarea disabled placeholder={c.placeholder || 'Digite os detalhes...'} rows={2} className="text-xs bg-muted/20" />
                      )}

                      {c.tipo === 'selecao' && (
                        <Select disabled>
                          <SelectTrigger className="h-9 w-full text-xs bg-muted/20">
                            <SelectValue placeholder="Selecione uma opção..." />
                          </SelectTrigger>
                        </Select>
                      )}

                      {c.tipo === 'data' && (
                        <Input type="date" disabled className="h-9 text-xs bg-muted/20" />
                      )}

                      {c.tipo === 'prioridade' && (
                        <Select disabled>
                          <SelectTrigger className="h-9 w-full text-xs bg-muted/20">
                            <SelectValue placeholder="Selecione o nível de urgência..." />
                          </SelectTrigger>
                        </Select>
                      )}
                    </div>
                  ))}
                </div>

                {/* Submit Button Demo */}
                <button
                  type="button"
                  disabled
                  className="w-full py-2.5 rounded-xl font-semibold text-xs text-white shadow-md transition-opacity opacity-90"
                  style={{ backgroundColor: corTema }}
                >
                  Enviar Solicitação
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dialog Footer Actions */}
      <div className="p-4 border-t border-border bg-card/60 flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          {colunaSelecionada ? (
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              Destino: <strong className="text-foreground">{colunaSelecionada.nome}</strong>
            </span>
          ) : (
            <span className="text-amber-500 font-medium">Selecione uma coluna nas configurações</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={isPending}
            className="gap-2 font-semibold shadow-xs"
            style={{ backgroundColor: corTema }}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : formulario ? 'Salvar Alterações' : 'Criar Formulário'}
          </Button>
        </div>
      </div>
    </form>
  )
}
