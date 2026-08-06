'use client'

import { Target, Trophy, Clock, Check } from 'lucide-react'
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
      badge: 'bg-secondary text-muted-foreground border-border',
      bar: 'bg-muted-foreground/30',
      icon: 'bg-secondary text-muted-foreground border-border',
    }
  }
  if (pct < 50) {
    return {
      badge: 'bg-secundaria/10 text-emerald-800 dark:text-secundaria border-secundaria/30 font-bold',
      bar: 'bg-secundaria/60',
      icon: 'bg-secundaria/10 text-secundaria border-secundaria/20',
    }
  }
  if (pct < 100) {
    return {
      badge: 'bg-primary/10 text-primary border-primary/30 font-bold',
      bar: 'bg-primary',
      icon: 'bg-primary/10 text-primary border-primary/30',
    }
  }
  return {
    badge: 'bg-secundaria text-slate-950 border-secundaria-forte font-extrabold shadow-xs',
    bar: 'bg-secundaria',
    icon: 'bg-secundaria/20 text-secundaria border-secundaria',
  }
}

export function DailyProgressBlocks({
  apontamentos,
  selectedDate,
  cargaHorariaMin,
  compacto = false,
}: {
  apontamentos: ApontamentoDia[]
  selectedDate: string
  cargaHorariaMin: number
  /** Variante de leitura direta, sem ícones ou microanimações. */
  compacto?: boolean
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

  const porDemanda = Object.values(
    apontamentos.reduce<Record<string, { nome: string; tempo: number; count: number }>>((acc, a) => {
      if (!acc[a.demanda_nome]) acc[a.demanda_nome] = { nome: a.demanda_nome, tempo: 0, count: 0 }
      acc[a.demanda_nome].tempo += a.tempo_total_min || 0
      acc[a.demanda_nome].count += 1
      return acc
    }, {}),
  ).sort((x, y) => y.tempo - x.tempo)

  if (compacto) {
    return (
      <section className="rounded-md border border-border bg-card p-5 shadow-xs sm:p-6">
        <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <p className="font-mono text-3xs uppercase tracking-[0.14em] text-primary">{isSelectedToday ? 'Hoje' : 'Data selecionada'}</p>
            <h2 className="mt-1 text-lg font-medium tracking-tight text-foreground">
              {isSelectedToday ? 'Tempo registrado' : format(parseISO(selectedDate), "d 'de' MMMM", { locale: ptBR })}
            </h2>
          </div>
          <div
            className={`flex h-9 min-w-12 items-center justify-center rounded-sm border px-3 text-base font-extrabold ${styles.badge}`}
          >
            {pct}%
          </div>
        </div>

        <div className="mt-5">
          <p className="font-mono text-3xs uppercase tracking-[0.12em] text-muted-foreground">De {formatarTempo(meta)}</p>
          <p className="mt-1 font-mono text-3xl font-medium tracking-tight text-foreground tabular-nums">{formatarTempo(tempoEntregue)}</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-sm bg-secondary">
            <div className={`h-full ${bateuMeta ? 'bg-success' : 'bg-primary'}`} style={{ width: `${pctBar}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {bateuMeta ? `Meta atingida${excedente > 0 ? `; ${formatarTempo(excedente)} além do previsto.` : '.'}` : `Faltam ${formatarTempo(restante)} para a meta.`}
          </p>
        </div>

        <div className="mt-6 border-t border-border pt-4">
          <p className="font-mono text-3xs uppercase tracking-[0.12em] text-muted-foreground">Registros do dia</p>
          {porDemanda.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nenhuma atividade registrada {isSelectedToday ? 'hoje.' : 'nesta data.'}</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {porDemanda.map((d) => (
                <li key={d.nome} className="flex items-center justify-between gap-4 py-2 text-sm">
                  <span className="min-w-0 truncate text-foreground">{d.nome}{d.count > 1 ? ` · ${d.count} registros` : ''}</span>
                  <span className="shrink-0 font-mono text-2xs font-medium text-muted-foreground">{formatarTempo(d.tempo)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    )
  }

  return (
    <div className="bg-card border border-border shadow-xs rounded-md p-5 sm:p-6 relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center font-bold border ${styles.icon}`}>
            {bateuMeta ? <Trophy className="h-5 w-5 text-emerald-500" /> : <Target className="h-4.5 w-4.5" />}
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              {isSelectedToday ? 'Progresso Diário' : `Progresso de ${format(parseISO(selectedDate), "dd 'de' MMM", { locale: ptBR })}`}
            </h3>
            <p className="text-xs text-muted-foreground">Meta estimada do dia: {formatarTempo(meta)}</p>
          </div>
        </div>
        <div
          className={`flex h-10 min-w-12 items-center justify-center rounded-lg px-3 text-base font-bold border transition-all duration-300 ${styles.badge}`}
        >
          {pct}%
        </div>
      </div>

      {/* Progress Bar & Indicators - Solid Colors */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between text-xs">
          <span className="font-bold text-foreground tabular-nums flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-primary" />
            {formatarTempo(tempoEntregue)} <span className="text-muted-foreground font-normal">/ {formatarTempo(meta)}</span>
          </span>
          <span className={`font-semibold ${bateuMeta ? 'text-emerald-500 font-bold' : 'text-muted-foreground'}`}>
            {bateuMeta ? `Meta atingida! (+${formatarTempo(excedente)})` : `Faltam ${formatarTempo(restante)}`}
          </span>
        </div>

        <div className="h-2.5 w-full rounded-full bg-secondary overflow-hidden p-0.5 border border-border/40">
          <div
            style={{ width: `${pctBar}%` }}
            className={`h-full rounded-full transition-all duration-500 ease-in-out ${styles.bar}`}
          />
        </div>
      </div>

      {/* List of Today's Activities */}
      <div className="mt-5 space-y-2">
        <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Atividades Lançadas ({porDemanda.length})
        </div>

        {porDemanda.length === 0 ? (
          <div className="w-full text-center py-4 text-xs text-muted-foreground italic bg-secondary/30 rounded-lg border border-border">
            Nenhuma demanda registrada {isSelectedToday ? 'hoje ainda.' : 'neste dia.'}
          </div>
        ) : (
          porDemanda.map((d) => (
            <div
              key={d.nome}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/60 px-3 py-2 text-xs transition-colors"
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <div className="h-5 w-5 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 border border-emerald-500/20">
                  <Check className="h-3 w-3" />
                </div>
                <span className="truncate font-medium text-foreground">{d.nome}</span>
                {d.count > 1 && (
                  <span className="shrink-0 text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                    ×{d.count}
                  </span>
                )}
              </span>
              <span className="shrink-0 font-bold tabular-nums text-foreground bg-background px-2 py-0.5 rounded border border-border text-[11px]">
                {formatarTempo(d.tempo)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
