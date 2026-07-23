'use client'

import { useState, useTransition, useMemo } from 'react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { createArea, updateArea } from '../catalogo/actions' // We can reuse the action from catalogo
import type { ActionResult } from '@/lib/action-result'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Loader2, PlusCircle, Search, Edit2, Layers, Users, Briefcase } from 'lucide-react'

type Area = { id: string; nome: string; ativo: boolean; colaboradoresCount: number; demandasCount: number }

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

export function AreasManager({
  areas,
  onViewDemandas,
  onViewColaboradores,
}: {
  areas: Area[]
  onViewDemandas?: (areaId: string) => void
  onViewColaboradores?: (areaId: string) => void
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [isPending, startTransition] = useTransition()

  const [createOpen, setCreateOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  const areasFiltradas = useMemo(() => {
    if (!searchTerm.trim()) return areas
    const lower = searchTerm.toLowerCase()
    return areas.filter(a => a.nome.toLowerCase().includes(lower))
  }, [areas, searchTerm])

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
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar área..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-card/50 border-border/50 focus:border-primary/50 transition-colors"
          />
        </div>
        
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button className="w-full sm:w-auto gap-2 shadow-lg shadow-primary/20" />}>
            <PlusCircle className="h-4 w-4" /> Nova Área
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="h-8 w-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                  <Layers className="h-5 w-5" />
                </div>
                Cadastrar Nova Área
              </DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => submit(e, createArea, 'Área criada com sucesso!', () => setCreateOpen(false))}
              className="space-y-5 py-2"
            >
              <div className="space-y-2">
                <Label htmlFor="nova-area-nome">Nome da Área</Label>
                <Input id="nova-area-nome" name="nome" placeholder="Ex: Qualidade, Suporte..." required />
              </div>
              <SubmitButton pending={isPending}>Salvar Área</SubmitButton>
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
                <TableHead className="w-[300px]">Nome da Área</TableHead>
                <TableHead>Colaboradores</TableHead>
                <TableHead>Catálogo de Demandas</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence>
                {areasFiltradas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                      Nenhuma área encontrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  areasFiltradas.map((a, i) => (
                    <motion.tr 
                      key={a.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: Math.min(i * 0.05, 0.5) }}
                      className="border-b transition-colors hover:bg-muted/50"
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-xl bg-linear-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center text-primary shadow-sm shrink-0">
                            <Layers className="h-4 w-4" />
                          </div>
                          <span className="font-medium truncate max-w-[250px]" title={a.nome}>
                            {a.nome}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          disabled={!onViewColaboradores}
                          onClick={() => onViewColaboradores?.(a.id)}
                          className="flex items-center gap-2 rounded-md -mx-1.5 px-1.5 py-0.5 transition-colors enabled:hover:bg-muted enabled:cursor-pointer"
                        >
                          <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center">
                            <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <span className="font-medium">{a.colaboradoresCount}</span>
                          <span className="text-xs text-muted-foreground">cadastrados</span>
                        </button>
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          disabled={!onViewDemandas}
                          onClick={() => onViewDemandas?.(a.id)}
                          className="flex items-center gap-2 rounded-md -mx-1.5 px-1.5 py-0.5 transition-colors enabled:hover:bg-muted enabled:cursor-pointer"
                        >
                          <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center">
                            <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <span className="font-medium">{a.demandasCount}</span>
                          <span className="text-xs text-muted-foreground">tarefas</span>
                        </button>
                      </TableCell>
                      <TableCell>
                        {a.ativo ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Ativa
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Inativa
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Dialog
                          open={editId === a.id}
                          onOpenChange={(open) => setEditId(open ? a.id : null)}
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
                                Editar Área
                              </DialogTitle>
                            </DialogHeader>
                            <form
                              key={a.id}
                              onSubmit={(e) =>
                                submit(
                                  e,
                                  (fd) => updateArea(a.id, fd),
                                  'Área atualizada com sucesso!',
                                  () => setEditId(null)
                                )
                              }
                              className="space-y-5 py-2"
                            >
                              <div className="space-y-2">
                                <Label htmlFor={`area-nome-${a.id}`}>Nome da Área</Label>
                                <Input id={`area-nome-${a.id}`} name="nome" defaultValue={a.nome} required />
                              </div>
                              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                                <div className="space-y-0.5">
                                  <Label className="text-base">Área Ativa</Label>
                                  <p className="text-xs text-muted-foreground">Disponível para novos colaboradores e demandas</p>
                                </div>
                                <Switch name="ativo" defaultChecked={a.ativo} />
                              </div>
                              <SubmitButton pending={isPending}>Atualizar Área</SubmitButton>
                            </form>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </TableBody>
          </Table>
        </div>
      </motion.div>
    </div>
  )
}
