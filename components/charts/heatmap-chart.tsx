'use client'

import { useMemo, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { 
  format, 
  eachDayOfInterval, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  subMonths, 
  addMonths, 
  isSameMonth, 
  isToday, 
  parseISO,
  isAfter
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarDays, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'

type HeatmapData = {
  data: string
  indice: number
}

export function HeatmapChart({ dados, compacto = false }: { dados: HeatmapData[]; compacto?: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const selectedDateParam = searchParams.get('date')
  const today = useMemo(() => new Date(), [])
  const todayStr = format(today, 'yyyy-MM-dd')
  const selectedDate = selectedDateParam || todayStr

  // Base state for the currently displayed month
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    if (selectedDateParam) {
      try {
        return parseISO(selectedDateParam)
      } catch {
        return today
      }
    }
    return today
  })

  // Sincroniza o mês exibido quando o query param muda. Ajuste de estado
  // durante o render (padrão recomendado pelo React) em vez de useEffect,
  // que dispararia um render em cascata.
  const [paramAnterior, setParamAnterior] = useState(selectedDateParam)
  if (paramAnterior !== selectedDateParam) {
    setParamAnterior(selectedDateParam)
    if (selectedDateParam) {
      try {
        const parsed = parseISO(selectedDateParam)
        if (!isSameMonth(currentMonth, parsed)) setCurrentMonth(parsed)
      } catch {}
    }
  }

  // Map input data for O(1) lookup
  const dataMap = useMemo(() => {
    const map = new Map<string, number>()
    dados.forEach(d => {
      if (d.data) {
        map.set(d.data, Number(d.indice) || 0)
      }
    })
    return map
  }, [dados])

  // Generate grid of days for current month view
  const monthGrid = useMemo(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 })
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })

    const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

    const weeks: {
      date: Date
      dateStr: string
      value: number
      inCurrentMonth: boolean
      isFuture: boolean
      isTodayDate: boolean
    }[][] = []

    let currentWeek: (typeof weeks)[number] = []

    days.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd')
      const value = dataMap.get(dateStr) ?? 0
      const inCurrentMonth = isSameMonth(day, currentMonth)
      const isFuture = dateStr > todayStr
      const isTodayDate = isToday(day)

      currentWeek.push({
        date: day,
        dateStr,
        value,
        inCurrentMonth,
        isFuture,
        isTodayDate
      })

      if (currentWeek.length === 7) {
        weeks.push(currentWeek)
        currentWeek = []
      }
    })

    return weeks
  }, [currentMonth, dataMap, todayStr])

  // Calculate statistics for the current month
  const monthStats = useMemo(() => {
    const monthStartStr = format(startOfMonth(currentMonth), 'yyyy-MM-dd')
    const monthEndStr = format(endOfMonth(currentMonth), 'yyyy-MM-dd')
    
    let daysWithPointers = 0
    let sumValue = 0

    dados.forEach(d => {
      if (d.data >= monthStartStr && d.data <= monthEndStr && d.data <= todayStr) {
        if (d.indice > 0) {
          daysWithPointers++
          sumValue += d.indice
        }
      }
    })

    const avg = daysWithPointers > 0 ? (sumValue / daysWithPointers) * 100 : 0
    return { daysWithPointers, avg: Math.round(avg) }
  }, [currentMonth, dados, todayStr])

  // Generate selector choices for the last 6 months
  const recentMonths = useMemo(() => {
    const months = []
    for (let i = 5; i >= 0; i--) {
      months.push(subMonths(today, i))
    }
    return months
  }, [today])

  // Color intensity styling according to productivity rules
  const getColorStyle = (value: number, inCurrentMonth: boolean) => {
    if (!inCurrentMonth) {
      return 'bg-muted/15 text-muted-foreground/20 border-transparent cursor-default'
    }
    if (value === 0) {
      return 'bg-secondary/40 text-muted-foreground border-border/40 hover:bg-secondary/70'
    }
    if (value < 0.5) {
      return 'bg-secundaria/15 text-emerald-800 dark:text-secundaria border-secundaria/30 font-medium hover:bg-secundaria/25'
    }
    if (value < 0.8) {
      return 'bg-secundaria/45 text-slate-900 dark:text-slate-100 border-secundaria/50 font-semibold hover:bg-secundaria/60'
    }
    if (value < 1.0) {
      return 'bg-secundaria/80 text-slate-950 border-secundaria font-bold hover:bg-secundaria/90'
    }
    return 'bg-secundaria text-slate-950 border-secundaria-forte font-extrabold shadow-2xs hover:brightness-105'
  }

  const handleDayClick = (dateStr: string) => {
    const params = new URLSearchParams(searchParams)
    if (dateStr === todayStr) {
      params.delete('date')
    } else {
      params.set('date', dateStr)
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const handlePrevMonth = () => setCurrentMonth(prev => subMonths(prev, 1))
  const handleNextMonth = () => {
    const next = addMonths(currentMonth, 1)
    if (!isAfter(startOfMonth(next), startOfMonth(today))) {
      setCurrentMonth(next)
    }
  }

  const handleGoToToday = () => {
    setCurrentMonth(today)
    const params = new URLSearchParams(searchParams)
    params.delete('date')
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const weekDayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  const monthTitle = format(currentMonth, 'MMMM yyyy', { locale: ptBR })
  const isCurrentMonthActive = isSameMonth(currentMonth, today)

  return (
    <div className="relative mb-6 rounded-md border border-border bg-card p-4 shadow-xs sm:p-5">
      {compacto ? (
        <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-3xs uppercase tracking-[0.14em] text-primary">Histórico</p>
            <h2 className="mt-1 text-lg font-medium tracking-tight text-foreground">Ritmo de trabalho</h2>
            <p className="mt-1 text-xs text-muted-foreground">Selecione um dia para consultar ou registrar atividades.</p>
          </div>
          <div className="flex items-center gap-3 font-mono text-3xs uppercase tracking-[0.1em]">
            {!isCurrentMonthActive && (
              <button type="button" onClick={handleGoToToday} className="text-primary hover:underline">Hoje</button>
            )}
            <button type="button" onClick={handlePrevMonth} className="text-muted-foreground hover:text-foreground">Anterior</button>
            <span className="min-w-[104px] text-center text-foreground capitalize">{monthTitle}</span>
            <button
              type="button"
              onClick={handleNextMonth}
              disabled={isCurrentMonthActive}
              className="text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
            >
              Próximo
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/70">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 bg-primary/10 text-primary rounded-md flex items-center justify-center font-bold border border-primary/20 shrink-0">
              <CalendarDays className="h-4 w-4" />
            </div>
            <div>
              <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">Histórico de produtividade</h3>
              <p className="text-[11px] text-muted-foreground hidden sm:block">Clique em um dia para filtrar os apontamentos.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto sm:ml-0">
            {monthStats.daysWithPointers > 0 && (
              <span className="hidden md:inline-flex text-[11px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium border border-border/40">
                {monthStats.daysWithPointers}d apontados • {monthStats.avg}% méd.
              </span>
            )}
            {!isCurrentMonthActive && (
              <button type="button" onClick={handleGoToToday} className="flex min-h-9 items-center gap-1 rounded-md border border-primary/20 p-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10 sm:px-2 sm:py-1" title="Voltar para Hoje">
                <RotateCcw className="w-3 h-3" /><span className="hidden sm:inline">Hoje</span>
              </button>
            )}
            <div className="flex items-center bg-muted/40 p-0.5 rounded-md border border-border/60">
              <button type="button" onClick={handlePrevMonth} aria-label="Mês anterior" className="min-h-9 min-w-9 rounded p-1 text-foreground transition-colors hover:bg-background" title="Mês anterior"><ChevronLeft className="w-3.5 h-3.5" /></button>
              <span className="px-2 text-xs font-bold capitalize min-w-[90px] text-center text-foreground">{monthTitle}</span>
              <button type="button" onClick={handleNextMonth} disabled={isCurrentMonthActive} aria-label="Próximo mês" className={`min-h-9 min-w-9 rounded p-1 transition-colors ${isCurrentMonthActive ? 'text-muted-foreground/30 cursor-not-allowed' : 'hover:bg-background text-foreground'}`} title="Próximo mês"><ChevronRight className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        </div>
      )}

      {/* Month Chips Row - Ultra Compact */}
      <div className="flex items-center gap-1 py-2 overflow-x-auto custom-scrollbar border-b border-border/40 text-[11px]">
        <span className="font-semibold text-muted-foreground/80 mr-1 uppercase text-[10px] tracking-wider whitespace-nowrap">
          Mês:
        </span>
        {recentMonths.map((m, idx) => {
          const isSelected = isSameMonth(m, currentMonth)
          const isThisMonth = isSameMonth(m, today)
          const label = format(m, 'MMM', { locale: ptBR })

          return (
            <button
              type="button"
              key={idx}
              onClick={() => setCurrentMonth(m)}
              className={`px-2 py-0.5 rounded-sm text-[11px] font-medium capitalize whitespace-nowrap border ${compacto ? '' : 'transition-all'} ${
                isSelected
                  ? 'bg-primary text-primary-foreground border-primary font-bold shadow-2xs'
                  : 'bg-background hover:bg-muted text-muted-foreground border-border/50'
              }`}
            >
              {label} {isThisMonth ? '•' : ''}
            </button>
          )
        })}
      </div>

      {/* Calendar Grid Container */}
      <div className="mt-3">
        {/* Days of Week Header */}
        <div className="grid grid-cols-7 gap-1 text-center mb-1">
          {weekDayLabels.map((label, idx) => (
            <div
              key={idx}
              className={`py-0.5 text-xs font-bold uppercase ${
                idx === 0 || idx === 6 ? 'text-muted-foreground/60' : 'text-foreground/80'
              }`}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Weeks & Compact Day Tiles */}
        <div className="space-y-1">
          {monthGrid.map((week, wIdx) => (
            <div 
              key={wIdx} 
              className="grid grid-cols-7 gap-1 pt-1 border-t border-border/30 first:border-t-0 first:pt-0"
            >
              {week.map((day, dIdx) => {
                const isSelected = day.dateStr === selectedDate
                const isClickable = day.inCurrentMonth && !day.isFuture
                const percentVal = Math.round(day.value * 100)

                return (
                  <div key={dIdx} className="relative group">
                    <button
                      type="button"
                      disabled={!isClickable}
                      onClick={() => isClickable && handleDayClick(day.dateStr)}
                      className={`relative flex h-7 w-full items-center justify-between rounded-sm border px-1 py-0.5 text-left sm:h-8 ${compacto ? '' : 'transition-all'} ${
                        getColorStyle(day.value, day.inCurrentMonth)
                      } ${
                        day.isFuture && day.inCurrentMonth 
                          ? 'opacity-35 cursor-not-allowed bg-muted/20 border-border/20' 
                          : ''
                      } ${
                        isSelected 
                          ? `z-20 ring-2 ring-primary ring-offset-1 ring-offset-background ${compacto ? '' : 'scale-[1.04] shadow-xs'}`
                          : ''
                      }`}
                    >
                      {/* Day Number */}
                      <span className={`text-xs font-bold ${
                        !day.inCurrentMonth ? 'text-muted-foreground/20' : ''
                      }`}>
                        {format(day.date, 'd')}
                      </span>

                      {/* Percentage Badge / Dot */}
                      {day.inCurrentMonth && !day.isFuture && (
                        day.value > 0 ? (
                          <span className="text-[9px] sm:text-[10px] font-bold leading-none">
                            {percentVal}%
                          </span>
                        ) : (
                          day.isTodayDate && (
                            <span className="h-1.5 w-1.5 rounded-full bg-primary" title="Hoje" />
                          )
                        )
                      )}
                    </button>

                    {/* Tooltip on Hover */}
                    {day.inCurrentMonth && !day.isFuture && (
                      <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 ${isSelected ? 'flex' : 'hidden'} group-hover:flex flex-col items-center z-30 pointer-events-none`}>
                        <div className="bg-popover text-popover-foreground text-[11px] font-semibold py-0.5 px-2 rounded shadow-md border border-border whitespace-nowrap">
                          {format(day.date, "dd/MM/yyyy")}: <span className="text-primary font-bold">{percentVal}%</span>
                        </div>
                        <div className="w-1.5 h-1.5 bg-popover border-r border-b border-border rotate-45 -mt-1" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Progress Scale Legend Footer - Compact */}
      <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-border/50 text-[11px] text-muted-foreground">
        <span className="text-[10px] text-muted-foreground hidden sm:inline">
          Clique no dia para filtrar.
        </span>

        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-[10px] font-medium">Menos</span>
          <div className="flex gap-1">
            <div className="h-3 w-3 rounded-xs bg-secondary/40 border border-border/40" title="0%" />
            <div className="h-3 w-3 rounded-xs bg-secundaria/15 border border-secundaria/30" title="Até 49%" />
            <div className="h-3 w-3 rounded-xs bg-secundaria/45 border border-secundaria/50" title="50% a 79%" />
            <div className="h-3 w-3 rounded-xs bg-secundaria/80 border border-secundaria" title="80% a 99%" />
            <div className="h-3 w-3 rounded-xs bg-secundaria border border-secundaria-forte" title="100% ou mais" />
          </div>
          <span className="text-[10px] font-medium">Mais</span>
        </div>
      </div>
    </div>
  )
}
