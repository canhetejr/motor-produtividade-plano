'use client'

import { useMemo } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { format, eachDayOfInterval, subDays, startOfWeek, endOfWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { motion } from 'framer-motion'
import { CalendarDays } from 'lucide-react'

type HeatmapData = {
  data: string
  indice: number
}

export function HeatmapChart({ dados }: { dados: HeatmapData[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const selectedDateParam = searchParams.get('date')
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const selectedDate = selectedDateParam || todayStr

  // Generate the last 180 days grid
  const { weeks } = useMemo(() => {
    const today = new Date()
    const startDate = subDays(today, 180)
    
    // We want the grid to start at the beginning of the week for startDate
    const gridStart = startOfWeek(startDate, { weekStartsOn: 0 })
    const gridEnd = endOfWeek(today, { weekStartsOn: 0 })

    const days = eachDayOfInterval({ start: gridStart, end: gridEnd })
    
    let max = 0
    const dataMap = new Map<string, number>()
    dados.forEach(d => {
      const val = Number(d.indice)
      dataMap.set(d.data, val)
      if (val > max) max = val
    })

    // Group by weeks
    const weeksArray: { date: Date; value: number; dateStr: string }[][] = []
    let currentWeek: { date: Date; value: number; dateStr: string }[] = []

    days.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd')
      const value = dataMap.get(dateStr) ?? 0
      
      currentWeek.push({ date: day, value, dateStr })
      
      if (currentWeek.length === 7) {
        weeksArray.push(currentWeek)
        currentWeek = []
      }
    })

    return { weeks: weeksArray }
  }, [dados])

  // Get color intensity based on value (0 to 1+)
  const getColorClass = (value: number) => {
    if (value === 0) return 'bg-secondary border-border/40'
    if (value < 0.5) return 'bg-[#006652]/20 border-[#006652]/30'
    if (value < 0.8) return 'bg-[#006652]/50 border-[#006652]/60 text-white'
    if (value < 1.0) return 'bg-[#006652]/80 border-[#006652] text-white'
    return 'bg-[#006652] border-[#004d3e] text-white font-bold'
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

  const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

  return (
    <div className="bg-card border border-border shadow-xs rounded-none p-6 mb-8 relative">
      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border">
        <div className="h-9 w-9 bg-primary/10 text-primary rounded-none flex items-center justify-center font-bold border border-primary/20">
          <CalendarDays className="h-4.5 w-4.5" />
        </div>
        <div>
          <h3 className="text-lg font-bold tracking-tight text-foreground">Histórico de Produtividade</h3>
          <p className="text-xs text-muted-foreground">Últimos 6 meses de atividade. Clique em um dia para filtrar.</p>
        </div>
      </div>

      <div className="flex">
        {/* Y Axis - Days of week */}
        <div className="flex flex-col justify-between pr-3 text-[10px] text-muted-foreground font-semibold pt-6 pb-1">
          {weekDays.map((d, i) => (
            <div key={i} className="h-3.5 sm:h-4 flex items-center justify-end w-3">
              {i % 2 !== 0 ? d : ''}
            </div>
          ))}
        </div>

        {/* Heatmap Grid */}
        <div className="flex-1 overflow-x-auto pb-4 custom-scrollbar">
          <div className="flex gap-1.5 min-w-max pt-1 px-1">
            {weeks.map((week, wIdx) => (
              <div key={wIdx} className="flex flex-col gap-1.5 relative group/week">
                {/* Month Label */}
                {week[0].date.getDate() <= 7 && (
                  <div className="absolute -top-5 left-0 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {format(week[0].date, 'MMM', { locale: ptBR })}
                  </div>
                )}
                
                {week.map((day, dIdx) => {
                  const isFuture = day.dateStr > todayStr
                  const isSelected = day.dateStr === selectedDate
                  return (
                    <button
                      key={dIdx}
                      disabled={isFuture}
                      onClick={() => handleDayClick(day.dateStr)}
                      title={`${format(day.date, 'dd/MM/yyyy')}: ${(day.value * 100).toFixed(0)}%`}
                      className={`h-3.5 w-3.5 sm:h-4 sm:w-4 rounded-none border transition-all
                        ${!isFuture ? 'cursor-pointer hover:scale-110' : 'opacity-0 cursor-default'} 
                        ${isSelected ? 'ring-2 ring-primary ring-offset-1 ring-offset-background scale-110 z-10' : ''} 
                        ${getColorClass(day.value)}`}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <div className="flex items-center justify-end gap-2.5 mt-4 text-[11px] font-medium text-muted-foreground">
        <span>Menos</span>
        <div className="flex gap-1">
          <div className="h-3 w-3 rounded-none bg-secondary border border-border/40" />
          <div className="h-3 w-3 rounded-none bg-[#006652]/20 border border-[#006652]/30" />
          <div className="h-3 w-3 rounded-none bg-[#006652]/50 border border-[#006652]/60" />
          <div className="h-3 w-3 rounded-none bg-[#006652]/80 border border-[#006652]" />
          <div className="h-3 w-3 rounded-none bg-[#006652] border border-[#004d3e]" />
        </div>
        <span>Mais</span>
      </div>
    </div>
  )
}
