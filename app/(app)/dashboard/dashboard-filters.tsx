'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { CalendarDays, Layers, Filter } from 'lucide-react'
import { motion } from 'framer-motion'

type Area = { id: string; nome: string }

export function DashboardFilters({
  areas,
  currentPeriod,
  currentArea
}: {
  areas: Area[]
  currentPeriod: string
  currentArea: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const setParam = (key: string, val: string | null) => {
    if (!val) return
    const params = new URLSearchParams(searchParams.toString())
    params.set(key, val)
    router.push(`?${params.toString()}`, { scroll: false })
  }

  const fieldClass = 'bg-muted/40 hover:bg-muted/80 border-input/50 transition-colors shadow-sm focus:border-primary/50 rounded-xl'

  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="bg-card/80 border border-border/50 shadow-xl rounded-3xl p-6 backdrop-blur-xl relative overflow-hidden group"
    >
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[60px] pointer-events-none -z-10" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />

      <div className="flex items-center gap-3 mb-6">
        <div className="h-8 w-8 bg-linear-to-br from-primary/20 to-primary/5 rounded-lg flex items-center justify-center text-primary shadow-sm border border-primary/20">
          <Filter className="h-4 w-4" />
        </div>
        <h3 className="text-lg font-bold tracking-tight">Filtros de Análise</h3>
      </div>

      <div className="flex flex-col sm:flex-row items-end gap-6">
        <div className="space-y-3 w-full sm:w-[260px]">
          <Label className="text-sm font-semibold flex items-center gap-2 text-foreground/90">
            <CalendarDays className="h-4 w-4 text-primary/70" /> Período
          </Label>
          <Select value={currentPeriod} onValueChange={(val) => setParam('period', val)}>
            <SelectTrigger className={`h-12 ${fieldClass} font-medium`}>
              <SelectValue placeholder="Selecione o período">
                {currentPeriod === 'today' ? 'Hoje' :
                 currentPeriod === 'week' ? 'Esta Semana' :
                 currentPeriod === 'month' ? 'Este Mês' :
                 currentPeriod === 'last7' ? 'Últimos 7 dias' :
                 currentPeriod === 'last15' ? 'Últimos 15 dias' :
                 currentPeriod === 'last30' ? 'Últimos 30 dias' :
                 currentPeriod === 'last90' ? 'Últimos 90 dias' :
                 currentPeriod === 'last180' ? 'Últimos 180 dias' :
                 'Selecione o período'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="today" className="py-2.5 rounded-lg cursor-pointer">Hoje</SelectItem>
              <SelectItem value="week" className="py-2.5 rounded-lg cursor-pointer">Esta Semana</SelectItem>
              <SelectItem value="month" className="py-2.5 rounded-lg cursor-pointer">Este Mês</SelectItem>
              <SelectItem value="last7" className="py-2.5 rounded-lg cursor-pointer">Últimos 7 dias</SelectItem>
              <SelectItem value="last15" className="py-2.5 rounded-lg cursor-pointer">Últimos 15 dias</SelectItem>
              <SelectItem value="last30" className="py-2.5 rounded-lg cursor-pointer">Últimos 30 dias</SelectItem>
              <SelectItem value="last90" className="py-2.5 rounded-lg cursor-pointer">Últimos 90 dias</SelectItem>
              <SelectItem value="last180" className="py-2.5 rounded-lg cursor-pointer">Últimos 180 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3 w-full sm:w-[260px]">
          <Label className="text-sm font-semibold flex items-center gap-2 text-foreground/90">
            <Layers className="h-4 w-4 text-primary/70" /> Área
          </Label>
          <Select value={currentArea} onValueChange={(val) => setParam('area', val)}>
            <SelectTrigger className={`h-12 ${fieldClass} font-medium`}>
              <SelectValue placeholder="Todas as áreas">
                {currentArea === 'all' ? 'Todas as Áreas' : areas.find(a => a.id === currentArea)?.nome || 'Todas as áreas'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all" className="py-2.5 rounded-lg cursor-pointer font-bold">Todas as Áreas</SelectItem>
              {areas.map(area => (
                <SelectItem key={area.id} value={area.id} className="py-2.5 rounded-lg cursor-pointer">
                  {area.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </motion.div>
  )
}
