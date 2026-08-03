'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { criarCartao } from '../actions'
import { listarTemplates, type Template } from '../actions-templates'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RichTextEditorLazy as RichTextEditor } from '@/components/ui/rich-text-editor-lazy'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, Users, Plus, X, Clock3, Boxes, CircleGauge, FileText } from 'lucide-react'
import type { MembroQuadro, MembroNaoAutorizado, DemandaOpcao } from './types'


export function CreateCardDialog({
  colunaId,
  quadroId,
  membros,
  membrosNaoAutorizados,
  demandas,
  slaHoras,
  onClose,
}: {
  colunaId: string | null
  quadroId: string
  membros: MembroQuadro[]
  membrosNaoAutorizados: MembroNaoAutorizado[]
  demandas: DemandaOpcao[]
  slaHoras: number | null
  onClose: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [prioridade, setPrioridade] = useState('media')
  const [demandaId, setDemandaId] = useState('')
  const [responsaveis, setResponsaveis] = useState<string[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  // A `key` remonta o formulário quando um modelo é aplicado: título e descrição
  // são não controlados (defaultValue / RichTextEditor), e sem remontar eles
  // manteriam o que já estava digitado.
  const [aplicado, setAplicado] = useState<Template | null>(null)
  const [versaoForm, setVersaoForm] = useState(0)
  const demandaSelecionada = demandas.find((d) => d.id === demandaId) ?? null

  useEffect(() => {
    if (!colunaId) return
    listarTemplates(quadroId).then((r) => {
      if (r.ok) setTemplates(r.data ?? [])
    })
  }, [colunaId, quadroId])

  function aplicarTemplate(id: string) {
    const t = templates.find((x) => x.id === id) ?? null
    setAplicado(t)
    if (t) setPrioridade(t.prioridade)
    setVersaoForm((v) => v + 1)
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      onClose()
      setPrioridade('media')
      setDemandaId('')
      setResponsaveis([])
      setAplicado(null)
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!colunaId) return
    const formData = new FormData(e.currentTarget)
    formData.set('prioridade', prioridade)
    if (demandaId) formData.set('demandaId', demandaId)
    responsaveis.forEach((id) => formData.append('responsaveis', id))
    startTransition(async () => {
      const result = await criarCartao(colunaId, quadroId, formData)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Card criado!')
      handleOpenChange(false)
    })
  }

  return (
    <Dialog open={!!colunaId} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo Card</DialogTitle>
        </DialogHeader>
        <form key={versaoForm} onSubmit={handleSubmit} className="space-y-5 py-2">
          {templates.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="novo-card-modelo">Começar de um modelo</Label>
              <select
                id="novo-card-modelo"
                value={aplicado?.id ?? ''}
                onChange={(e) => aplicarTemplate(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring dark:bg-input/30"
              >
                <option value="">Em branco</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid gap-5 md:grid-cols-[1.15fr_.85fr]">
          <div className="space-y-2">
            <Label htmlFor="novo-card-titulo">Título</Label>
            <Input
              id="novo-card-titulo"
              name="titulo"
              autoFocus
              required
              defaultValue={aplicado?.titulo ?? ''}
              placeholder="Ex: Revisar orçamento"
            />
          </div>
          <div className="space-y-2">
            <Label>Demanda vinculada</Label>
            <SeletorDemanda demandas={demandas} valor={demandaId} onChange={setDemandaId} />
          </div>
          </div>
          {demandaSelecionada ? (
            <div className="grid gap-3 border border-primary/25 bg-primary/5 p-4 sm:grid-cols-3">
              <div className="flex gap-2"><Clock3 className="mt-0.5 size-4 text-primary" /><div><p className="text-xs text-muted-foreground">Tempo padrão</p><p className="text-sm font-semibold">{demandaSelecionada.tempoPadraoMin ? `${demandaSelecionada.tempoPadraoMin} min` : 'A definir'}</p></div></div>
              <div className="flex gap-2"><Boxes className="mt-0.5 size-4 text-primary" /><div><p className="text-xs text-muted-foreground">Escopo</p><p className="text-sm font-semibold">{demandaSelecionada.blocosTotais} {demandaSelecionada.blocosTotais === 1 ? 'bloco' : 'blocos'}{demandaSelecionada.finita ? ' · finito' : ''}</p></div></div>
              <div className="flex gap-2"><CircleGauge className="mt-0.5 size-4 text-primary" /><div><p className="text-xs text-muted-foreground">SLA desta etapa</p><p className="text-sm font-semibold">{slaHoras ? `até ${slaHoras}h` : 'Sem limite'}</p></div></div>
            </div>
          ) : <div className="flex gap-2 border border-dashed border-border p-3 text-xs text-muted-foreground"><FileText className="size-4 shrink-0" />Selecione uma demanda da sua área para visualizar tempo, escopo e SLA.</div>}
          <div className="space-y-2">
            <Label>Descrição (opcional)</Label>
            <RichTextEditor
              name="descricao"
              minHeight="min-h-24"
              placeholder="Detalhe a tarefa..."
              conteudoInicial={aplicado?.descricao ?? undefined}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={(value) => setPrioridade(value ?? 'media')}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="novo-card-prazo">Prazo (opcional)</Label>
              <Input id="novo-card-prazo" name="prazo" type="date" />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" /> Responsáveis
            </Label>
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
                      onClick={() => setResponsaveis((prev) => prev.filter((id) => id !== m.id))}
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
                            onClick={() =>
                              setResponsaveis((prev) =>
                                isSelected ? prev.filter((id) => id !== m.id) : [...prev, m.id]
                              )
                            }
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
              <p className="text-xs text-muted-foreground">
                Não autorizados: {membrosNaoAutorizados.map((m) => m.nome).join(', ')}
              </p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar Card'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Seletor de demanda agrupado por área. Compartilhado entre o dialog de
 * criação e a sidebar do card — é o campo que liga o Kanban ao catálogo e,
 * por consequência, ao índice de produtividade.
 */
export function SeletorDemanda({
  demandas,
  valor,
  onChange,
  className,
}: {
  demandas: DemandaOpcao[]
  valor: string
  onChange: (id: string) => void
  className?: string
}) {
  const porArea = new Map<string, DemandaOpcao[]>()
  for (const d of demandas) {
    const lista = porArea.get(d.areaNome) ?? []
    lista.push(d)
    porArea.set(d.areaNome, lista)
  }

  return (
    <Select value={valor} onValueChange={(v) => onChange(v ?? '')}>
      <SelectTrigger className={className ?? 'w-full'}>
        <SelectValue placeholder="Sem demanda">
          {(v: string) => demandas.find((d) => d.id === v)?.nome ?? 'Sem demanda'}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {[...porArea.entries()].map(([area, itens]) => (
          <SelectGroup key={area}>
            <SelectLabel>{area}</SelectLabel>
            {itens.map((d) => (
              <SelectItem key={d.id} value={d.id} className="cursor-pointer text-xs">
                {d.nome}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}
