'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { criarQuadro, atualizarQuadro, atualizarMembrosQuadro, arquivarQuadro } from './actions'
import type { ActionResult } from '@/lib/action-result'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Loader2, PlusCircle, Users, Settings, Archive, ArchiveRestore, LayoutGrid } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

type Membro = { colaborador_id: string; nome: string }
type Quadro = {
  id: string
  nome: string
  descricao: string | null
  codigo: string
  ativo: boolean
  membros: Membro[]
}
type Colaborador = { id: string; nome: string; area_id: string | null }

function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </Button>
  )
}

export function KanbanBoardsList({
  quadros,
  colaboradores,
  isGestor,
}: {
  quadros: Quadro[]
  colaboradores: Colaborador[]
  isGestor: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [createOpen, setCreateOpen] = useState(false)
  const [createMembros, setCreateMembros] = useState<string[]>([])
  const [editQuadroId, setEditQuadroId] = useState<string | null>(null)
  const [editMembros, setEditMembros] = useState<string[]>([])

  function submit<T>(
    e: React.FormEvent<HTMLFormElement>,
    action: (formData: FormData) => Promise<ActionResult<T>>,
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

  function openEdit(q: Quadro) {
    setEditMembros(q.membros.map((m) => m.colaborador_id))
    setEditQuadroId(q.id)
  }

  function handleEditSubmit(e: React.FormEvent<HTMLFormElement>, quadroId: string) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await atualizarQuadro(quadroId, formData)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      const resultMembros = await atualizarMembrosQuadro(quadroId, editMembros)
      if (!resultMembros.ok) {
        toast.error(resultMembros.error)
        return
      }
      toast.success('Quadro atualizado!')
      setEditQuadroId(null)
    })
  }

  function toggleAtivo(id: string, ativo: boolean) {
    startTransition(async () => {
      const result = await arquivarQuadro(id, ativo)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(ativo ? 'Quadro reativado.' : 'Quadro arquivado.')
    })
  }

  const editQuadro = quadros.find((q) => q.id === editQuadroId)

  return (
    <div className="space-y-6">
      {isGestor && (
        <div className="flex justify-end">
          <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (open) setCreateMembros([]) }}>
            <DialogTrigger render={<Button />}>
              <PlusCircle className="h-4 w-4" /> Novo quadro
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div className="h-8 w-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                    <LayoutGrid className="h-5 w-5" />
                  </div>
                  Novo quadro
                </DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) =>
                  submit(
                    e,
                    (fd) => {
                      createMembros.forEach((id) => fd.append('membros', id))
                      return criarQuadro(fd)
                    },
                    'Quadro criado!',
                    () => setCreateOpen(false)
                  )
                }
                className="space-y-5 py-2"
              >
                <div className="space-y-2">
                  <Label htmlFor="novo-quadro-nome">Nome do quadro</Label>
                  <Input id="novo-quadro-nome" name="nome" required placeholder="Ex: Marketing" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="novo-quadro-codigo">Código (prefixo dos cards)</Label>
                  <Input id="novo-quadro-codigo" name="codigo" required maxLength={6} placeholder="Ex: MKT" className="uppercase" />
                  <p className="text-xs text-muted-foreground">2 a 6 letras. Vira o prefixo dos cards, ex.: MKT-1, MKT-2...</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="novo-quadro-descricao">Descrição (opcional)</Label>
                  <Textarea id="novo-quadro-descricao" name="descricao" rows={2} />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" /> Vincular colaboradores
                  </Label>
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-border p-2 space-y-1">
                    {colaboradores.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-2">Nenhum colaborador ativo.</p>
                    ) : (
                      colaboradores.map((c) => (
                        <label key={c.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer text-sm">
                          <Checkbox
                            checked={createMembros.includes(c.id)}
                            onCheckedChange={(checked) =>
                              setCreateMembros((prev) => (checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)))
                            }
                          />
                          {c.nome}
                        </label>
                      ))
                    )}
                  </div>
                </div>
                <SubmitButton pending={isPending}>Criar quadro</SubmitButton>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {quadros.length === 0 ? (
        <EmptyState
          titulo={isGestor ? 'Nenhum quadro criado' : 'Nenhum quadro disponível'}
          descricao={isGestor ? 'Crie o primeiro quadro para organizar um fluxo de trabalho.' : 'Você ainda não participa de nenhum quadro.'}
          icone={LayoutGrid}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {quadros.map((q) => (
            <div
              key={q.id}
              className={`group relative flex flex-col gap-3 rounded-md border bg-card p-4 shadow-xs transition-colors ${
                q.ativo ? 'border-border/50 hover:border-primary/40' : 'border-border/30 opacity-60'
              }`}
            >
              <Link href={`/kanban/${q.id}`} className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-3xs font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                    {q.codigo}
                  </span>
                  {!q.ativo && (
                    <span className="text-3xs font-semibold text-muted-foreground uppercase">Arquivado</span>
                  )}
                </div>
                <h3 className="text-base font-semibold leading-tight transition-colors group-hover:text-primary">{q.nome}</h3>
                {q.descricao && <p className="text-sm text-muted-foreground line-clamp-2">{q.descricao}</p>}
              </Link>

              <div className="flex items-center justify-between mt-auto pt-2">
                <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  <span className="truncate">{q.membros.length > 0 ? q.membros.map((m) => m.nome).join(', ') : 'Sem membros'}</span>
                </div>
                {isGestor && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(q)} title="Gerenciar quadro">
                      <Settings className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => toggleAtivo(q.id, !q.ativo)}
                      disabled={isPending}
                      title={q.ativo ? 'Arquivar' : 'Reativar'}
                    >
                      {q.ativo ? <Archive className="h-3.5 w-3.5" /> : <ArchiveRestore className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {isGestor && editQuadro && (
        <Dialog open={!!editQuadroId} onOpenChange={(open) => !open && setEditQuadroId(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Gerenciar quadro</DialogTitle>
            </DialogHeader>
            <form key={editQuadro.id} onSubmit={(e) => handleEditSubmit(e, editQuadro.id)} className="space-y-5 py-2">
              <div className="space-y-2">
                <Label htmlFor="editar-quadro-nome">Nome do quadro</Label>
                <Input id="editar-quadro-nome" name="nome" defaultValue={editQuadro.nome} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editar-quadro-descricao">Descrição (opcional)</Label>
                <Textarea id="editar-quadro-descricao" name="descricao" rows={2} defaultValue={editQuadro.descricao ?? ''} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" /> Colaboradores vinculados
                </Label>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-border p-2 space-y-1">
                  {colaboradores.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer text-sm">
                      <Checkbox
                        checked={editMembros.includes(c.id)}
                        onCheckedChange={(checked) =>
                          setEditMembros((prev) => (checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)))
                        }
                      />
                      {c.nome}
                    </label>
                  ))}
                </div>
              </div>
              <SubmitButton pending={isPending}>Salvar Alterações</SubmitButton>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
