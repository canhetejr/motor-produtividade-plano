'use client'

import { updateColaborador } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Area = { id: string; nome: string }
type Colaborador = { id: string; nome: string; area_id: string | null; carga_horaria_min: number; role: string; ativo: boolean }

export function ColaboradoresManager({ areas, colaboradores }: { areas: Area[], colaboradores: Colaborador[] }) {

  async function handleUpdate(id: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    await updateColaborador(id, formData)
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    // we import createColaborador dynamically or add it to the top
    const { createColaborador } = await import('./actions')
    const result = await createColaborador(formData)
    if (result.error) {
      alert(result.error)
    } else {
      alert('Colaborador adicionado com sucesso!')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end mb-4">
        <Dialog>
          <DialogTrigger render={<Button>+ Novo Colaborador</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Colaborador</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <Label>E-mail</Label>
                <Input name="email" type="email" required placeholder="email@empresa.com" />
              </div>
              <div>
                <Label>Senha Temporária</Label>
                <Input name="password" type="text" required placeholder="Mínimo 6 caracteres" minLength={6} />
              </div>
              <div>
                <Label>Nome</Label>
                <Input name="nome" required placeholder="Nome Completo" />
              </div>
              
              <div className="space-y-2">
                <Label>Área</Label>
                <Select name="area_id" required>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione a área" />
                  </SelectTrigger>
                  <SelectContent>
                    {areas.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Carga Horária (minutos)</Label>
                <Input name="carga_horaria_min" type="number" defaultValue={480} required />
              </div>

              <div className="space-y-2">
                <Label>Perfil</Label>
                <Select name="role" defaultValue="colaborador" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o perfil" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="colaborador">Colaborador</SelectItem>
                    <SelectItem value="gestor">Gestor</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" className="w-full">Criar Conta</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card border p-4 rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Área</TableHead>
              <TableHead>Carga Horária (min)</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead>Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {colaboradores.map(c => {
              const areaNome = areas.find(a => a.id === c.area_id)?.nome || 'Sem área'
              return (
                <TableRow key={c.id}>
                  <TableCell>{c.nome}</TableCell>
                  <TableCell>{areaNome}</TableCell>
                  <TableCell>{c.carga_horaria_min}</TableCell>
                  <TableCell className="capitalize">{c.role}</TableCell>
                  <TableCell>{c.ativo ? 'Sim' : 'Não'}</TableCell>
                  <TableCell>
                    <Dialog>
                      <DialogTrigger render={<Button variant="outline" size="sm">Editar</Button>} />
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Editar Colaborador</DialogTitle>
                        </DialogHeader>
                        <form key={JSON.stringify(c)} onSubmit={(e) => handleUpdate(c.id, e)} className="space-y-4">
                          <div>
                            <Label>Nome</Label>
                            <Input name="nome" defaultValue={c.nome} required />
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Área</Label>
                            <Select name="area_id" defaultValue={c.area_id || ''}>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Selecione a área">
                                  <span className="truncate block">{c.area_id ? areas.find(a => a.id === c.area_id)?.nome : 'Selecione a área'}</span>
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {areas.map(a => (
                                  <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label>Carga Horária (minutos)</Label>
                            <Input name="carga_horaria_min" type="number" defaultValue={c.carga_horaria_min} required />
                          </div>

                          <div className="space-y-2">
                            <Label>Perfil</Label>
                            <Select name="role" defaultValue={c.role}>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Selecione o perfil">
                                  <span className="truncate block capitalize">{c.role}</span>
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="colaborador">Colaborador</SelectItem>
                                <SelectItem value="gestor">Gestor</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="flex items-center justify-between">
                            <Label>Ativo</Label>
                            <Switch name="ativo" defaultChecked={c.ativo} />
                          </div>
                          <Button type="submit" className="w-full">Atualizar Perfil</Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
