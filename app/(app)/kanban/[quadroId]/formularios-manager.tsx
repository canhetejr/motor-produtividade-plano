'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { alternarFormularioAtivo, excluirFormulario } from '../actions'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
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
import { Plus, Link as LinkIcon, Copy, Pencil, Trash2, FileText } from 'lucide-react'
import { FormularioBuilderDialog } from './formulario-builder-dialog'
import type { Coluna, Formulario } from './types'

export function FormulariosManager({
  quadroId,
  formularios,
  colunas,
}: {
  quadroId: string
  formularios: Formulario[]
  colunas: Coluna[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [builderOpen, setBuilderOpen] = useState(false)
  const [editando, setEditando] = useState<Formulario | null>(null)

  function copiarLink(slug: string) {
    const url = `${window.location.origin}/formularios/${slug}`
    navigator.clipboard.writeText(url)
    toast.success('Link copiado!')
  }

  function toggleAtivo(f: Formulario) {
    startTransition(async () => {
      const result = await alternarFormularioAtivo(f.id, quadroId, !f.ativo)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      router.refresh()
    })
  }

  function handleExcluir(id: string) {
    startTransition(async () => {
      const result = await excluirFormulario(id, quadroId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Formulário excluído.')
      router.refresh()
    })
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold">Formulários públicos</h2>
          <p className="text-xs text-muted-foreground">
            Cada formulário gera um link externo (sem login) que cria um card automaticamente ao ser enviado.
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => { setEditando(null); setBuilderOpen(true) }}>
          <Plus className="h-3.5 w-3.5" /> Novo Formulário
        </Button>
      </div>

      {formularios.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Nenhum formulário criado ainda.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {formularios.map((f) => {
            const coluna = colunas.find((c) => c.id === f.coluna_id)
            return (
              <div key={f.id} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <h3 className="font-semibold text-sm truncate">{f.titulo}</h3>
                  </div>
                  <Switch checked={f.ativo} onCheckedChange={() => toggleAtivo(f)} disabled={isPending} />
                </div>
                {f.descricao && <p className="text-xs text-muted-foreground line-clamp-2">{f.descricao}</p>}
                <div className="text-2xs text-muted-foreground">
                  Cria card em <span className="font-medium text-foreground">{coluna?.nome ?? '—'}</span> · {f.campos.length} campo(s)
                </div>
                <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-2 py-1.5 text-2xs text-muted-foreground">
                  <LinkIcon className="h-3 w-3 shrink-0" />
                  <span className="truncate flex-1 font-mono">/formularios/{f.slug}</span>
                  <button onClick={() => copiarLink(f.slug)} className="text-primary hover:text-primary/80 shrink-0">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-auto pt-1">
                  <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => { setEditando(f); setBuilderOpen(true) }}>
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger render={<Button variant="outline" size="icon-sm" className="text-muted-foreground hover:text-destructive" />}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir formulário?</AlertDialogTitle>
                        <AlertDialogDescription>
                          &ldquo;{f.titulo}&rdquo; será excluído e o link público deixará de funcionar. Cards já criados não são afetados.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogClose render={<Button variant="outline">Cancelar</Button>} />
                        <AlertDialogClose render={<Button variant="destructive" onClick={() => handleExcluir(f.id)}>Excluir</Button>} />
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <FormularioBuilderDialog
        open={builderOpen}
        onOpenChange={(open) => {
          setBuilderOpen(open)
          // Fecha depois de criar/editar (ou cancelar) — atualiza a lista
          // buscando o estado novo do servidor (sem realtime nesta tabela).
          if (!open) router.refresh()
        }}
        quadroId={quadroId}
        colunas={colunas}
        formulario={editando}
      />
    </div>
  )
}
