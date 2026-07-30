'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Cartao } from './types'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const PRIORIDADE_CLASSE: Record<Cartao['prioridade'], string> = {
  baixa: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  media: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  alta: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
}

function isoParaData(iso: string) {
  const [ano, mes, dia] = iso.split('-').map(Number)
  return new Date(ano, mes - 1, dia)
}

export function CalendarView({ cartoes, onSelect }: { cartoes: Cartao[]; onSelect: (cartao: Cartao) => void }) {
  const [mesAtual, setMesAtual] = useState(new Date())
  const ano = mesAtual.getFullYear()
  const mes = mesAtual.getMonth()

  const primeiroDia = new Date(ano, mes, 1)
  const inicioSemana = primeiroDia.getDay()
  const diasNoMes = new Date(ano, mes + 1, 0).getDate()
  const diasMesAnterior = new Date(ano, mes, 0).getDate()

  const celulas = [
    ...Array.from({ length: inicioSemana }, (_, i) => ({ data: new Date(ano, mes - 1, diasMesAnterior - inicioSemana + i + 1), atual: false })),
    ...Array.from({ length: diasNoMes }, (_, i) => ({ data: new Date(ano, mes, i + 1), atual: true })),
  ]
  const restante = celulas.length % 7 === 0 ? 0 : 7 - (celulas.length % 7)
  for (let i = 0; i < restante; i++) celulas.push({ data: new Date(ano, mes + 1, i + 1), atual: false })

  const hoje = new Date()
  const ehHoje = (d: Date) => d.toDateString() === hoje.toDateString()

  const cartoesPorDia = (d: Date) =>
    cartoes.filter((c) => c.prazo && isoParaData(c.prazo).toDateString() === d.toDateString())

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-xl border border-border p-3">
        <h3 className="text-sm font-bold uppercase tracking-wide">{MESES[mes]} de {ano}</h3>
        <div className="flex items-center gap-1.5">
          <Button size="icon-sm" variant="outline" onClick={() => setMesAtual(new Date(ano, mes - 1, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setMesAtual(new Date())}>Hoje</Button>
          <Button size="icon-sm" variant="outline" onClick={() => setMesAtual(new Date(ano, mes + 1, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {DIAS_SEMANA.map((d) => (
          <span key={d} className="text-3xs font-bold uppercase tracking-wide text-muted-foreground py-1">{d}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {celulas.map(({ data, atual }, i) => {
          const cartoesDia = cartoesPorDia(data)
          return (
            <div
              key={i}
              className={cn(
                'min-h-[100px] rounded-lg border border-border p-2 flex flex-col gap-1',
                !atual && 'opacity-40'
              )}
            >
              <span
                className={cn(
                  'text-xs font-bold font-mono h-6 w-6 rounded-full flex items-center justify-center',
                  ehHoje(data) && 'bg-primary text-primary-foreground'
                )}
              >
                {data.getDate()}
              </span>
              <div className="flex-1 space-y-1 overflow-y-auto max-h-24">
                {cartoesDia.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onSelect(c)}
                    className={cn('w-full text-left text-3xs font-semibold px-1.5 py-1 rounded border truncate', PRIORIDADE_CLASSE[c.prioridade])}
                    title={c.titulo}
                  >
                    {c.titulo}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
