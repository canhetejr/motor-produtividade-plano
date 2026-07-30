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

export function HeatmapChart({ dados }: { dados: HeatmapData[] }) {
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
      return 'bg-[#00FFCE]/15 text-emerald-800 dark:text-[#00FFCE] border-[#00FFCE]/30 font-medium hover:bg-[#00FFCE]/25'
    }
    if (value < 0.8) {
      return 'bg-[#00FFCE]/45 text-slate-900 dark:text-slate-100 border-[#00FFCE]/50 font-semibold hover:bg-[#00FFCE]/60'
    }
    if (value < 1.0) {
      return 'bg-[#00FFCE]/80 text-slate-950 border-[#00FFCE] font-bold hover:bg-[#00FFCE]/90'
    }
    return 'bg-[#00FFCE] text-slate-950 border-[#0FD9B6] font-extrabold shadow-2xs hover:brightness-105'
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
    <div className="bg-card border border-border shadow-xs rounded-xl p-4 sm:p-5 mb-6 relative">
      {/* Top Header Row - Compact */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/70">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 bg-primary/10 text-primary rounded-md flex items-center justify-center font-bold border border-primary/20 shrink-0">
            <CalendarDays className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold tracking-tight text-foreground flex items-center gap-2">
              Histórico de Produtividade
            </h3>
            <p className="text-[11px] text-muted-foreground hidden sm:block">
              Clique em um dia para filtrar os apontamentos.
            </p>
          </div>
        </div>

        {/* Right Side Controls & Stats */}
        <div className="flex items-center gap-2 ml-auto sm:ml-0">
          {monthStats.daysWithPointers > 0 && (
            <span className="hidden md:inline-flex text-[11px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium border border-border/40">
              {monthStats.daysWithPointers}d apontados • {monthStats.avg}% méd.
            </span>
          )}

          {!isCurrentMonthActive && (
            <button
              onClick={handleGoToToday}
              className="p-1 sm:px-2 sm:py-1 text-[11px] font-medium text-primary hover:bg-primary/10 rounded-md border border-primary/20 flex items-center gap-1 transition-colors"
              title="Voltar para Hoje"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden sm:inline">Hoje</span>
            </button>
          )}

          {/* Month Chevron Nav */}
          <div className="flex items-center bg-muted/40 p-0.5 rounded-md border border-border/60">
            <button
              onClick={handlePrevMonth}
              className="p-1 hover:bg-background rounded text-foreground transition-colors"
              title="Mês anterior"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <span className="px-2 text-xs font-bold capitalize min-w-[90px] text-center text-foreground">
              {monthTitle}
            </span>

            <button
              onClick={handleNextMonth}
              disabled={isCurrentMonthActive}
              className={`p-1 rounded transition-colors ${
                isCurrentMonthActive 
                  ? 'text-muted-foreground/30 cursor-not-allowed' 
                  : 'hover:bg-background text-foreground'
              }`}
              title="Próximo mês"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

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
              key={idx}
              onClick={() => setCurrentMonth(m)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium capitalize transition-all whitespace-nowrap border ${
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
              className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider py-0.5 ${
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
                      disabled={!isClickable}
                      onClick={() => isClickable && handleDayClick(day.dateStr)}
                      className={`w-full h-7 sm:h-8 rounded-md border px-1 py-0.5 flex items-center justify-between transition-all relative text-left ${
                        getColorStyle(day.value, day.inCurrentMonth)
                      } ${
                        day.isFuture && day.inCurrentMonth 
                          ? 'opacity-35 cursor-not-allowed bg-muted/20 border-border/20' 
                          : ''
                      } ${
                        isSelected 
                          ? 'ring-2 ring-primary ring-offset-1 ring-offset-background scale-[1.04] z-20 shadow-xs' 
                          : ''
                      }`}
                    >
                      {/* Day Number */}
                      <span className={`text-[11px] sm:text-xs font-bold ${
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
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex flex-col items-center z-30 pointer-events-none">
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
            <div className="h-3 w-3 rounded-xs bg-[#00FFCE]/15 border border-[#00FFCE]/30" title="Até 49%" />
            <div className="h-3 w-3 rounded-xs bg-[#00FFCE]/45 border border-[#00FFCE]/50" title="50% a 79%" />
            <div className="h-3 w-3 rounded-xs bg-[#00FFCE]/80 border border-[#00FFCE]" title="80% a 99%" />
            <div className="h-3 w-3 rounded-xs bg-[#00FFCE] border border-[#0FD9B6]" title="100% ou mais" />
          </div>
          <span className="text-[10px] font-medium">Mais</span>
        </div>
      </div>
    </div>
  )
}
