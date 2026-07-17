'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { deleteApontamento } from './actions'

type Apontamento = {
  id: string
  data: string
  quantidade: number
  observacoes: string | null
  tempo_total_min: number
  demanda_nome: string
}

export function HistoricoList({ apontamentos, today }: { apontamentos: Apontamento[], today: string }) {
  const [loadingId, setLoadingId] = useState<string | null>(null)

  async function handleDelete(id: string) {
    if (!confirm('Tem certeza que deseja excluir este apontamento?')) return

    setLoadingId(id)
    const result = await deleteApontamento(id)
    
    if (result?.error) {
      alert(result.error)
    }
    setLoadingId(null)
  }

  if (apontamentos.length === 0) {
    return <p className="text-center text-muted-foreground py-8">Nenhum apontamento encontrado.</p>
  }

  return (
    <div className="space-y-4">
      {apontamentos.map((ap) => {
        const canDelete = ap.data === today

        return (
          <div key={ap.id} className="flex items-center justify-between p-4 border rounded-lg bg-card">
            <div>
              <p className="font-medium text-lg">{ap.demanda_nome}</p>
              <div className="text-sm text-muted-foreground space-x-4">
                <span>Data: {new Date(ap.data).toLocaleDateString('pt-BR')}</span>
                <span>Qtd: {ap.quantidade}</span>
                <span>Tempo: {ap.tempo_total_min} min</span>
              </div>
              {ap.observacoes && (
                <p className="text-sm mt-1 italic text-muted-foreground">Obs: {ap.observacoes}</p>
              )}
            </div>
            
            {canDelete && (
              <Button 
                variant="destructive" 
                size="sm"
                disabled={loadingId === ap.id}
                onClick={() => handleDelete(ap.id)}
              >
                {loadingId === ap.id ? 'Excluindo...' : 'Excluir'}
              </Button>
            )}
          </div>
        )
      })}
    </div>
  )
}
