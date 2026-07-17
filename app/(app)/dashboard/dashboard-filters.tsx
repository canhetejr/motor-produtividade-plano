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

  const handlePeriodChange = (val: string | null) => {
    if (!val) return
    const params = new URLSearchParams(searchParams.toString())
    params.set('period', val)
    router.push(`?${params.toString()}`)
  }

  const handleAreaChange = (val: string | null) => {
    if (!val) return
    const params = new URLSearchParams(searchParams.toString())
    params.set('area', val)
    router.push(`?${params.toString()}`)
  }

  const handleRefresh = async () => {
    try {
      const res = await fetch('/api/cron?token=cron_motor_secret_2026')
      if (res.ok) {
        alert('Indicadores consolidados com sucesso!')
        router.refresh()
      } else {
        alert('Falha ao consolidar indicadores.')
      }
    } catch (err) {
      console.error(err)
      alert('Erro na requisição.')
    }
  }

  return (
    <div className="flex flex-col sm:flex-row items-end gap-4 bg-card p-4 rounded-lg border">
      <div className="flex flex-col gap-1.5 flex-1 w-full">
        <Label>Período</Label>
        <Select value={currentPeriod} onValueChange={handlePeriodChange}>
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
        <Select value={currentArea} onValueChange={handleAreaChange}>
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

      <div className="w-full sm:w-auto">
        <button 
          onClick={handleRefresh}
          className="h-10 px-4 bg-primary text-primary-foreground font-semibold rounded-md hover:bg-primary/90 transition-colors w-full sm:w-auto"
        >
          Forçar Fechamento
        </button>
      </div>
    </div>
  )
}
