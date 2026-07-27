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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Pencil } from 'lucide-react'
import { formatarDataCompletaBR } from '@/lib/dates'
import { formatarTempo } from '@/lib/tempo'
import { deleteApontamento } from './actions'
import { ApontamentoForm } from '../apontamento-form'

type Apontamento = {
  id: string
  data: string
  demanda_id: string
  quantidade: number
  tempo_manual_min: number | null
  motivo: string | null
  observacoes: string | null
  tempo_total_min: number
  demanda_nome: string
}

type Demanda = {
  id: string
  nome: string
  variavel: boolean
  tempo_padrao_min: number | null
  blocos_totais: number
}

export function HistoricoList({
  apontamentos,
  today,
  demandas,
  cargaHorariaMin,
}: {
  apontamentos: Apontamento[]
  today: string
  demandas: Demanda[]
  cargaHorariaMin: number
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

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
                <span>Tempo: {formatarTempo(ap.tempo_total_min)}</span>
                {ap.motivo && <span>Motivo: {ap.motivo}</span>}
              </div>
              {ap.observacoes && (
                <p className="text-sm mt-1 italic text-muted-foreground">Obs: {ap.observacoes}</p>
              )}
            </div>

            {canDelete && (
              <div className="flex items-center gap-2 shrink-0">
                <Dialog open={editingId === ap.id} onOpenChange={(open) => setEditingId(open ? ap.id : null)}>
                  <Button variant="outline" size="sm" onClick={() => setEditingId(ap.id)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                  </Button>
                  <DialogContent className="sm:max-w-lg p-0 bg-transparent ring-0">
                    <DialogHeader className="sr-only">
                      <DialogTitle>Editar apontamento</DialogTitle>
                    </DialogHeader>
                    <ApontamentoForm
                      demandas={demandas}
                      cargaHorariaMin={cargaHorariaMin}
                      apontamentoId={ap.id}
                      initialValues={{
                        demanda_id: ap.demanda_id,
                        quantidade: ap.quantidade,
                        tempo_manual_min: ap.tempo_manual_min,
                        motivo: ap.motivo,
                        observacoes: ap.observacoes,
                      }}
                      onSaved={() => setEditingId(null)}
                    />
                  </DialogContent>
                </Dialog>

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
                        &ldquo;{ap.demanda_nome}&rdquo; ({formatarTempo(ap.tempo_total_min)}) será removido. Essa ação não pode ser desfeita.
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
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
