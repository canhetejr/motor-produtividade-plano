'use client'

import { useTransition } from 'react'
import { KeyRound, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { definirSenhaInicialPadrao } from './actions'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'

export function SenhaInicialPadrao() {
  const [pending, startTransition] = useTransition()
  function salvar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    if (data.get('password') !== data.get('confirmacao')) {
      toast.error('As senhas não coincidem.')
      return
    }
    startTransition(async () => {
      const result = await definirSenhaInicialPadrao(data)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      form.reset()
      toast.success('Senha inicial padrão salva.')
    })
  }
  return <form onSubmit={salvar} className="space-y-3 rounded-md border border-border bg-card p-4">
    <div><h2 className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="size-4 text-primary" />Senha inicial padrão</h2><p className="mt-1 text-xs text-muted-foreground">Usada em novos cadastros sem senha informada. Todo novo usuário precisará trocá-la no primeiro login.</p></div>
    <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="senha-padrao">Senha</Label><PasswordInput id="senha-padrao" name="password" minLength={6} required /></div><div className="space-y-1.5"><Label htmlFor="confirmacao-senha-padrao">Confirmar</Label><PasswordInput id="confirmacao-senha-padrao" name="confirmacao" minLength={6} required /></div></div>
    <Button type="submit" disabled={pending}>{pending ? <Loader2 className="size-4 animate-spin" /> : null}Salvar senha padrão</Button>
  </form>
}
