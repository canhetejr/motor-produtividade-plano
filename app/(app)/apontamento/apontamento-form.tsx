'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Minus, Plus } from 'lucide-react'
import { createApontamento } from './actions'
import { enfileirarApontamento } from '@/components/offline/fila-apontamentos'
import { Cronometro } from '@/components/apontamento/cronometro'
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
  aoRegistrar,
  usuarioId,
  compacto = false,
  catalogoHref,
  catalogoLabel,
}: {
  demandas: Demanda[]
  cargaHorariaMin: number
  tempoEntregueHoje?: number
  apontamentoId?: string
  initialValues?: InitialValues
  onSaved?: () => void
  /** Chamado no lugar de ir para o histórico depois de registrar. Existe para
   *  o diálogo de lançamento poder fechar e recarregar a tela onde ele está. */
  aoRegistrar?: () => void
  /** Dono da fila offline. Ausente na edição, que não é enfileirável. */
  usuarioId?: string
  /** Variante sóbria para a tela principal de apontamentos. */
  compacto?: boolean
  catalogoHref?: string
  catalogoLabel?: string
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
        if (aoRegistrar) aoRegistrar()
        else router.push('/apontamento/historico')
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
        if (aoRegistrar) aoRegistrar()
        else router.push('/apontamento/historico')
      }
    } else {
      toast.error(result.error)
    }
  }

  const fieldClass = 'rounded-sm border-border bg-secondary/50 text-xs focus:border-primary focus:ring-1 focus:ring-primary'

  return (
    <div className="relative overflow-hidden rounded-md border border-border bg-card p-5 shadow-xs sm:p-6">
      <div className="mb-6 border-b border-border pb-4">
        <p className="font-mono text-3xs uppercase tracking-[0.14em] text-primary">Lançamento</p>
        <h2 className="mt-1 text-lg font-medium tracking-tight text-foreground">
          {isEdit ? 'Editar apontamento' : 'Registrar atividade'}
        </h2>
        {!compacto && <p className="mt-1 text-xs text-muted-foreground">Preencha os dados da atividade realizada.</p>}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Select Demanda */}
        <div className="space-y-1.5">
          <Label htmlFor="demanda_id" className="font-mono text-3xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
            Demanda
          </Label>
          <Select
            name="demanda_id"
            defaultValue={initialValues?.demanda_id}
            onValueChange={handleDemandaChange}
            required
          >
            <SelectTrigger id="demanda_id" className={`h-10 transition-none ${fieldClass}`}>
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
          {!isEdit && catalogoHref && (
            <p className="text-2xs text-muted-foreground">
              Não encontrou a demanda?{' '}
              <Link href={catalogoHref} className="font-medium text-primary hover:underline">
                {catalogoLabel ?? 'Consultar o catálogo'}
              </Link>
            </p>
          )}
        </div>

        {/* Quantidade e Tempo Manual */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="quantidade" className="font-mono text-3xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
              {selectedDemanda?.blocos_totais && selectedDemanda.blocos_totais > 1
                ? `Blocos (de ${selectedDemanda.blocos_totais})`
                : 'Quantidade'}
            </Label>
            <div className="flex h-10 overflow-hidden rounded-sm border border-border bg-secondary/50 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
              <button
                type="button"
                aria-label="Diminuir quantidade"
                onClick={() => setQuantidade(q => typeof q === 'number' ? Math.max(1, q - 1) : 1)}
                className="flex h-full w-10 items-center justify-center border-r border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <Minus aria-hidden className="size-4" />
              </button>
              <input
                type="number"
                name="quantidade"
                id="quantidade"
                value={quantidade}
                onChange={handleQuantidadeChange}
                className="w-full flex-1 bg-transparent text-center text-sm font-bold text-foreground focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                className="flex h-full w-10 items-center justify-center border-l border-border text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40"
              >
                <Plus aria-hidden className="size-4" />
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
              <Label htmlFor="tempo_manual_min" className="font-mono text-3xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
                Tempo (hh:mm ou min)
              </Label>
              <Input
                id="tempo_manual_min"
                name="tempo_manual_min"
                type="text"
                value={tempoManual}
                onChange={(e) => setTempoManual(e.target.value)}
                required={selectedDemanda.variavel}
                className={`h-10 transition-none ${fieldClass} text-center font-bold`}
                placeholder="Ex: 01:30 ou 45"
              />
              {/* Só em demanda variável: nas de tempo padrão o número vem da
                  demanda, e um cronômetro ali sugeriria que dá para mudá-lo. */}
              {!isEdit && (
                <Cronometro compacto onAplicar={(minutos) => setTempoManual(formatarTempo(minutos))} />
              )}
            </div>
          )}
        </div>

        {/* Live Preview Box - Solid colors */}
        {tempoPreview !== null && (
          <div className="space-y-1.5 rounded-sm border border-primary/30 bg-primary/10 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground">Tempo estimado</span>
              <span className="rounded-sm border border-primary/30 bg-primary/20 px-2 py-0.5 text-xs font-bold text-primary">
                +{formatarTempo(tempoPreview)}
              </span>
            </div>

            {pctMeta !== null && (
              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-primary/20">
                <span>Progresso após este envio:</span>
                <strong className="font-bold text-foreground">{pctMeta}%</strong>
              </div>
            )}
          </div>
        )}

        {selectedDemanda?.variavel && (
          <div className="space-y-1.5">
            <Label htmlFor="motivo" className="font-mono text-3xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
              Motivo
            </Label>
            <Select name="motivo" value={motivo} onValueChange={(val) => setMotivo(val || '')} required>
              <SelectTrigger id="motivo" className={`h-10 transition-none ${fieldClass}`}>
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
          <Label htmlFor="observacoes" className="font-mono text-3xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
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
            className={`min-h-[80px] resize-none transition-none ${fieldClass} leading-relaxed`}
          />
        </div>

        {/* Submit Button - Solid Primary Color */}
        <Button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 h-11 w-full cursor-pointer rounded-sm bg-primary text-xs font-bold text-primary-foreground shadow-xs transition-none hover:bg-primary/90"
        >
          {isSubmitting ? (
            isEdit ? 'Salvando...' : 'Registrando...'
          ) : isEdit ? 'Salvar alterações' : 'Registrar apontamento'}
        </Button>
      </form>
    </div>
  )
}
