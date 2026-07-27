'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { createApontamento } from './actions'
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
import { PlusCircle, Loader2, Minus, Plus, Briefcase, Target, AlignLeft, Clock, ListChecks } from 'lucide-react'
import { MOTIVOS_OUTROS } from '@/lib/motivos-outros'
import { formatarTempo, parseTempo } from '@/lib/tempo'

type Demanda = {
  id: string
  nome: string
  variavel: boolean
  tempo_padrao_min: number | null
  blocos_totais: number
  // Bloco finito (teto GLOBAL, somando todos os colaboradores) — opcionais
  // porque nem todo caller (ex.: o dialog de edição do histórico) busca o
  // acumulado; sem eles, o form volta a tratar como demanda comum (o RPC no
  // banco continua sendo a fonte de verdade de qualquer forma).
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
}: {
  demandas: Demanda[]
  cargaHorariaMin: number
  // Soma do que já foi lançado hoje (mesmo total do DailyProgressBlocks, ao
  // lado) — o preview passa a mostrar "já lançado + este lançamento", não só
  // este lançamento isolado.
  tempoEntregueHoje?: number
  // Presença de apontamentoId liga o modo edição: chama updateApontamento
  // (RPC atualizar_apontamento) em vez de createApontamento, e não navega
  // pro histórico ao salvar — quem usa o form em modo edição (o dialog do
  // histórico) decide o que fazer via onSaved.
  apontamentoId?: string
  initialValues?: InitialValues
  onSaved?: () => void
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
    // Zera quantidade e tempo manual pra não carregar valores da demanda
    // anterior (ex.: vinha com 6 e a nova demanda só tem 4 blocos).
    setQuantidade(1)
    setTempoManual('')
    if (!val) {
      setSelectedDemanda(null)
      return
    }
    const found = demandas.find(d => d.id === val) || null
    setSelectedDemanda(found)
  }

  // Teto de blocos: só existe para demanda fixa dividida em blocos. Demanda
  // comum (1 bloco) ou variável seguem sem limite (quantidade = repetições).
  // Bloco finito usa o restante GLOBAL (já descontado o que outros
  // colaboradores lançaram), não o blocos_totais bruto da demanda.
  const maxBlocos =
    selectedDemanda && !selectedDemanda.variavel && selectedDemanda.blocos_totais > 1
      ? selectedDemanda.finita
        ? (selectedDemanda.blocos_restantes ?? selectedDemanda.blocos_totais)
        : selectedDemanda.blocos_totais
      : null

  const quantidadeNum = typeof quantidade === 'number' ? quantidade : Number(quantidade) || 0
  const atMax = maxBlocos !== null && quantidadeNum >= maxBlocos

  // Preview do tempo que este lançamento vai valer — mesma conta da view
  // apontamentos_calculado, pra não haver surpresa depois de salvar. Variável
  // usa o tempo manual digitado; fixa usa tempo padrão * blocos.
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

    const result = apontamentoId
      ? await updateApontamento(apontamentoId, formData)
      : await createApontamento(formData)

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

  const fieldClass = 'bg-secondary/40 hover:bg-secondary/80 border-input transition-colors focus:border-primary'

  return (
    <div className="bg-card border border-border shadow-xs rounded-none p-6 relative">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
        <div className="h-9 w-9 bg-primary/10 text-primary border border-primary/20 rounded-none flex items-center justify-center font-bold">
          <PlusCircle className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground">
            {isEdit ? 'Editar Apontamento' : 'Novo Apontamento'}
          </h2>
          <p className="text-xs text-muted-foreground">Preencha os dados da atividade</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="demanda_id" className="text-xs font-semibold flex items-center gap-2 text-foreground">
            <Briefcase className="h-3.5 w-3.5 text-primary" /> Demanda Realizada
          </Label>
          <Select
            name="demanda_id"
            defaultValue={initialValues?.demanda_id}
            onValueChange={handleDemandaChange}
            required
          >
            <SelectTrigger id="demanda_id" className={`h-10 ${fieldClass} rounded-none`}>
              <SelectValue placeholder="Selecione a demanda">
                {selectedDemanda ? (
                  <span className="flex items-center gap-2 text-xs">
                    <span className="font-medium">{selectedDemanda.nome}</span>
                    {tempoLabel(selectedDemanda) && (
                      <span className="text-primary text-[10px] font-bold uppercase bg-primary/10 px-1.5 py-0.5 rounded-none">
                        {tempoLabel(selectedDemanda)}
                      </span>
                    )}
                  </span>
                ) : 'Selecione a demanda'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="rounded-none">
              {demandas.length === 0 && (
                <SelectItem value="none" disabled>Nenhuma demanda para sua área</SelectItem>
              )}
              {demandas.map(d => (
                <SelectItem key={d.id} value={d.id} className="cursor-pointer py-2 rounded-none text-xs">
                  <div className="flex items-center justify-between w-full pr-2 gap-2">
                    <span className="font-medium">{d.nome}</span>
                    <span className="flex items-center gap-1 shrink-0">
                      {tempoLabel(d) && (
                        <span className="text-[10px] font-semibold text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-none">{tempoLabel(d)}</span>
                      )}
                      {d.finita && d.blocos_restantes != null && (
                        <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-none">
                          {d.blocos_restantes} restantes
                        </span>
                      )}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="quantidade" className="text-xs font-semibold flex items-center gap-2 text-foreground">
              <Target className="h-3.5 w-3.5 text-primary" />
              {selectedDemanda?.blocos_totais && selectedDemanda.blocos_totais > 1
                ? `Blocos (de ${selectedDemanda.blocos_totais})`
                : 'Quantidade'}
            </Label>
            <div className="flex h-10 rounded-none border border-input bg-secondary/40 overflow-hidden focus-within:border-primary">
              <button
                type="button"
                aria-label="Diminuir quantidade"
                onClick={() => setQuantidade(q => typeof q === 'number' ? Math.max(1, q - 1) : 1)}
                className="w-10 h-full flex items-center justify-center hover:bg-secondary border-r border-border text-muted-foreground hover:text-foreground"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <input
                type="number"
                name="quantidade"
                id="quantidade"
                value={quantidade}
                onChange={handleQuantidadeChange}
                className="flex-1 w-full bg-transparent text-center text-sm font-bold text-foreground focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                className="w-10 h-full flex items-center justify-center hover:bg-secondary border-l border-border text-muted-foreground hover:text-foreground disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            {maxBlocos !== null && (
              <p className={`text-[11px] ${atMax ? 'text-amber-600 dark:text-amber-500 font-medium' : 'text-muted-foreground'}`}>
                {selectedDemanda?.finita
                  ? atMax
                    ? `Máximo de ${maxBlocos} blocos restantes (entre todos os colaboradores).`
                    : `${maxBlocos} blocos restantes no total (entre todos os colaboradores).`
                  : atMax
                    ? `Máximo de ${maxBlocos} blocos.`
                    : `Até ${maxBlocos} blocos (demanda inteira).`}
              </p>
            )}
          </div>

          {selectedDemanda?.variavel && (
            <div className="space-y-2">
              <Label htmlFor="tempo_manual_min" className="text-xs font-semibold flex items-center gap-2 text-foreground">
                <Clock className="h-3.5 w-3.5 text-primary" /> Tempo Gasto (horas ou min)
              </Label>
              <Input
                id="tempo_manual_min"
                name="tempo_manual_min"
                type="text"
                value={tempoManual}
                onChange={(e) => setTempoManual(e.target.value)}
                required={selectedDemanda.variavel}
                className={`h-10 ${fieldClass} rounded-none text-sm font-bold text-center px-3`}
                placeholder="Ex: 01:30 ou 45"
              />
            </div>
          )}
        </div>

        {tempoPreview !== null && (
          <div className="flex items-center gap-2.5 rounded-none border border-primary/30 bg-primary/5 px-3 py-2.5">
            <div className="h-7 w-7 shrink-0 rounded-none bg-primary/10 flex items-center justify-center text-primary">
              <Clock className="h-4 w-4" />
            </div>
            <div className="text-xs">
              <p className="font-semibold text-foreground">Equivale a ~{formatarTempo(tempoPreview)}</p>
              {pctMeta !== null && (
                <p className="text-muted-foreground text-[11px]">
                  Com este lançamento: {pctMeta}% da meta diária ({formatarTempo(cargaHorariaMin)})
                </p>
              )}
            </div>
          </div>
        )}

        {selectedDemanda?.variavel && (
          <div className="space-y-2">
            <Label htmlFor="motivo" className="text-xs font-semibold flex items-center gap-2 text-foreground">
              <ListChecks className="h-3.5 w-3.5 text-primary" /> Motivo
            </Label>
            <Select name="motivo" value={motivo} onValueChange={(val) => setMotivo(val || '')} required>
              <SelectTrigger id="motivo" className={`h-10 ${fieldClass} rounded-none text-xs`}>
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent className="rounded-none">
                {MOTIVOS_OUTROS.map((m) => (
                  <SelectItem key={m} value={m} className="cursor-pointer py-2 rounded-none text-xs">
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
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
            placeholder="Detalhes adicionais..."
            className={`resize-none min-h-[90px] ${fieldClass} rounded-none px-3 py-2 text-xs leading-relaxed`}
          />
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-11 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-none shadow-xs"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {isEdit ? 'Salvando...' : 'Registrando...'}
            </span>
          ) : (
            <span className="flex items-center gap-2">
              {isEdit ? 'Salvar Alterações' : 'Registrar Apontamento'}
              <PlusCircle className="h-4 w-4" />
            </span>
          )}
        </Button>
      </form>
    </div>
  )
}
