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
import { PlusCircle, Loader2, Minus, Plus, Briefcase, Target, AlignLeft, Clock } from 'lucide-react'

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

  const fieldClass = 'bg-muted/40 hover:bg-muted/80 border-input/50 transition-colors shadow-sm focus:border-primary/50'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="bg-card/80 border border-border shadow-2xl rounded-3xl p-6 md:p-8 backdrop-blur-xl relative overflow-hidden group/form"
    >
      <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-primary/30 to-transparent opacity-0 group-hover/form:opacity-100 transition-opacity duration-1000" />
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-[80px] pointer-events-none" />

      <div className="flex items-center gap-4 mb-8 relative z-10">
        <div className="h-14 w-14 bg-linear-to-br from-primary/20 to-primary/5 border border-primary/20 rounded-2xl flex items-center justify-center text-primary shadow-inner">
          <PlusCircle className="h-7 w-7" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Novo Apontamento</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Preencha os dados da atividade</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
        <div className="space-y-3">
          <Label htmlFor="demanda_id" className="text-sm font-semibold flex items-center gap-2 text-foreground/90">
            <Briefcase className="h-4 w-4 text-primary/70" /> Demanda Realizada
          </Label>
          <Select name="demanda_id" onValueChange={handleDemandaChange} required>
            <SelectTrigger id="demanda_id" className={`h-12 ${fieldClass} rounded-xl`}>
              <SelectValue placeholder="Selecione a demanda">
                {selectedDemanda ? (
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{selectedDemanda.nome}</span>
                    {tempoLabel(selectedDemanda) && (
                      <span className="text-primary text-[10px] font-bold tracking-wider uppercase bg-primary/10 px-2 py-1 rounded-md">
                        {tempoLabel(selectedDemanda)}
                      </span>
                    )}
                  </span>
                ) : 'Selecione a demanda'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {demandas.length === 0 && (
                <SelectItem value="none" disabled>Nenhuma demanda para sua área</SelectItem>
              )}
              {demandas.map(d => (
                <SelectItem key={d.id} value={d.id} className="cursor-pointer py-3 rounded-lg">
                  <div className="flex items-center justify-between w-full pr-2">
                    <span className="font-medium">{d.nome}</span>
                    {tempoLabel(d) && (
                      <span className="text-xs font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-md">{tempoLabel(d)}</span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-3">
            <Label htmlFor="quantidade" className="text-sm font-semibold flex items-center gap-2 text-foreground/90">
              <Target className="h-4 w-4 text-primary/70" />
              {selectedDemanda?.blocos_totais && selectedDemanda.blocos_totais > 1
                ? `Blocos (de ${selectedDemanda.blocos_totais})`
                : 'Quantidade'}
            </Label>
            <div className="flex h-12 rounded-xl border border-input/50 bg-muted/40 overflow-hidden ring-offset-background focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 shadow-sm transition-all hover:border-primary/30">
              <button
                type="button"
                aria-label="Diminuir quantidade"
                onClick={() => setQuantidade(q => typeof q === 'number' ? Math.max(1, q - 1) : 1)}
                className="w-12 h-full flex items-center justify-center hover:bg-muted transition-colors border-r border-border/50 text-muted-foreground hover:text-foreground active:bg-muted/80"
              >
                <Minus className="h-4 w-4" />
              </button>
              <input
                type="number"
                name="quantidade"
                id="quantidade"
                value={quantidade}
                onChange={handleQuantidadeChange}
                className="flex-1 w-full bg-transparent text-center text-lg font-bold text-foreground focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                min="0.01"
                step="0.01"
                required
              />
              <button
                type="button"
                aria-label="Aumentar quantidade"
                onClick={() => setQuantidade(q => typeof q === 'number' ? q + 1 : 1)}
                className="w-12 h-full flex items-center justify-center hover:bg-muted transition-colors border-l border-border/50 text-muted-foreground hover:text-foreground active:bg-muted/80"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {selectedDemanda?.variavel && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="space-y-3"
            >
              <Label htmlFor="tempo_manual_min" className="text-sm font-semibold flex items-center gap-2 text-foreground/90">
                <Clock className="h-4 w-4 text-primary/70" /> Tempo Gasto (min)
              </Label>
              <Input
                id="tempo_manual_min"
                name="tempo_manual_min"
                type="number"
                min="1"
                required={selectedDemanda.variavel}
                className={`h-12 ${fieldClass} rounded-xl text-lg font-bold text-center px-4`}
                placeholder="Ex: 45"
              />
            </motion.div>
          )}
        </div>

        <div className="space-y-3">
          <Label htmlFor="observacoes" className="text-sm font-semibold flex items-center gap-2 text-foreground/90">
            <AlignLeft className="h-4 w-4 text-primary/70" /> 
            Observações <span className="text-muted-foreground/60 font-normal ml-1">(opcional)</span>
          </Label>
          <Textarea
            id="observacoes"
            name="observacoes"
            placeholder="Detalhes adicionais ou justificativas para o apontamento..."
            className={`resize-none min-h-[100px] ${fieldClass} rounded-xl px-4 py-3 leading-relaxed placeholder:text-muted-foreground/50`}
          />
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-14 mt-6 text-base font-bold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-primary/25 bg-primary text-primary-foreground relative overflow-hidden group rounded-xl"
        >
          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
          <span className="relative flex items-center justify-center gap-2">
            {isSubmitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Registrando...
              </>
            ) : (
              <>
                Registrar Apontamento
                <PlusCircle className="h-5 w-5 opacity-70 group-hover:opacity-100 transition-opacity" />
              </>
            )}
          </span>
        </Button>
      </form>
    </motion.div>
  )
}
