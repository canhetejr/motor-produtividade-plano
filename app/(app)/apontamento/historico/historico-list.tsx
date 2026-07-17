'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { formatarDataCompletaBR } from '@/lib/dates'
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
    setLoadingId(id)
    const result = await deleteApontamento(id)
    setLoadingId(null)

    if (result.ok) {
      toast.success('Apontamento excluído.')
    } else {
      toast.error(result.error)
    }
  }

  if (apontamentos.length === 0) {
    return <p className="text-center text-muted-foreground py-8">Nenhum apontamento encontrado.</p>
  }

  return (
    <div className="space-y-4">
      {apontamentos.map((ap) => {
        const canDelete = ap.data === today

        return (
          <div key={ap.id} className="flex items-center justify-between gap-3 p-4 border rounded-lg bg-card">
            <div>
              <p className="font-medium text-lg">{ap.demanda_nome}</p>
              <div className="text-sm text-muted-foreground space-x-4">
                <span>Data: {formatarDataCompletaBR(ap.data)}</span>
                <span>Qtd: {ap.quantidade}</span>
                <span>Tempo: {ap.tempo_total_min} min</span>
              </div>
              {ap.observacoes && (
                <p className="text-sm mt-1 italic text-muted-foreground">Obs: {ap.observacoes}</p>
              )}
            </div>

            {canDelete && (
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button variant="destructive" size="sm" disabled={loadingId === ap.id}>
                      {loadingId === ap.id ? 'Excluindo...' : 'Excluir'}
                    </Button>
                  }
                />
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir apontamento?</AlertDialogTitle>
                    <AlertDialogDescription>
                      &ldquo;{ap.demanda_nome}&rdquo; ({ap.tempo_total_min} min) será removido. Essa ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogClose render={<Button variant="outline">Cancelar</Button>} />
                    <AlertDialogClose
                      render={
                        <Button variant="destructive" onClick={() => handleDelete(ap.id)}>
                          Excluir
                        </Button>
                      }
                    />
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        )
      })}
    </div>
  )
}
