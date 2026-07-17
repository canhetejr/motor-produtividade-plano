'use client'

import { useState } from 'react'
import { createArea, updateArea, createDemanda, updateDemanda } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Area = { id: string; nome: string }
type Demanda = { id: string; area_id: string; nome: string; tempo_padrao_min: number | null; variavel: boolean; ativo: boolean; blocos_totais: number }

export function CatalogoManager({ areas, demandas }: { areas: Area[], demandas: Demanda[] }) {
  const [selectedArea, setSelectedArea] = useState<string>(areas[0]?.id || '')

  const demandasFiltradas = demandas.filter(d => d.area_id === selectedArea)
  const currentAreaObj = areas.find(a => a.id === selectedArea)

  async function handleCreateArea(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    await createArea(formData)
  }

  async function handleUpdateArea(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!selectedArea) return
    const formData = new FormData(e.currentTarget)
    await updateArea(selectedArea, formData)
  }

  async function handleCreateDemanda(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!selectedArea) return alert('Selecione uma área primeiro')
    const formData = new FormData(e.currentTarget)
    formData.set('area_id', selectedArea)
    await createDemanda(formData)
  }

  async function handleUpdateDemanda(id: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    await updateDemanda(id, formData)
  }

  return (
    <div className="space-y-8">
      <div className="bg-card border p-4 rounded-lg">
        <div className="flex items-center justify-between mb-4">
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
            
            {/* Create Area */}
            <Dialog>
              <DialogTrigger render={<Button variant="outline">Nova Área</Button>} />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cadastrar Área</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateArea} className="space-y-4">
                  <div>
                    <Label>Nome da Área</Label>
                    <Input name="nome" required />
                  </div>
                  <Button type="submit" className="w-full">Salvar Área</Button>
                </form>
              </DialogContent>
            </Dialog>

            {/* Edit Area */}
            {currentAreaObj && (
              <Dialog>
                <DialogTrigger render={<Button variant="outline">Editar Área</Button>} />
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Editar Área</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleUpdateArea} className="space-y-4">
                    <div>
                      <Label>Nome da Área</Label>
                      <Input name="nome" defaultValue={currentAreaObj.nome} required />
                    </div>
                    <Button type="submit" className="w-full">Atualizar Área</Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <div className="mb-4">
          <Dialog>
            <DialogTrigger render={<Button>+ Nova Demanda</Button>} />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cadastrar Demanda</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateDemanda} className="space-y-4">
                <div>
                  <Label>Nome</Label>
                  <Input name="nome" required />
                </div>
                <div>
                  <Label>Tempo Padrão (minutos)</Label>
                  <Input name="tempo_padrao_min" type="number" placeholder="Deixe em branco se variável" />
                </div>
                <div>
                  <Label>Total de Blocos</Label>
                  <Input name="blocos_totais" type="number" min="1" defaultValue={1} required />
                  <p className="text-xs text-muted-foreground mt-1">Divida demandas longas em blocos. Ex: 2400 min / 20 blocos.</p>
                </div>
                <div className="flex items-center justify-between">
                  <Label>É Variável? (Ex: Outros)</Label>
                  <Switch name="variavel" />
                </div>
                <Button type="submit" className="w-full">Salvar Demanda</Button>
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
                    <Dialog>
                      <DialogTrigger render={<Button variant="outline" size="sm">Editar</Button>} />
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Editar Demanda</DialogTitle>
                        </DialogHeader>
                        <form key={JSON.stringify(d)} onSubmit={(e) => handleUpdateDemanda(d.id, e)} className="space-y-4">
                          <div>
                            <Label>Nome</Label>
                            <Input name="nome" defaultValue={d.nome} required />
                          </div>
                          <div>
                            <Label>Tempo Padrão Total (minutos)</Label>
                            <Input name="tempo_padrao_min" type="number" defaultValue={d.tempo_padrao_min ?? ''} />
                          </div>
                          <div>
                            <Label>Total de Blocos</Label>
                            <Input name="blocos_totais" type="number" min="1" defaultValue={d.blocos_totais} required />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label>É Variável?</Label>
                            <Switch name="variavel" defaultChecked={d.variavel} />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label>Ativo</Label>
                            <Switch name="ativo" defaultChecked={d.ativo} />
                          </div>
                          <Button type="submit" className="w-full">Atualizar</Button>
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
