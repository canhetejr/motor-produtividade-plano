'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function RelatoriosForm() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

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
    // navegação direta dispara o download do CSV
    window.location.href = `/api/export?start=${startDate}&end=${endDate}`
  }

  return (
    <div className="bg-card border p-4 md:p-8 rounded-lg max-w-xl">
      <h2 className="text-xl font-bold mb-4">Exportar Apontamentos</h2>

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

        <Button type="submit" className="w-full">
          Baixar CSV
        </Button>
      </form>
    </div>
  )
}
