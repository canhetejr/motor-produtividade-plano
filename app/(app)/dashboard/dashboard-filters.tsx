'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'

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
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="flex flex-col sm:flex-row items-end gap-4 bg-card p-4 rounded-lg border">
      <div className="flex flex-col gap-1.5 flex-1 w-full">
        <Label>Período</Label>
        <Select value={currentPeriod} onValueChange={(val) => setParam('period', val)}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o período">
              {currentPeriod === 'today' ? 'Hoje' : currentPeriod === 'week' ? 'Esta Semana' : currentPeriod === 'month' ? 'Este Mês' : 'Selecione o período'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="week">Esta Semana</SelectItem>
            <SelectItem value="month">Este Mês</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5 flex-1 w-full">
        <Label>Área</Label>
        <Select value={currentArea} onValueChange={(val) => setParam('area', val)}>
          <SelectTrigger>
            <SelectValue placeholder="Todas as áreas">
              {currentArea === 'all' ? 'Todas as Áreas' : areas.find(a => a.id === currentArea)?.nome || 'Todas as áreas'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Áreas</SelectItem>
            {areas.map(area => (
              <SelectItem key={area.id} value={area.id}>{area.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
