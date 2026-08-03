'use client'

import { useState, useTransition, useMemo } from 'react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { createArea, updateArea } from '../catalogo/actions'
import type { ActionResult } from '@/lib/action-result'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/ui/empty-state'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Loader2, PlusCircle, Search, Edit2, Layers, Users, Briefcase, ChevronRight, X } from 'lucide-react'

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
    <div className="space-y-4">
      <div className="bg-card/90 backdrop-blur-xl border border-border shadow-sm rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nome da área..." 
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
        
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button className="w-full sm:w-auto gap-2 shadow-md" />}>
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
        className="bg-card/80 backdrop-blur-xl border border-border shadow-md rounded-2xl overflow-hidden"
      >
        <div className="overflow-x-auto">
          <Table stacked>
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
                    <TableCell colSpan={5} className="h-40 text-center">
                      <EmptyState
                        icone={Search}
                        titulo="Nenhuma área encontrada"
                        descricao={searchTerm ? 'Ajuste o termo de busca.' : undefined}
                        acao={
                          searchTerm && (
                            <Button variant="ghost" size="sm" onClick={() => setSearchTerm('')} className="text-xs text-primary">
                              Limpar busca
                            </Button>
                          )
                        }
                        className="border-none py-4"
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  areasFiltradas.map((a, i) => (
                    <motion.tr 
                      key={a.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: Math.min(i * 0.04, 0.4) }}
                      className="border-b transition-colors hover:bg-muted/40"
                    >
                      <TableCell stack="header">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-xl bg-linear-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center text-primary shadow-xs shrink-0">
                            <Layers className="h-4 w-4" />
                          </div>
                          <span className="font-semibold text-foreground truncate max-w-[250px]" title={a.nome}>
                            {a.nome}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell label="Colaboradores">
                        <button
                          type="button"
                          disabled={!onViewColaboradores}
                          onClick={() => onViewColaboradores?.(a.id)}
                          className="group inline-flex items-center gap-2 rounded-lg px-2.5 py-1 border border-border/50 bg-muted/30 hover:bg-muted hover:border-border transition-all cursor-pointer"
                        >
                          <Users className="h-3.5 w-3.5 text-purple-500" />
                          <span className="font-bold text-foreground">{a.colaboradoresCount}</span>
                          <span className="text-xs text-muted-foreground group-hover:text-foreground">membros</span>
                          <ChevronRight className="h-3 w-3 text-muted-foreground max-md:opacity-100 focus-within:opacity-100 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      </TableCell>
                      <TableCell label="Demandas">
                        <button
                          type="button"
                          disabled={!onViewDemandas}
                          onClick={() => onViewDemandas?.(a.id)}
                          className="group inline-flex items-center gap-2 rounded-lg px-2.5 py-1 border border-border/50 bg-muted/30 hover:bg-muted hover:border-border transition-all cursor-pointer"
                        >
                          <Briefcase className="h-3.5 w-3.5 text-blue-500" />
                          <span className="font-bold text-foreground">{a.demandasCount}</span>
                          <span className="text-xs text-muted-foreground group-hover:text-foreground">tarefas</span>
                          <ChevronRight className="h-3 w-3 text-muted-foreground max-md:opacity-100 focus-within:opacity-100 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      </TableCell>
                      <TableCell label="Status">
                        {a.ativo ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Ativa
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Inativa
                          </span>
                        )}
                      </TableCell>
                      <TableCell label="Ação" className="text-right">
                        <Dialog
                          open={editId === a.id}
                          onOpenChange={(open) => setEditId(open ? a.id : null)}
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

