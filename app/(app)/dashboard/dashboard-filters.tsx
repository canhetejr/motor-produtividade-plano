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

  const fieldClass = 'bg-secondary/40 hover:bg-secondary/70 border-border transition-colors focus:border-primary rounded-lg h-10 text-xs font-medium'

  return (
    <div className="bg-card border border-border shadow-xs rounded-xl p-5 relative overflow-hidden">
      <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-border">
        <div className="h-8 w-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center font-bold border border-primary/20 shrink-0">
          <Filter className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm sm:text-base font-bold tracking-tight text-foreground">Filtros de Análise</h3>
          <p className="text-xs text-muted-foreground">Filtre os dados por período de tempo e área da equipe</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-end gap-4">
        <div className="space-y-1.5 w-full sm:w-[240px]">
          <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
            <CalendarDays className="h-3.5 w-3.5 text-primary" /> Período
          </Label>
          <Select value={currentPeriod} onValueChange={(val) => setParam('period', val)}>
            <SelectTrigger className={`w-full ${fieldClass}`}>
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
            <SelectContent className="rounded-lg border border-border bg-popover">
              <SelectItem value="today" className="rounded-md py-2 cursor-pointer text-xs">Hoje</SelectItem>
              <SelectItem value="week" className="rounded-md py-2 cursor-pointer text-xs">Esta Semana</SelectItem>
              <SelectItem value="month" className="rounded-md py-2 cursor-pointer text-xs">Este Mês</SelectItem>
              <SelectItem value="last7" className="rounded-md py-2 cursor-pointer text-xs">Últimos 7 dias</SelectItem>
              <SelectItem value="last15" className="rounded-md py-2 cursor-pointer text-xs">Últimos 15 dias</SelectItem>
              <SelectItem value="last30" className="rounded-md py-2 cursor-pointer text-xs">Últimos 30 dias</SelectItem>
              <SelectItem value="last90" className="rounded-md py-2 cursor-pointer text-xs">Últimos 90 dias</SelectItem>
              <SelectItem value="last180" className="rounded-md py-2 cursor-pointer text-xs">Últimos 180 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 w-full sm:w-[240px]">
          <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
            <Layers className="h-3.5 w-3.5 text-primary" /> Área
          </Label>
          <Select value={currentArea} onValueChange={(val) => setParam('area', val)}>
            <SelectTrigger className={`w-full ${fieldClass}`}>
              <SelectValue placeholder="Todas as áreas">
                {currentArea === 'all' ? 'Todas as Áreas' : areas.find(a => a.id === currentArea)?.nome || 'Todas as áreas'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="rounded-lg border border-border bg-popover">
              <SelectItem value="all" className="rounded-md py-2 cursor-pointer text-xs font-bold">Todas as Áreas</SelectItem>
              {areas.map(area => (
                <SelectItem key={area.id} value={area.id} className="rounded-md py-2 cursor-pointer text-xs">
                  {area.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
