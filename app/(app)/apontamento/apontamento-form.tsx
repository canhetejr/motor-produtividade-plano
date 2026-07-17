'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { createApontamento } from './actions'
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
import { PlusCircle, Loader2, Minus, Plus } from 'lucide-react'

type Demanda = {
  id: string
  nome: string
  variavel: boolean
  tempo_padrao_min: number | null
  blocos_totais: number
}

function tempoLabel(d: Demanda) {
  if (!d.tempo_padrao_min) return null
  return d.blocos_totais > 1
    ? `${Math.round(d.tempo_padrao_min / d.blocos_totais)}min/bloco`
    : `${d.tempo_padrao_min}min`
}

export function ApontamentoForm({ demandas }: { demandas: Demanda[] }) {
  const router = useRouter()
  const [selectedDemanda, setSelectedDemanda] = useState<Demanda | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [quantidade, setQuantidade] = useState<number | string>(1)

  const handleDemandaChange = (val: string | null) => {
    if (!val) {
      setSelectedDemanda(null)
      return
    }
    const found = demandas.find(d => d.id === val) || null
    setSelectedDemanda(found)
  }

  const handleQuantidadeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuantidade(val === '' ? '' : Number(val))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    const formData = new FormData(e.currentTarget)

    const result = await createApontamento(formData)

    setIsSubmitting(false)
    if (result.ok) {
      toast.success('Apontamento registrado!')
      router.push('/apontamento/historico')
    } else {
      toast.error(result.error)
    }
  }

  const fieldClass = 'bg-muted/50 hover:bg-muted border-input transition-colors shadow-sm'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="bg-card/80 border border-border shadow-lg rounded-2xl p-6 md:p-8 backdrop-blur-xl relative overflow-hidden"
    >
      <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-foreground/10 to-transparent" />

      <div className="flex items-center gap-3 mb-8">
        <div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary shadow-inner">
          <PlusCircle className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight">Novo Apontamento</h2>
          <p className="text-sm text-muted-foreground">Preencha os dados da atividade</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2.5">
          <Label htmlFor="demanda_id" className="text-sm font-semibold text-foreground/80">Demanda Realizada</Label>
          <Select name="demanda_id" onValueChange={handleDemandaChange} required>
            <SelectTrigger id="demanda_id" className={`h-12 ${fieldClass}`}>
              <SelectValue placeholder="Selecione a demanda">
                {selectedDemanda ? (
                  <span className="flex items-center gap-2">
                    {selectedDemanda.nome}
                    {tempoLabel(selectedDemanda) && (
                      <span className="text-muted-foreground text-xs bg-muted px-2 py-0.5 rounded-full">
                        {tempoLabel(selectedDemanda)}
                      </span>
                    )}
                  </span>
                ) : 'Selecione a demanda'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {demandas.length === 0 && (
                <SelectItem value="none" disabled>Nenhuma demanda para sua área</SelectItem>
              )}
              {demandas.map(d => (
                <SelectItem key={d.id} value={d.id} className="cursor-pointer">
                  <div className="flex items-center justify-between w-full pr-4">
                    <span>{d.nome}</span>
                    {tempoLabel(d) && (
                      <span className="text-xs text-muted-foreground">{tempoLabel(d)}</span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2.5">
            <Label htmlFor="quantidade" className="text-sm font-semibold text-foreground/80">
              {selectedDemanda?.blocos_totais && selectedDemanda.blocos_totais > 1
                ? `Quantidade de Blocos (de ${selectedDemanda.blocos_totais})`
                : 'Quantidade'}
            </Label>
            <div className="flex h-12 rounded-lg border border-input bg-muted/50 overflow-hidden ring-offset-background focus-within:ring-2 focus-within:ring-ring shadow-sm transition-all hover:border-ring/40">
              <button
                type="button"
                aria-label="Diminuir quantidade"
                onClick={() => setQuantidade(q => typeof q === 'number' ? Math.max(1, q - 1) : 1)}
                className="w-12 h-full flex items-center justify-center hover:bg-muted transition-colors border-r border-border text-muted-foreground hover:text-foreground"
              >
                <Minus className="h-4 w-4" />
              </button>
              <input
                type="number"
                name="quantidade"
                id="quantidade"
                value={quantidade}
                onChange={handleQuantidadeChange}
                className="flex-1 w-full bg-transparent text-center text-lg font-medium focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                min="0.01"
                step="0.01"
                required
              />
              <button
                type="button"
                aria-label="Aumentar quantidade"
                onClick={() => setQuantidade(q => typeof q === 'number' ? q + 1 : 1)}
                className="w-12 h-full flex items-center justify-center hover:bg-muted transition-colors border-l border-border text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {selectedDemanda?.variavel && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="space-y-2.5"
            >
              <Label htmlFor="tempo_manual_min" className="text-sm font-semibold text-foreground/80">Tempo Gasto (min)</Label>
              <Input
                id="tempo_manual_min"
                name="tempo_manual_min"
                type="number"
                min="1"
                required={selectedDemanda.variavel}
                className={`h-12 ${fieldClass} text-lg font-medium px-4`}
                placeholder="Ex: 45"
              />
            </motion.div>
          )}
        </div>

        <div className="space-y-2.5">
          <Label htmlFor="observacoes" className="text-sm font-semibold text-foreground/80">Observações <span className="text-muted-foreground font-normal">(opcional)</span></Label>
          <Textarea
            id="observacoes"
            name="observacoes"
            placeholder="Detalhes adicionais ou justificativas..."
            className={`resize-none min-h-25 ${fieldClass} px-4 py-3 leading-relaxed`}
          />
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-12 mt-4 text-md font-bold transition-all duration-300 hover:scale-[1.01] active:scale-[0.98] shadow-lg shadow-primary/20 bg-primary text-primary-foreground relative overflow-hidden group"
        >
          <div className="absolute inset-0 bg-primary-foreground/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
          <span className="relative flex items-center justify-center gap-2">
            {isSubmitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Registrando...
              </>
            ) : (
              'Registrar Apontamento'
            )}
          </span>
        </Button>
      </form>
    </motion.div>
  )
}
