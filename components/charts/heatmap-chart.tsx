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
    if (value === 0) return 'bg-muted/30 border-transparent hover:bg-muted/50'
    // Indice is usually a ratio (0.0 to >1.0)
    if (value < 0.5) return 'bg-primary/30 border-primary/20 hover:bg-primary/40'
    if (value < 0.8) return 'bg-primary/60 border-primary/40 hover:bg-primary/70'
    if (value < 1.0) return 'bg-primary/80 border-primary/60 hover:bg-primary/90'
    return 'bg-primary border-primary shadow-[0_0_12px_rgba(var(--primary),0.6)] hover:bg-primary/90'
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
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="bg-card/80 border border-border shadow-xl rounded-3xl p-6 md:p-8 backdrop-blur-xl mb-8 overflow-hidden relative"
    >
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/5 rounded-full blur-[60px] pointer-events-none -z-10" />

      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 bg-linear-to-br from-primary/20 to-primary/5 rounded-xl flex items-center justify-center text-primary shadow-sm">
          <CalendarDays className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-xl font-bold tracking-tight">Histórico de Produtividade</h3>
          <p className="text-sm text-muted-foreground mt-0.5">Últimos 6 meses de atividade. Clique num dia para ver os detalhes.</p>
        </div>
      </div>

      <div className="flex">
        {/* Y Axis - Days of week */}
        <div className="flex flex-col justify-between pr-3 text-[10px] text-muted-foreground font-bold pt-6 pb-1">
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
                {/* Month Label (only show if it's the first week of the month) */}
                {week[0].date.getDate() <= 7 && (
                  <div className="absolute -top-6 left-0 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
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
                      className={`h-3.5 w-3.5 sm:h-4 sm:w-4 rounded-[4px] border transition-all duration-300
                        ${!isFuture ? 'cursor-pointer hover:scale-125 hover:z-10' : 'opacity-0 cursor-default'} 
                        ${isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-110 z-10' : ''} 
                        ${getColorClass(day.value)}`}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <div className="flex items-center justify-end gap-3 mt-6 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        <span>Menos</span>
        <div className="flex gap-1.5">
          <div className="h-3.5 w-3.5 rounded-[4px] bg-muted/30 border border-transparent" />
          <div className="h-3.5 w-3.5 rounded-[4px] bg-primary/30 border border-primary/20" />
          <div className="h-3.5 w-3.5 rounded-[4px] bg-primary/60 border border-primary/40" />
          <div className="h-3.5 w-3.5 rounded-[4px] bg-primary/80 border border-primary/60" />
          <div className="h-3.5 w-3.5 rounded-[4px] bg-primary border-primary shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
        </div>
        <span>Mais</span>
      </div>
    </motion.div>
  )
}
