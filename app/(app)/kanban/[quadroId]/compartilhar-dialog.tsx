'use client'

import { useEffect, useState, useTransition } from 'react'
import { Copy, Link2, Ban, Check } from 'lucide-react'
import { toast } from 'sonner'

import {
  listarCompartilhamentos,
  criarCompartilhamento,
  revogarCompartilhamento,
  type LinkCompartilhado,
} from '../actions-compartilhamento'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export function CompartilharDialog({
  quadroId,
  aberto,
  onOpenChange,
}: {
  quadroId: string
  aberto: boolean
  onOpenChange: (aberto: boolean) => void
}) {
  const [links, setLinks] = useState<LinkCompartilhado[]>([])
  const [pendente, startTransition] = useTransition()

  useEffect(() => {
    if (!aberto) return
    listarCompartilhamentos(quadroId).then((r) => {
      if (r.ok) setLinks(r.data ?? [])
    })
  }, [aberto, quadroId])

  function recarregar() {
    listarCompartilhamentos(quadroId).then((r) => {
      if (r.ok) setLinks(r.data ?? [])
    })
  }

  function criar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const form = e.currentTarget
    startTransition(async () => {
      const r = await criarCompartilhamento(quadroId, formData)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      form.reset()
      recarregar()
      toast.success('Link criado. Copie e envie para quem vai acompanhar.')
    })
  }

  function revogar(id: string) {
    startTransition(async () => {
      const r = await revogarCompartilhamento(id, quadroId)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      recarregar()
    })
  }

  async function copiar(token: string) {
    const url = `${window.location.origin}/q/${token}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copiado.')
    } catch {
      // clipboard exige contexto seguro e permissão; sem ela, mostrar o link
      // é melhor que falhar em silêncio.
      toast.info(url, { duration: 15000 })
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Acompanhamento externo</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Quem abrir o link vê <strong className="font-medium text-foreground">código, título,
          etapa e prazo</strong> dos cards. Descrição, comentários, anexos e responsáveis não
          aparecem.
        </p>

        <form onSubmit={criar} className="flex flex-col gap-3 rounded-lg border border-border p-3">
          <div className="grid gap-1.5">
            <Label htmlFor="link-rotulo">Para quem é este link</Label>
            <Input
              id="link-rotulo"
              name="rotulo"
              required
              placeholder="Ex: Cliente Acme"
              className="h-9"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="link-expira">Válido até (recomendado)</Label>
            <Input id="link-expira" name="expiraEm" type="date" className="h-9" />
          </div>
          <Button type="submit" disabled={pendente} className="h-9 gap-1.5 self-start">
            <Link2 className="h-4 w-4" /> Gerar link
          </Button>
        </form>

        <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto custom-scrollbar">
          {links.map((l) => (
            <li
              key={l.id}
              className={cn(
                'flex items-center gap-2 rounded-lg border border-border p-2.5 text-sm',
                !l.ativo && 'opacity-60'
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{l.rotulo}</p>
                <p className="text-2xs text-muted-foreground">
                  {!l.ativo
                    ? 'Revogado'
                    : l.expiraEm
                      ? `Até ${new Date(l.expiraEm).toLocaleDateString('pt-BR')}`
                      : 'Sem prazo'}
                  {l.ultimoAcessoEm &&
                    ` · último acesso ${new Date(l.ultimoAcessoEm).toLocaleDateString('pt-BR')}`}
                </p>
              </div>
              {l.ativo ? (
                <>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Copiar link de ${l.rotulo}`}
                    onClick={() => copiar(l.token)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Revogar link de ${l.rotulo}`}
                    onClick={() => revogar(l.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Ban className="h-3.5 w-3.5" />
                  </Button>
                </>
              ) : (
                <Check className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              )}
            </li>
          ))}
          {links.length === 0 && (
            <li className="py-4 text-center text-sm italic text-muted-foreground">
              Nenhum link criado ainda.
            </li>
          )}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
