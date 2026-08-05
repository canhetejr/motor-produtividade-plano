'use client'

import { useState, useTransition, useMemo } from 'react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { createColaborador, updateColaborador, resetColaboradorPassword, importarColaboradoresCSV } from './actions'
import type { ActionResult } from '@/lib/action-result'
import { ImportDialog } from '@/components/import-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/ui/empty-state'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
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
import { definirAdmin } from '../admin/actions'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, PlusCircle, Search, Edit2, ShieldAlert, User, ShieldCheck, KeyRound, X } from 'lucide-react'

import { Avatar } from '@/components/ui/avatar'

type Area = { id: string; nome: string; ativo: boolean }
type Colaborador = { id: string; nome: string; area_id: string | null; carga_horaria_min: number; role: string; ativo: boolean; admin?: boolean }

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


export function ColaboradoresManager({
  areas,
  colaboradores,
  areaFilter = 'todas',
  onAreaFilterChange,
  isAdmin = false,
}: {
  areas: Area[]
  colaboradores: Colaborador[]
  areaFilter?: string
  onAreaFilterChange?: (areaId: string) => void
  isAdmin?: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [createOpen, setCreateOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const filteredColaboradores = useMemo(() => {
    let filtered = colaboradores
    if (areaFilter !== 'todas') {
      filtered = filtered.filter(c => c.area_id === areaFilter)
    }
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase()
      filtered = filtered.filter(c => c.nome.toLowerCase().includes(lower))
    }
    return filtered
  }, [colaboradores, searchTerm, areaFilter])

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

  function alternarAdmin(colaborador: Colaborador) {
    const conceder = !colaborador.admin
    startTransition(async () => {
      const result = await definirAdmin(colaborador.id, conceder)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(conceder ? 'Acesso de administrador concedido.' : 'Acesso de administrador revogado.')
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center justify-between gap-3 rounded-md border border-border bg-card p-4 shadow-xs sm:flex-row">
        <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto flex-1">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome do colaborador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-8 h-9 text-sm bg-muted/30 border-border/50 focus:bg-background transition-colors"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <Select value={areaFilter} onValueChange={(val) => onAreaFilterChange?.(val || 'todas')}>
            <SelectTrigger className="w-full sm:w-52 h-9 text-xs bg-muted/30 border-border/50">
              <SelectValue placeholder="Todas as áreas">
                <span className="truncate block">
                  {areaFilter === 'todas' ? 'Todas as áreas' : areas.find(a => a.id === areaFilter)?.nome || 'Todas as áreas'}
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as áreas</SelectItem>
              {areas.map(a => (
                <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <ImportDialog
            label="Importar CSV"
            title="Importar colaboradores em massa"
            colunasEsperadas="nome, email, senha, area, carga_horaria_min, role"
            action={importarColaboradoresCSV}
          />
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger render={<Button className="w-full sm:w-auto gap-2 shadow-md" />}>
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
                    <PasswordInput id="novo-colab-senha" name="password" required placeholder="Mínimo 6 caracteres" minLength={6} />
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
                      {areas.filter(a => a.ativo).map(a => (
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
                      {isAdmin && (
                        <SelectItem value="gestor">
                          <div className="flex items-center gap-2">
                            <ShieldAlert className="h-4 w-4 text-primary" />
                            <span>Gestor</span>
                          </div>
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {!isAdmin && (
                    <p className="text-2xs text-muted-foreground">
                      Conceder o papel de gestor é exclusivo do admin do sistema.
                    </p>
                  )}
                </div>

                <SubmitButton pending={isPending}>Criar Conta</SubmitButton>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-md border border-border bg-card shadow-xs"
      >
        <div className="overflow-x-auto">
          <Table stacked>
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
                    <TableCell colSpan={6} className="h-40 text-center">
                      <EmptyState
                        icone={Search}
                        titulo="Nenhum colaborador encontrado"
                        descricao={
                          searchTerm || areaFilter !== 'todas'
                            ? 'Ajuste a busca ou o filtro de área.'
                            : undefined
                        }
                        acao={
                          (searchTerm || areaFilter !== 'todas') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSearchTerm('')
                                onAreaFilterChange?.('todas')
                              }}
                              className="text-xs text-primary"
                            >
                              Limpar filtros
                            </Button>
                          )
                        }
                        className="border-none py-4"
                      />
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
                        transition={{ delay: Math.min(i * 0.04, 0.4) }}
                        className="border-b transition-colors hover:bg-muted/40"
                      >
                        <TableCell stack="header">
                          <div className="flex items-center gap-3">
                            <Avatar nome={c.nome} tamanho="md" aria-label={c.nome} />
                            <div className="font-semibold text-foreground truncate max-w-[200px]" title={c.nome}>
                              {c.nome}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell label="Área" className="text-muted-foreground font-medium text-xs">{areaNome}</TableCell>
                        <TableCell label="Carga">
                          <div className="flex items-center gap-1">
                            <span className="font-semibold text-foreground">{c.carga_horaria_min}</span>
                            <span className="text-xs text-muted-foreground">m/dia</span>
                          </div>
                        </TableCell>
                        <TableCell label="Perfil">
                          {c.admin ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/25">
                              <ShieldAlert className="h-3 w-3" /> Admin
                            </span>
                          ) : c.role === 'gestor' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                              <ShieldCheck className="h-3 w-3" /> Gestor
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                              <User className="h-3 w-3" /> Colaborador
                            </span>
                          )}
                        </TableCell>
                        <TableCell label="Status">
                          {c.ativo ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Ativo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Inativo
                            </span>
                          )}
                        </TableCell>
                        <TableCell label="Ação" className="text-right">
                          <Dialog
                            open={editId === c.id}
                            onOpenChange={(open) => setEditId(open ? c.id : null)}
                          >
                            <DialogTrigger render={<Button variant="ghost" size="sm" className="h-8 gap-1.5 hover:bg-primary/10 hover:text-primary font-medium" />}>
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
                                        {areas.filter(a => a.ativo || a.id === c.area_id).map(a => (
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
                                  <Select name="role" defaultValue={c.role} disabled={!isAdmin}>
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
                                  {!isAdmin && <input type="hidden" name="role" value={c.role} />}
                                  {!isAdmin && (
                                    <p className="text-2xs text-muted-foreground">
                                      Alterar o papel é exclusivo do admin do sistema.
                                    </p>
                                  )}
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

                              {isAdmin && (
                                <form
                                  onSubmit={(e) =>
                                    submit(
                                      e,
                                      (fd) => resetColaboradorPassword(c.id, fd),
                                      'Senha redefinida!',
                                      () => {}
                                    )
                                  }
                                  className="space-y-3 pt-4 mt-2 border-t border-border"
                                >
                                  <Label htmlFor={`colab-nova-senha-${c.id}`} className="flex items-center gap-2 text-sm font-semibold">
                                    <KeyRound className="h-4 w-4 text-muted-foreground" /> Redefinir senha
                                  </Label>
                                  <PasswordInput
                                    id={`colab-nova-senha-${c.id}`}
                                    name="password"
                                    required
                                    placeholder="Nova senha (mínimo 6 caracteres)"
                                    minLength={6}
                                  />
                                  <Button type="submit" variant="outline" className="w-full" disabled={isPending}>
                                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Redefinir senha'}
                                  </Button>
                                </form>
                              )}

                              {isAdmin && (
                                <div className="mt-2 space-y-3 border-t border-border pt-4">
                                  <div>
                                    <p className="text-sm font-semibold">Acesso de administrador</p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      Administradores acessam diagnóstico, quadros globais, automações e infraestrutura.
                                    </p>
                                  </div>
                                  <AlertDialog>
                                    <AlertDialogTrigger
                                      render={
                                        <Button
                                          type="button"
                                          variant={c.admin ? 'destructive' : 'outline'}
                                          className="w-full"
                                          disabled={isPending || (!c.admin && c.role !== 'gestor')}
                                        />
                                      }
                                    >
                                      <ShieldAlert className="h-4 w-4" />
                                      {c.admin ? 'Revogar administrador' : 'Conceder administrador'}
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>
                                          {c.admin ? 'Revogar acesso de administrador?' : 'Conceder acesso de administrador?'}
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                          {c.admin
                                            ? c.nome + ' continuará como gestor, mas perderá os controles globais do sistema.'
                                            : c.nome + ' poderá administrar acessos e controles globais de toda a operação.'}
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogClose render={<Button variant="outline">Cancelar</Button>} />
                                        <AlertDialogClose
                                          render={
                                            <Button
                                              variant={c.admin ? 'destructive' : 'default'}
                                              onClick={() => alternarAdmin(c)}
                                            >
                                              {c.admin ? 'Revogar acesso' : 'Conceder acesso'}
                                            </Button>
                                          }
                                        />
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                  {!c.admin && c.role !== 'gestor' && (
                                    <p className="text-2xs text-muted-foreground">
                                      Salve primeiro o perfil como gestor para liberar este acesso.
                                    </p>
                                  )}
                                </div>
                              )}
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
