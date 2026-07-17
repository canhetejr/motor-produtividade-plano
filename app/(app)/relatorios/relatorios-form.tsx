'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function RelatoriosForm() {
  const [loading, setLoading] = useState(false)

  const handleExport = () => {
    setLoading(true)
    const startDate = (document.getElementById('start_date') as HTMLInputElement).value
    const endDate = (document.getElementById('end_date') as HTMLInputElement).value

    if (!startDate || !endDate) {
      alert('Por favor, selecione as datas de início e fim.')
      setLoading(false)
      return
    }

    // Redirect to the API route to trigger download
    window.location.href = `/api/export?start=${startDate}&end=${endDate}`
    setLoading(false)
  }

  return (
    <div className="bg-card border p-4 md:p-8 rounded-lg max-w-xl">
      <h2 className="text-xl font-bold mb-4">Exportar Apontamentos</h2>
      
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="start_date">Data Inicial</Label>
            <Input id="start_date" type="date" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end_date">Data Final</Label>
            <Input id="end_date" type="date" required />
          </div>
        </div>

        <Button onClick={handleExport} className="w-full" disabled={loading}>
          {loading ? 'Processando...' : 'Baixar CSV'}
        </Button>
      </div>
    </div>
  )
}
