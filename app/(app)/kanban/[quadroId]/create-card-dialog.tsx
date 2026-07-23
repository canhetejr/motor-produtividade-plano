'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { criarCartao } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, Users } from 'lucide-react'
import type { MembroQuadro } from './types'

export function CreateCardDialog({
  colunaId,
  quadroId,
  membros,
  onClose,
}: {
  colunaId: string | null
  quadroId: string
  membros: MembroQuadro[]
  onClose: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [prioridade, setPrioridade] = useState('media')
  const [responsaveis, setResponsaveis] = useState<string[]>([])

  function handleOpenChange(open: boolean) {
    if (!open) {
      onClose()
      setPrioridade('media')
      setResponsaveis([])
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!colunaId) return
    const formData = new FormData(e.currentTarget)
    formData.set('prioridade', prioridade)
    responsaveis.forEach((id) => formData.append('responsaveis', id))
    startTransition(async () => {
      const result = await criarCartao(colunaId, quadroId, formData)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Card criado!')
      handleOpenChange(false)
    })
  }

  return (
    <Dialog open={!!colunaId} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Card</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 py-2">
          <div className="space-y-2">
            <Label htmlFor="novo-card-titulo">Título</Label>
            <Input id="novo-card-titulo" name="titulo" autoFocus required placeholder="Ex: Revisar orçamento" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="novo-card-descricao">Descrição (opcional)</Label>
            <Textarea id="novo-card-descricao" name="descricao" rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={(value) => setPrioridade(value ?? 'media')}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="novo-card-prazo">Prazo (opcional)</Label>
              <Input id="novo-card-prazo" name="prazo" type="date" />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" /> Responsáveis
            </Label>
            <div className="max-h-32 overflow-y-auto rounded-lg border border-border p-2 space-y-1">
              {membros.length === 0 ? (
                <p className="text-xs text-muted-foreground p-2">Nenhum membro vinculado a este quadro.</p>
              ) : (
                membros.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer text-sm">
                    <Checkbox
                      checked={responsaveis.includes(m.id)}
                      onCheckedChange={(checked) =>
                        setResponsaveis((prev) => (checked ? [...prev, m.id] : prev.filter((id) => id !== m.id)))
                      }
                    />
                    {m.nome}
                  </label>
                ))
              )}
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar Card'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
