'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { subDays, format as formatDate } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { hoje, inicioSemana, inicioMes } from '@/lib/dates'

type PresetKey = 'hoje' | 'semana' | 'mes' | 'last7' | 'last30'

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'hoje', label: 'Hoje' },
  { key: 'semana', label: 'Esta Semana' },
  { key: 'mes', label: 'Este Mês' },
  { key: 'last7', label: 'Últimos 7 dias' },
  { key: 'last30', label: 'Últimos 30 dias' },
]

function presetRange(key: PresetKey): { start: string; end: string } {
  const end = hoje()
  switch (key) {
    case 'hoje':
      return { start: end, end }
    case 'semana':
      return { start: inicioSemana(), end }
    case 'mes':
      return { start: inicioMes(), end }
    case 'last7':
      return { start: formatDate(subDays(new Date(end), 7), 'yyyy-MM-dd'), end }
    case 'last30':
      return { start: formatDate(subDays(new Date(end), 30), 'yyyy-MM-dd'), end }
  }
}

export function RelatoriosForm() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [format, setFormat] = useState<'csv' | 'xlsx'>('csv')

  function aplicarPreset(key: PresetKey) {
    const { start, end } = presetRange(key)
    setStartDate(start)
    setEndDate(end)
  }

  const handleExport = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!startDate || !endDate) {
      toast.error('Selecione as datas de início e fim.')
      return
    }
    if (startDate > endDate) {
      toast.error('A data inicial deve ser anterior à final.')
      return
    }
    // navegação direta dispara o download
    window.location.href = `/api/export?start=${startDate}&end=${endDate}&format=${format}`
  }

  return (
    <div className="bg-card border p-4 md:p-8 rounded-lg max-w-xl">
      <h2 className="text-xl font-bold mb-4">Exportar Apontamentos</h2>

      <div className="flex flex-wrap gap-2 mb-4">
        {PRESETS.map((p) => (
          <Button key={p.key} type="button" size="sm" variant="outline" onClick={() => aplicarPreset(p.key)}>
            {p.label}
          </Button>
        ))}
      </div>

      <form onSubmit={handleExport} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="start_date">Data Inicial</Label>
            <Input
              id="start_date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end_date">Data Final</Label>
            <Input
              id="end_date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Formato</Label>
          <Select value={format} onValueChange={(val) => setFormat(val === 'xlsx' ? 'xlsx' : 'csv')}>
            <SelectTrigger className="w-full">
              <SelectValue>{format === 'xlsx' ? 'Excel (.xlsx)' : 'CSV'}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">CSV</SelectItem>
              <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button type="submit" className="w-full">
          Baixar {format === 'xlsx' ? 'XLSX' : 'CSV'}
        </Button>
      </form>
    </div>
  )
}
