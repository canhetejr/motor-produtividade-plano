'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createApontamento } from './actions'
import { enfileirarApontamento } from '@/components/offline/fila-apontamentos'
import { updateApontamento } from './historico/actions'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { PlusCircle, Loader2, Minus, Plus, Briefcase, Target, AlignLeft, Clock, ListChecks, ArrowUpRight } from 'lucide-react'
import { MOTIVOS_OUTROS } from '@/lib/motivos-outros'
import { formatarTempo, parseTempo } from '@/lib/tempo'

type Demanda = {
  id: string
  nome: string
  variavel: boolean
  tempo_padrao_min: number | null
  blocos_totais: number
  finita?: boolean
  blocos_restantes?: number | null
}

function tempoLabel(d: Demanda) {
  if (!d.tempo_padrao_min) return null
  return d.blocos_totais > 1
    ? `${formatarTempo(Math.round(d.tempo_padrao_min / d.blocos_totais))}/bloco`
    : formatarTempo(d.tempo_padrao_min)
}

type InitialValues = {
  demanda_id: string
  quantidade: number
  tempo_manual_min: number | null
  motivo: string | null
  observacoes: string | null
}

export function ApontamentoForm({
  demandas,
  cargaHorariaMin,
  tempoEntregueHoje = 0,
  apontamentoId,
  initialValues,
  onSaved,
  usuarioId,
}: {
  demandas: Demanda[]
  cargaHorariaMin: number
  tempoEntregueHoje?: number
  apontamentoId?: string
  initialValues?: InitialValues
  onSaved?: () => void
  /** Dono da fila offline. Ausente na edição, que não é enfileirável. */
  usuarioId?: string
}) {
  const isEdit = !!apontamentoId
  const router = useRouter()
  const [selectedDemanda, setSelectedDemanda] = useState<Demanda | null>(() =>
    initialValues ? demandas.find((d) => d.id === initialValues.demanda_id) ?? null : null
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [quantidade, setQuantidade] = useState<number | string>(initialValues?.quantidade ?? 1)
  const [tempoManual, setTempoManual] = useState<string>(() =>
    initialValues?.tempo_manual_min ? formatarTempo(initialValues.tempo_manual_min) : ''
  )
  const [motivo, setMotivo] = useState<string>(initialValues?.motivo ?? '')

  const handleDemandaChange = (val: string | null) => {
    setMotivo('')
    setQuantidade(1)
    setTempoManual('')
    if (!val) {
      setSelectedDemanda(null)
      return
    }
    const found = demandas.find(d => d.id === val) || null
    setSelectedDemanda(found)
  }

  const maxBlocos =
    selectedDemanda && !selectedDemanda.variavel && selectedDemanda.blocos_totais > 1
      ? selectedDemanda.finita
        ? (selectedDemanda.blocos_restantes ?? selectedDemanda.blocos_totais)
        : selectedDemanda.blocos_totais
      : null

  const quantidadeNum = typeof quantidade === 'number' ? quantidade : Number(quantidade) || 0
  const atMax = maxBlocos !== null && quantidadeNum >= maxBlocos

  const tempoPreview = (() => {
    if (!selectedDemanda) return null
    if (selectedDemanda.variavel) {
      const t = parseTempo(tempoManual)
      return t && t > 0 ? t : null
    }
    if (!selectedDemanda.tempo_padrao_min || quantidadeNum <= 0) return null
    return Math.round(
      (selectedDemanda.tempo_padrao_min * quantidadeNum) / Math.max(selectedDemanda.blocos_totais, 1)
    )
  })()

  const pctMeta =
    tempoPreview !== null && cargaHorariaMin > 0
      ? Math.round(((tempoEntregueHoje + tempoPreview) / cargaHorariaMin) * 100)
      : null

  const handleQuantidadeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuantidade(val === '' ? '' : Number(val))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    const formData = new FormData(e.currentTarget)

    let result: Awaited<ReturnType<typeof createApontamento>>
    try {
      result = apontamentoId
        ? await updateApontamento(apontamentoId, formData)
        : await createApontamento(formData)
    } catch {
      setIsSubmitting(false)
      // Server Action que estoura sem resposta é, na prática, falta de rede.
      // Só o registro novo entra na fila: editar exige o estado atual do
      // servidor, que offline não se tem.
      if (!apontamentoId && usuarioId) {
        const campos: Record<string, string> = {}
        for (const [chave, valor] of formData.entries()) {
          if (typeof valor === 'string') campos[chave] = valor
        }
        enfileirarApontamento(usuarioId, campos)
        toast.success('Sem conexão — o apontamento sai assim que a rede voltar.')
        router.push('/apontamento/historico')
        return
      }
      toast.error('Sem conexão. Tente de novo quando a rede voltar.')
      return
    }

    setIsSubmitting(false)
    if (result.ok) {
      if (isEdit) {
        toast.success('Apontamento atualizado!')
        onSaved?.()
      } else {
        toast.success('Apontamento registrado!')
        router.push('/apontamento/historico')
      }
    } else {
      toast.error(result.error)
    }
  }

  const fieldClass = 'bg-secondary/50 hover:bg-secondary border-border transition-colors focus:border-primary focus:ring-1 focus:ring-primary rounded-lg text-xs'

  return (
    <div className="bg-card border border-border shadow-xs rounded-xl p-5 sm:p-6 relative overflow-hidden">
      {/* Header Form */}
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
        <div className="h-9 w-9 bg-primary/10 text-primary border border-primary/20 rounded-lg flex items-center justify-center font-bold shrink-0">
          <PlusCircle className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
            {isEdit ? 'Editar Apontamento' : 'Novo Apontamento'}
          </h2>
          <p className="text-xs text-muted-foreground">Preencha os dados da atividade realizada</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Select Demanda */}
        <div className="space-y-1.5">
          <Label htmlFor="demanda_id" className="text-xs font-semibold flex items-center gap-2 text-foreground">
            <Briefcase className="h-3.5 w-3.5 text-primary" /> Demanda Realizada
          </Label>
          <Select
            name="demanda_id"
            defaultValue={initialValues?.demanda_id}
            onValueChange={handleDemandaChange}
            required
          >
            <SelectTrigger id="demanda_id" className={`h-10 ${fieldClass}`}>
              <SelectValue placeholder="Selecione a demanda">
                {selectedDemanda ? (
                  <span className="flex items-center gap-2 text-xs truncate">
                    <span className="font-medium truncate">{selectedDemanda.nome}</span>
                    {tempoLabel(selectedDemanda) && (
                      <span className="text-primary text-[10px] font-bold uppercase bg-primary/10 px-1.5 py-0.5 rounded shrink-0 border border-primary/20">
                        {tempoLabel(selectedDemanda)}
                      </span>
                    )}
                  </span>
                ) : 'Selecione a demanda'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="rounded-lg max-h-60">
              {demandas.length === 0 && (
                <SelectItem value="none" disabled>Nenhuma demanda disponível</SelectItem>
              )}
              {demandas.map(d => (
                <SelectItem key={d.id} value={d.id} className="cursor-pointer py-2 rounded-md text-xs">
                  <div className="flex items-center justify-between w-full pr-2 gap-2">
                    <span className="font-medium truncate">{d.nome}</span>
                    <span className="flex items-center gap-1 shrink-0">
                      {tempoLabel(d) && (
                        <span className="text-[10px] font-semibold text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{tempoLabel(d)}</span>
                      )}
                      {d.finita && d.blocos_restantes != null && (
                        <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                          {d.blocos_restantes} rest.
                        </span>
                      )}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Quantidade e Tempo Manual */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="quantidade" className="text-xs font-semibold flex items-center gap-2 text-foreground">
              <Target className="h-3.5 w-3.5 text-primary" />
              {selectedDemanda?.blocos_totais && selectedDemanda.blocos_totais > 1
                ? `Blocos (de ${selectedDemanda.blocos_totais})`
                : 'Quantidade'}
            </Label>
            <div className="flex h-10 rounded-lg border border-border bg-secondary/50 overflow-hidden focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-colors">
              <button
                type="button"
                aria-label="Diminuir quantidade"
                onClick={() => setQuantidade(q => typeof q === 'number' ? Math.max(1, q - 1) : 1)}
                className="w-10 h-full flex items-center justify-center hover:bg-secondary border-r border-border text-muted-foreground hover:text-foreground transition-colors"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <input
                type="number"
                name="quantidade"
                id="quantidade"
                value={quantidade}
                onChange={handleQuantidadeChange}
                className="flex-1 w-full bg-transparent text-center text-xs sm:text-sm font-bold text-foreground focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                min="0.01"
                max={maxBlocos ?? undefined}
                step="0.01"
                required
              />
              <button
                type="button"
                aria-label="Aumentar quantidade"
                disabled={atMax}
                onClick={() => setQuantidade(q => {
                  const next = typeof q === 'number' ? q + 1 : 1
                  return maxBlocos ? Math.min(maxBlocos, next) : next
                })}
                className="w-10 h-full flex items-center justify-center hover:bg-secondary border-l border-border text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            {maxBlocos !== null && (
              <p className={`text-[10px] ${atMax ? 'text-amber-500 font-medium' : 'text-muted-foreground'}`}>
                {selectedDemanda?.finita
                  ? `${maxBlocos} blocos restantes (área).`
                  : `Até ${maxBlocos} blocos.`}
              </p>
            )}
          </div>

          {selectedDemanda?.variavel && (
            <div className="space-y-1.5">
              <Label htmlFor="tempo_manual_min" className="text-xs font-semibold flex items-center gap-2 text-foreground">
                <Clock className="h-3.5 w-3.5 text-primary" /> Tempo (hh:mm ou min)
              </Label>
              <Input
                id="tempo_manual_min"
                name="tempo_manual_min"
                type="text"
                value={tempoManual}
                onChange={(e) => setTempoManual(e.target.value)}
                required={selectedDemanda.variavel}
                className={`h-10 ${fieldClass} font-bold text-center`}
                placeholder="Ex: 01:30 ou 45"
              />
            </div>
          )}
        </div>

        {/* Live Preview Box - Solid colors */}
        {tempoPreview !== null && (
          <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-semibold text-foreground">
                <Clock className="h-3.5 w-3.5 text-primary" />
                Tempo estimado:
              </span>
              <span className="font-bold text-primary text-xs bg-primary/20 px-2 py-0.5 rounded border border-primary/30">
                +{formatarTempo(tempoPreview)}
              </span>
            </div>

            {pctMeta !== null && (
              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-primary/20">
                <span>Progresso após este envio:</span>
                <strong className="text-foreground flex items-center gap-1 font-bold">
                  <span>{pctMeta}%</span>
                  <ArrowUpRight className="w-3 h-3 text-emerald-500" />
                </strong>
              </div>
            )}
          </div>
        )}

        {selectedDemanda?.variavel && (
          <div className="space-y-1.5">
            <Label htmlFor="motivo" className="text-xs font-semibold flex items-center gap-2 text-foreground">
              <ListChecks className="h-3.5 w-3.5 text-primary" /> Motivo
            </Label>
            <Select name="motivo" value={motivo} onValueChange={(val) => setMotivo(val || '')} required>
              <SelectTrigger id="motivo" className={`h-10 ${fieldClass}`}>
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent className="rounded-lg">
                {MOTIVOS_OUTROS.map((m) => (
                  <SelectItem key={m} value={m} className="cursor-pointer py-1.5 text-xs">
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Observações */}
        <div className="space-y-1.5">
          <Label htmlFor="observacoes" className="text-xs font-semibold flex items-center gap-2 text-foreground">
            <AlignLeft className="h-3.5 w-3.5 text-primary" />
            Observações{' '}
            {motivo === 'Outro' ? (
              <span className="text-primary font-normal ml-1">(descreva o motivo)</span>
            ) : (
              <span className="text-muted-foreground font-normal ml-1">(opcional)</span>
            )}
          </Label>
          <Textarea
            id="observacoes"
            name="observacoes"
            required={motivo === 'Outro'}
            defaultValue={initialValues?.observacoes ?? ''}
            placeholder="Detalhes adicionais da tarefa..."
            className={`resize-none min-h-[80px] ${fieldClass} leading-relaxed`}
          />
        </div>

        {/* Submit Button - Solid Primary Color */}
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-11 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg shadow-xs transition-colors cursor-pointer mt-2"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {isEdit ? 'Salvando...' : 'Registrando...'}
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              {isEdit ? 'Salvar Alterações' : 'Registrar Apontamento'}
              <PlusCircle className="h-4 w-4" />
            </span>
          )}
        </Button>
      </form>
    </div>
  )
}
