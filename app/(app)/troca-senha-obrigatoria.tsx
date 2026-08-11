'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { KeyRound, Loader2 } from 'lucide-react'
import { updateMinhaSenha } from './perfil/actions'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'

export function TrocaSenhaObrigatoria({ obrigatoria }: { obrigatoria: boolean }) {
  const [open, setOpen] = useState(obrigatoria)
  const [isPending, startTransition] = useTransition()

  if (!obrigatoria && !open) return null

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    if (formData.get('password') !== formData.get('password_confirm')) {
      toast.error('As senhas não coincidem.')
      return
    }

    startTransition(async () => {
      const result = await updateMinhaSenha(formData)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      form.reset()
      setOpen(false)
      toast.success('Senha atualizada. Seu acesso foi liberado!')
    })
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => setOpen(nextOpen || obrigatoria)}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-5 text-primary" />
            Troque sua senha para continuar
          </DialogTitle>
          <DialogDescription>
            Esta conta está usando uma senha inicial ou redefinida por um administrador. Escolha uma senha pessoal para liberar o acesso ao Vértice.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="troca-obrigatoria-senha">Nova senha</Label>
            <PasswordInput
              id="troca-obrigatoria-senha"
              name="password"
              autoComplete="new-password"
              minLength={6}
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="troca-obrigatoria-confirmacao">Confirmar nova senha</Label>
            <PasswordInput
              id="troca-obrigatoria-confirmacao"
              name="password_confirm"
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Atualizar senha e entrar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
