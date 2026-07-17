'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createArea, updateArea, createDemanda, updateDemanda } from './actions'
import type { ActionResult } from '@/lib/action-result'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'

type Area = { id: string; nome: string }
type Demanda = { id: string; area_id: string; nome: string; tempo_padrao_min: number | null; variavel: boolean; ativo: boolean; blocos_totais: number }

function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </Button>
  )
}

export function CatalogoManager({ areas, demandas }: { areas: Area[], demandas: Demanda[] }) {
  const [selectedArea, setSelectedArea] = useState<string>(areas[0]?.id || '')
  const [isPending, startTransition] = useTransition()

  // um estado por dialog; o de edição de demanda guarda o id da linha aberta
  const [createAreaOpen, setCreateAreaOpen] = useState(false)
  const [editAreaOpen, setEditAreaOpen] = useState(false)
  const [createDemandaOpen, setCreateDemandaOpen] = useState(false)
  const [editDemandaId, setEditDemandaId] = useState<string | null>(null)

  const demandasFiltradas = demandas.filter(d => d.area_id === selectedArea)
  const currentAreaObj = areas.find(a => a.id === selectedArea)

  function submit(
    e: React.FormEvent<HTMLFormElement>,
    action: (formData: FormData) => Promise<ActionResult>,
    successMsg: string,
    close: () => void
  ) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await action(formData)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(successMsg)
      close()
    })
  }

  return (
    <div className="space-y-8">
      <div className="bg-card border p-4 rounded-lg">
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <h2 className="text-xl font-bold">Gerenciar Demandas por Área</h2>
          <div className="flex gap-2 items-center flex-wrap">
            <div className="w-48 sm:w-64">
              <Select value={selectedArea} onValueChange={(val) => setSelectedArea(val || '')}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione a área">
                    <span className="truncate block">{currentAreaObj?.nome || "Selecione a área"}</span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {areas.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Nova área */}
            <Dialog open={createAreaOpen} onOpenChange={setCreateAreaOpen}>
              <DialogTrigger render={<Button variant="outline">Nova Área</Button>} />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cadastrar Área</DialogTitle>
                </DialogHeader>
                <form
                  onSubmit={(e) => submit(e, createArea, 'Área criada!', () => setCreateAreaOpen(false))}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="nova-area-nome">Nome da Área</Label>
                    <Input id="nova-area-nome" name="nome" required />
                  </div>
                  <SubmitButton pending={isPending}>Salvar Área</SubmitButton>
                </form>
              </DialogContent>
            </Dialog>

            {/* Editar área */}
            {currentAreaObj && (
              <Dialog open={editAreaOpen} onOpenChange={setEditAreaOpen}>
                <DialogTrigger render={<Button variant="outline">Editar Área</Button>} />
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Editar Área</DialogTitle>
                  </DialogHeader>
                  <form
                    key={currentAreaObj.id}
                    onSubmit={(e) =>
                      submit(
                        e,
                        (fd) => updateArea(currentAreaObj.id, fd),
                        'Área atualizada!',
                        () => setEditAreaOpen(false)
                      )
                    }
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="editar-area-nome">Nome da Área</Label>
                      <Input id="editar-area-nome" name="nome" defaultValue={currentAreaObj.nome} required />
                    </div>
                    <SubmitButton pending={isPending}>Atualizar Área</SubmitButton>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <div className="mb-4">
          <Dialog open={createDemandaOpen} onOpenChange={setCreateDemandaOpen}>
            <DialogTrigger render={<Button>+ Nova Demanda</Button>} />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cadastrar Demanda</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  if (!selectedArea) {
                    e.preventDefault()
                    toast.error('Selecione uma área primeiro')
                    return
                  }
                  submit(
                    e,
                    (fd) => {
                      fd.set('area_id', selectedArea)
                      return createDemanda(fd)
                    },
                    'Demanda criada!',
                    () => setCreateDemandaOpen(false)
                  )
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="nova-demanda-nome">Nome</Label>
                  <Input id="nova-demanda-nome" name="nome" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nova-demanda-tempo">Tempo Padrão (minutos)</Label>
                  <Input id="nova-demanda-tempo" name="tempo_padrao_min" type="number" min="1" placeholder="Deixe em branco se variável" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nova-demanda-blocos">Total de Blocos</Label>
                  <Input id="nova-demanda-blocos" name="blocos_totais" type="number" min="1" defaultValue={1} required />
                  <p className="text-xs text-muted-foreground">Divida demandas longas em blocos. Ex: 2400 min / 20 blocos.</p>
                </div>
                <div className="flex items-center justify-between">
                  <Label>É Variável? (Ex: Outros)</Label>
                  <Switch name="variavel" />
                </div>
                <SubmitButton pending={isPending}>Salvar Demanda</SubmitButton>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tempo Padrão</TableHead>
                <TableHead>Qtd. Blocos</TableHead>
                <TableHead>Variável</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead>Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {demandasFiltradas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">Nenhuma demanda cadastrada nesta área.</TableCell>
                </TableRow>
              ) : demandasFiltradas.map(d => (
                <TableRow key={d.id}>
                  <TableCell>{d.nome}</TableCell>
                  <TableCell>{d.tempo_padrao_min || '-'}</TableCell>
                  <TableCell>{d.blocos_totais}</TableCell>
                  <TableCell>{d.variavel ? 'Sim' : 'Não'}</TableCell>
                  <TableCell>{d.ativo ? 'Sim' : 'Não'}</TableCell>
                  <TableCell>
                    <Dialog
                      open={editDemandaId === d.id}
                      onOpenChange={(open) => setEditDemandaId(open ? d.id : null)}
                    >
                      <DialogTrigger render={<Button variant="outline" size="sm">Editar</Button>} />
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Editar Demanda</DialogTitle>
                        </DialogHeader>
                        <form
                          key={JSON.stringify(d)}
                          onSubmit={(e) =>
                            submit(
                              e,
                              (fd) => updateDemanda(d.id, fd),
                              'Demanda atualizada!',
                              () => setEditDemandaId(null)
                            )
                          }
                          className="space-y-4"
                        >
                          <div className="space-y-2">
                            <Label htmlFor={`demanda-nome-${d.id}`}>Nome</Label>
                            <Input id={`demanda-nome-${d.id}`} name="nome" defaultValue={d.nome} required />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`demanda-tempo-${d.id}`}>Tempo Padrão Total (minutos)</Label>
                            <Input id={`demanda-tempo-${d.id}`} name="tempo_padrao_min" type="number" min="1" defaultValue={d.tempo_padrao_min ?? ''} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`demanda-blocos-${d.id}`}>Total de Blocos</Label>
                            <Input id={`demanda-blocos-${d.id}`} name="blocos_totais" type="number" min="1" defaultValue={d.blocos_totais} required />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label>É Variável?</Label>
                            <Switch name="variavel" defaultChecked={d.variavel} />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label>Ativo</Label>
                            <Switch name="ativo" defaultChecked={d.ativo} />
                          </div>
                          <SubmitButton pending={isPending}>Atualizar</SubmitButton>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
