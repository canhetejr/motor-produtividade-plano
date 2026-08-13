'use client'

import { useFormStatus } from 'react-dom'
import { User } from 'lucide-react'

import { aceitarConvite } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// `md:h-[52px] md:text-base`: ver o comentário equivalente em
// app/login/login-form.tsx — a base do Input tem `md:h-8 md:text-sm`, que vence
// utilitária sem variante.
const CAMPO =
  'h-[52px] md:h-[52px] md:text-base rounded-md border-white/20 bg-transparent text-base text-white shadow-none transition-colors placeholder:text-white/45 focus-visible:border-vertice-mint focus-visible:ring-1 focus-visible:ring-vertice-mint/50'

function BotaoAceitar() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" className="h-12 w-full rounded-md text-base font-semibold" disabled={pending} aria-busy={pending}>
      {pending ? 'Entrando…' : 'Aceitar convite e entrar'}
    </Button>
  )
}

export function ConviteForm({
  token,
  email,
  organizacaoNome,
  erro,
}: {
  token: string
  email: string
  organizacaoNome: string
  erro?: string
}) {
  return (
    <form action={aceitarConvite} className="relative overflow-hidden bg-transparent p-0">
      <div className="mb-8 grid gap-2 text-center">
        <p className="font-mono text-sm font-medium text-vertice-mint">Convite</p>
        <h1 className="font-heading text-3xl font-medium leading-tight">
          Entrar em {organizacaoNome || 'sua organização'}
        </h1>
        <p className="text-base leading-6 text-white/70">{email}</p>
      </div>

      <div className="flex flex-col gap-5">
        {erro && (
          <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {erro}
          </p>
        )}

        <input type="hidden" name="token" value={token} />

        <div className="grid gap-2">
          <Label className="text-sm font-medium text-white" htmlFor="nome">Seu nome</Label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="nome" name="nome" type="text" required className={`${CAMPO} pl-10`} />
          </div>
        </div>

        <p className="text-sm leading-5 text-white/60">
          Só isso. Você entra direto e escolhe sua senha na primeira tela.
        </p>

        <BotaoAceitar />
      </div>
    </form>
  )
}
