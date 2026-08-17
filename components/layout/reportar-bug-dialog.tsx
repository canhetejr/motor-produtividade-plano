'use client'

import { useRef, useState, useTransition } from 'react'
import { usePathname } from 'next/navigation'
import { Paperclip, X } from 'lucide-react'
import { toast } from 'sonner'

import { reportarBug } from '@/lib/reportar-bug'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export function ReportarBugDialog({
  aberto,
  onOpenChange,
}: {
  aberto: boolean
  onOpenChange: (aberto: boolean) => void
}) {
  const pathname = usePathname()
  const [pendente, startTransition] = useTransition()
  const [anexo, setAnexo] = useState<File | null>(null)
  const inputAnexoRef = useRef<HTMLInputElement>(null)

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set('pagina', pathname)
    const form = e.currentTarget
    startTransition(async () => {
      const r = await reportarBug(formData)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      form.reset()
      setAnexo(null)
      onOpenChange(false)
      toast.success('Reporte enviado. Obrigado por avisar.')
    })
  }

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reportar bug</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          O Vértice ainda está em ajustes. Encontrou algo que não funcionou como esperado? Conte
          aqui — vai direto para quem está cuidando disso.
        </p>

        <form onSubmit={enviar} className="flex flex-col gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="bug-descricao">O que aconteceu</Label>
            <Textarea
              id="bug-descricao"
              name="descricao"
              required
              minLength={10}
              placeholder="Ex: ao salvar um apontamento na quarta-feira, a tela ficou em branco."
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="bug-detalhes">Outras informações (opcional)</Label>
            <Textarea
              id="bug-detalhes"
              name="detalhes"
              placeholder="Passos para reproduzir, navegador, o que você esperava que acontecesse…"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="bug-anexo">Anexar imagem (opcional)</Label>
            {anexo ? (
              <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{anexo.name}</span>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Remover anexo"
                  onClick={() => {
                    setAnexo(null)
                    if (inputAnexoRef.current) inputAnexoRef.current.value = ''
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="h-9 w-fit gap-1.5"
                onClick={() => inputAnexoRef.current?.click()}
              >
                <Paperclip className="h-3.5 w-3.5" /> Escolher imagem
              </Button>
            )}
            <input
              ref={inputAnexoRef}
              id="bug-anexo"
              name="anexo"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => setAnexo(e.target.files?.[0] ?? null)}
            />
          </div>

          <Button type="submit" disabled={pendente} className="self-end">
            {pendente ? 'Enviando…' : 'Enviar reporte'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
