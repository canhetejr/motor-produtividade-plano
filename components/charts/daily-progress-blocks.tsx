'use client'

import { motion } from 'framer-motion'
import { CheckCircle2, Target } from 'lucide-react'
import { format, parseISO, isToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { formatarTempo } from '@/lib/tempo'

type ApontamentoDia = {
  id: string
  quantidade: number
  tempo_total_min: number
  demanda_nome: string
}

function getProgressStyles(pct: number) {
  if (pct === 0) {
    return {
      badge: 'bg-secondary/50 text-muted-foreground border-border',
      bar: 'bg-muted-foreground',
      icon: 'bg-secondary/50 text-muted-foreground border-border',
    }
  }
  if (pct < 15) {
    return {
      badge: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
      bar: 'bg-rose-600 dark:bg-rose-500',
      icon: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
    }
  }
  if (pct < 50) {
    return {
      badge: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20',
      bar: 'bg-orange-600 dark:bg-orange-500',
      icon: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20',
    }
  }
  if (pct < 80) {
    return {
      badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
      bar: 'bg-amber-500 dark:bg-amber-400',
      icon: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
    }
  }
  if (pct < 100) {
    return {
      badge: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
      bar: 'bg-blue-600 dark:bg-blue-500',
      icon: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
    }
  }
  return {
    badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    bar: 'bg-emerald-600 dark:bg-emerald-500',
    icon: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  }
}

export function DailyProgressBlocks({
  apontamentos,
  selectedDate,
  cargaHorariaMin,
}: {
  apontamentos: ApontamentoDia[]
  selectedDate: string
  cargaHorariaMin: number
}) {
  const meta = cargaHorariaMin > 0 ? cargaHorariaMin : 480
  const tempoEntregue = apontamentos.reduce((acc, a) => acc + (a.tempo_total_min || 0), 0)
  const pct = Math.round((tempoEntregue / meta) * 100)
  const pctBar = Math.min(100, pct)
  const restante = Math.max(0, meta - tempoEntregue)
  const excedente = Math.max(0, tempoEntregue - meta)
  const bateuMeta = tempoEntregue >= meta

  const isSelectedToday = isToday(parseISO(selectedDate))
  const styles = getProgressStyles(pct)

  // Agrupa por demanda somando o tempo — lista mais limpa que uma linha por
  // lançamento (quem fez a mesma demanda 3x vê "×3" numa linha só).
  const porDemanda = Object.values(
    apontamentos.reduce<Record<string, { nome: string; tempo: number; count: number }>>((acc, a) => {
      if (!acc[a.demanda_nome]) acc[a.demanda_nome] = { nome: a.demanda_nome, tempo: 0, count: 0 }
      acc[a.demanda_nome].tempo += a.tempo_total_min || 0
      acc[a.demanda_nome].count += 1
      return acc
    }, {}),
  ).sort((x, y) => y.tempo - x.tempo)

  return (
    <div className="bg-card border border-border shadow-xs rounded-none p-6">
      <div className="flex items-center justify-between mb-5 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className={`h-9 w-9 rounded-none flex items-center justify-center font-bold border ${styles.icon}`}>
            <Target className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="text-lg font-bold tracking-tight text-foreground">
              {isSelectedToday ? 'Progresso Diário' : `Progresso de ${format(parseISO(selectedDate), "dd 'de' MMM", { locale: ptBR })}`}
            </h3>
            <p className="text-xs text-muted-foreground">Meta estimada do dia: {formatarTempo(meta)}</p>
          </div>
        </div>
        <div
          className={`flex h-11 min-w-11 items-center justify-center rounded-none px-3 text-lg font-bold border transition-colors duration-300 ${styles.badge}`}
        >
          {pct}%
        </div>
      </div>

      {/* Barra de progresso */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between text-xs">
          <span className="font-semibold text-foreground tabular-nums">
            {formatarTempo(tempoEntregue)} <span className="text-muted-foreground font-normal">/ {formatarTempo(meta)}</span>
          </span>
          <span className={`font-semibold ${bateuMeta ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'}`}>
            {bateuMeta ? `Meta atingida (+${formatarTempo(excedente)})` : `Faltam ${formatarTempo(restante)}`}
          </span>
        </div>
        <div className="h-2 w-full rounded-none bg-secondary overflow-hidden">
          <div
            style={{ width: `${pctBar}%` }}
            className={`h-full rounded-none transition-all duration-500 ease-in-out ${styles.bar}`}
          />
        </div>
      </div>

      {/* Demandas do dia */}
      <div className="mt-5 space-y-2">
        {porDemanda.length === 0 ? (
          <div className="w-full text-center py-4 text-xs text-muted-foreground italic bg-secondary/50 rounded-none border border-border">
            Nenhuma demanda registrada {isSelectedToday ? 'hoje ainda.' : 'neste dia.'}
          </div>
        ) : (
          porDemanda.map((d) => (
            <div
              key={d.nome}
              className="flex items-center justify-between gap-3 rounded-none border border-border bg-card px-3 py-2 text-xs"
            >
              <span className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="truncate font-medium text-foreground">{d.nome}</span>
                {d.count > 1 && (
                  <span className="shrink-0 text-[10px] font-bold text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-none">
                    ×{d.count}
                  </span>
                )}
              </span>
              <span className="shrink-0 font-bold tabular-nums text-foreground">{formatarTempo(d.tempo)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
