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

  const fieldClass = 'bg-secondary/40 hover:bg-secondary/70 border-input transition-colors focus:border-primary rounded-none h-10 text-xs font-medium'

  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="bg-card border border-border shadow-xs rounded-none p-5 relative overflow-hidden group"
    >
      <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-border">
        <div className="h-8 w-8 bg-primary/10 text-primary rounded-none flex items-center justify-center font-bold border border-primary/20 shrink-0">
          <Filter className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-base font-bold tracking-tight text-foreground">Filtros de Análise</h3>
          <p className="text-xs text-muted-foreground">Filtre os dados por período de tempo e área da equipe</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-end gap-5">
        <div className="space-y-2 w-full sm:w-[240px]">
          <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground/90">
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
            <SelectContent className="rounded-none border border-border shadow-md bg-popover">
              <SelectItem value="today" className="rounded-none py-2 cursor-pointer text-xs">Hoje</SelectItem>
              <SelectItem value="week" className="rounded-none py-2 cursor-pointer text-xs">Esta Semana</SelectItem>
              <SelectItem value="month" className="rounded-none py-2 cursor-pointer text-xs">Este Mês</SelectItem>
              <SelectItem value="last7" className="rounded-none py-2 cursor-pointer text-xs">Últimos 7 dias</SelectItem>
              <SelectItem value="last15" className="rounded-none py-2 cursor-pointer text-xs">Últimos 15 dias</SelectItem>
              <SelectItem value="last30" className="rounded-none py-2 cursor-pointer text-xs">Últimos 30 dias</SelectItem>
              <SelectItem value="last90" className="rounded-none py-2 cursor-pointer text-xs">Últimos 90 dias</SelectItem>
              <SelectItem value="last180" className="rounded-none py-2 cursor-pointer text-xs">Últimos 180 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 w-full sm:w-[240px]">
          <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground/90">
            <Layers className="h-3.5 w-3.5 text-primary" /> Área
          </Label>
          <Select value={currentArea} onValueChange={(val) => setParam('area', val)}>
            <SelectTrigger className={`w-full ${fieldClass}`}>
              <SelectValue placeholder="Todas as áreas">
                {currentArea === 'all' ? 'Todas as Áreas' : areas.find(a => a.id === currentArea)?.nome || 'Todas as áreas'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="rounded-none border border-border shadow-md bg-popover">
              <SelectItem value="all" className="rounded-none py-2 cursor-pointer text-xs font-bold">Todas as Áreas</SelectItem>
              {areas.map(area => (
                <SelectItem key={area.id} value={area.id} className="rounded-none py-2 cursor-pointer text-xs">
                  {area.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground mt-4 pt-3 border-t border-border/50">
        O filtro de área usa a área atual do colaborador — se alguém mudou de área, os
        apontamentos de antes da mudança continuam contados aqui. O CSV de{' '}
        <span className="font-medium text-foreground">/relatorios</span> atribui cada apontamento pela
        área da demanda no momento do lançamento.
      </p>
    </motion.div>
  )
}
