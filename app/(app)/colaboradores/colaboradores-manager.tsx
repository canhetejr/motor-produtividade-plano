'use client'

import { useState, useTransition, useMemo } from 'react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { createColaborador, updateColaborador } from './actions'
import type { ActionResult } from '@/lib/action-result'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, PlusCircle, Search, Edit2, ShieldAlert, User, ShieldCheck } from 'lucide-react'

type Area = { id: string; nome: string }
type Colaborador = { id: string; nome: string; area_id: string | null; carga_horaria_min: number; role: string; ativo: boolean }

function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" className="w-full relative overflow-hidden group" disabled={pending}>
      <div className="absolute inset-0 bg-primary-foreground/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
      <span className="relative flex items-center justify-center gap-2">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
      </span>
    </Button>
  )
}

function getInitials(name: string) {
  const parts = name.trim().split(' ').filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function ColaboradoresManager({ areas, colaboradores }: { areas: Area[], colaboradores: Colaborador[] }) {
  const [isPending, startTransition] = useTransition()
  const [createOpen, setCreateOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const filteredColaboradores = useMemo(() => {
    if (!searchTerm.trim()) return colaboradores
    const lower = searchTerm.toLowerCase()
    return colaboradores.filter(c => c.nome.toLowerCase().includes(lower))
  }, [colaboradores, searchTerm])

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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nome..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-card/50 border-border/50 focus:border-primary/50 transition-colors"
          />
        </div>
        
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button className="w-full sm:w-auto gap-2 shadow-lg shadow-primary/20" />}>
            <PlusCircle className="h-4 w-4" /> Novo Colaborador
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="h-8 w-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                  <User className="h-5 w-5" />
                </div>
                Adicionar Colaborador
              </DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => submit(e, createColaborador, 'Colaborador criado!', () => setCreateOpen(false))}
              className="space-y-5 py-2"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="novo-colab-nome">Nome</Label>
                  <Input id="novo-colab-nome" name="nome" required placeholder="Nome Completo" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="novo-colab-email">E-mail</Label>
                  <Input id="novo-colab-email" name="email" type="email" required placeholder="email@empresa.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="novo-colab-senha">Senha Temporária</Label>
                  <Input id="novo-colab-senha" name="password" type="text" required placeholder="Mínimo 6 caracteres" minLength={6} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="novo-colab-carga">Carga Horária (min)</Label>
                  <Input id="novo-colab-carga" name="carga_horaria_min" type="number" min="1" defaultValue={480} required />
                </div>
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
                <Label>Perfil de Acesso</Label>
                <Select name="role" defaultValue="colaborador" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o perfil" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="colaborador">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>Colaborador</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="gestor">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4 text-primary" />
                        <span>Gestor</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <SubmitButton pending={isPending}>Criar Conta</SubmitButton>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card/80 backdrop-blur-xl border border-border shadow-lg rounded-2xl overflow-hidden"
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[300px]">Colaborador</TableHead>
                <TableHead>Área</TableHead>
                <TableHead>Carga (min)</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence>
                {filteredColaboradores.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      Nenhum colaborador encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredColaboradores.map((c, i) => {
                    const areaNome = areas.find(a => a.id === c.area_id)?.nome || 'Sem área'
                    
                    return (
                      <motion.tr 
                        key={c.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: Math.min(i * 0.05, 0.5) }}
                        className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-linear-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center text-sm font-bold text-primary shadow-sm shrink-0">
                              {getInitials(c.nome)}
                            </div>
                            <div className="font-medium truncate max-w-[200px]" title={c.nome}>
                              {c.nome}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{areaNome}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium">{c.carga_horaria_min}</span>
                            <span className="text-xs text-muted-foreground">m/dia</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {c.role === 'gestor' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-500 border border-blue-500/20">
                              <ShieldCheck className="h-3 w-3" /> Gestor
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                              <User className="h-3 w-3" /> Colaborador
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {c.ativo ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Ativo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20">
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Inativo
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Dialog
                            open={editId === c.id}
                            onOpenChange={(open) => setEditId(open ? c.id : null)}
                          >
                            <DialogTrigger render={<Button variant="ghost" size="sm" className="h-8 gap-2 hover:bg-primary/10 hover:text-primary" />}>
                              <Edit2 className="h-3.5 w-3.5" /> Editar
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md">
                              <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                  <div className="h-8 w-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                                    <Edit2 className="h-5 w-5" />
                                  </div>
                                  Editar Colaborador
                                </DialogTitle>
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
                                className="space-y-5 py-2"
                              >
                                <div className="space-y-2">
                                  <Label htmlFor={`colab-nome-${c.id}`}>Nome</Label>
                                  <Input id={`colab-nome-${c.id}`} name="nome" defaultValue={c.nome} required />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                    <Label htmlFor={`colab-carga-${c.id}`}>Carga Horária (min)</Label>
                                    <Input id={`colab-carga-${c.id}`} name="carga_horaria_min" type="number" min="1" defaultValue={c.carga_horaria_min} required />
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <Label>Perfil de Acesso</Label>
                                  <Select name="role" defaultValue={c.role}>
                                    <SelectTrigger className="w-full">
                                      <SelectValue placeholder="Selecione o perfil">
                                        <span className="truncate block capitalize">{c.role}</span>
                                      </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="colaborador">
                                        <div className="flex items-center gap-2">
                                          <User className="h-4 w-4 text-muted-foreground" />
                                          <span>Colaborador</span>
                                        </div>
                                      </SelectItem>
                                      <SelectItem value="gestor">
                                        <div className="flex items-center gap-2">
                                          <ShieldAlert className="h-4 w-4 text-primary" />
                                          <span>Gestor</span>
                                        </div>
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                                  <div className="space-y-0.5">
                                    <Label className="text-base">Conta Ativa</Label>
                                    <p className="text-xs text-muted-foreground">Permitir login no sistema</p>
                                  </div>
                                  <Switch name="ativo" defaultChecked={c.ativo} />
                                </div>
                                <SubmitButton pending={isPending}>Atualizar Perfil</SubmitButton>
                              </form>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </motion.tr>
                    )
                  })
                )}
              </AnimatePresence>
            </TableBody>
          </Table>
        </div>
      </motion.div>
    </div>
  )
}
