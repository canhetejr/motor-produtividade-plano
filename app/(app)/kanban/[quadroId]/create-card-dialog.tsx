'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { criarCartao } from '../actions'
import { listarTemplates, type Template } from '../actions-templates'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
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
import { Loader2, Users, Plus, X } from 'lucide-react'
import type { MembroQuadro, MembroNaoAutorizado, DemandaOpcao } from './types'

function getInitials(name: string) {
  return name.trim().split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

export function CreateCardDialog({
  colunaId,
  quadroId,
  membros,
  membrosNaoAutorizados,
  demandas,
  onClose,
}: {
  colunaId: string | null
  quadroId: string
  membros: MembroQuadro[]
  membrosNaoAutorizados: MembroNaoAutorizado[]
  demandas: DemandaOpcao[]
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
      <DialogContent className="sm:max-w-md">
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
            <Label>Demanda</Label>
            <SeletorDemanda demandas={demandas} valor={demandaId} onChange={setDemandaId} />
            <p className="text-xs text-muted-foreground">
              É onde o tempo cronometrado neste card entra no índice de produtividade.
            </p>
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
                    <div className="h-6 w-6 rounded-full bg-primary/20 text-primary border border-primary/30 font-bold flex items-center justify-center text-[10px] shrink-0 shadow-xs">
                      {getInitials(m.nome)}
                    </div>
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
                              <div
                                className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                  isSelected
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-secondary border border-border text-muted-foreground'
                                }`}
                              >
                                {getInitials(m.nome)}
                              </div>
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
