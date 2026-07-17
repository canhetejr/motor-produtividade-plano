'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createColaborador, updateColaborador } from './actions'
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
type Colaborador = { id: string; nome: string; area_id: string | null; carga_horaria_min: number; role: string; ativo: boolean }

function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </Button>
  )
}

export function ColaboradoresManager({ areas, colaboradores }: { areas: Area[], colaboradores: Colaborador[] }) {
  const [isPending, startTransition] = useTransition()
  const [createOpen, setCreateOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

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
    <div className="space-y-4">
      <div className="flex justify-end mb-4">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button>+ Novo Colaborador</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Colaborador</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => submit(e, createColaborador, 'Colaborador criado!', () => setCreateOpen(false))}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="novo-colab-email">E-mail</Label>
                <Input id="novo-colab-email" name="email" type="email" required placeholder="email@empresa.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="novo-colab-senha">Senha Temporária</Label>
                <Input id="novo-colab-senha" name="password" type="text" required placeholder="Mínimo 6 caracteres" minLength={6} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="novo-colab-nome">Nome</Label>
                <Input id="novo-colab-nome" name="nome" required placeholder="Nome Completo" />
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

              <div className="space-y-2">
                <Label htmlFor="novo-colab-carga">Carga Horária (minutos)</Label>
                <Input id="novo-colab-carga" name="carga_horaria_min" type="number" min="1" defaultValue={480} required />
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

              <SubmitButton pending={isPending}>Criar Conta</SubmitButton>
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
                    <Dialog
                      open={editId === c.id}
                      onOpenChange={(open) => setEditId(open ? c.id : null)}
                    >
                      <DialogTrigger render={<Button variant="outline" size="sm">Editar</Button>} />
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Editar Colaborador</DialogTitle>
                        </DialogHeader>
                        <form
                          key={JSON.stringify(c)}
                          onSubmit={(e) =>
                            submit(
                              e,
                              (fd) => updateColaborador(c.id, fd),
                              'Perfil atualizado!',
                              () => setEditId(null)
                            )
                          }
                          className="space-y-4"
                        >
                          <div className="space-y-2">
                            <Label htmlFor={`colab-nome-${c.id}`}>Nome</Label>
                            <Input id={`colab-nome-${c.id}`} name="nome" defaultValue={c.nome} required />
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

                          <div className="space-y-2">
                            <Label htmlFor={`colab-carga-${c.id}`}>Carga Horária (minutos)</Label>
                            <Input id={`colab-carga-${c.id}`} name="carga_horaria_min" type="number" min="1" defaultValue={c.carga_horaria_min} required />
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
                          <SubmitButton pending={isPending}>Atualizar Perfil</SubmitButton>
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
