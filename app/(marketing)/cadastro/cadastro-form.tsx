'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { Building2, Eye, EyeOff, LockKeyhole, Mail, User } from 'lucide-react'

import { cadastrar } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// `md:h-[52px] md:text-base`: ver o comentário equivalente em
// app/login/login-form.tsx — a base do Input tem `md:h-8 md:text-sm`, que vence
// utilitária sem variante.
const CAMPO =
  'h-[52px] md:h-[52px] md:text-base rounded-md border-white/20 bg-transparent text-base text-white shadow-none transition-colors placeholder:text-white/45 focus-visible:border-vertice-mint focus-visible:ring-1 focus-visible:ring-vertice-mint/50'

function BotaoCriarConta() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      size="lg"
      className="h-12 w-full rounded-md text-base font-semibold"
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? 'Criando conta…' : 'Criar minha conta'}
    </Button>
  )
}

export function CadastroForm({ erro }: { erro?: string }) {
  const [senhaVisivel, setSenhaVisivel] = useState(false)
  // Carimbo de hora do primeiro render — a action recusa envio a menos de 3s
  // dele (proteção contra bot, ver comentário em actions.ts).
  const [carimbo] = useState(() => Date.now())

  return (
    <form action={cadastrar} className="relative overflow-hidden bg-transparent p-0">
      <div className="mb-8 grid gap-2 text-center">
        <p className="font-mono text-sm font-medium text-vertice-mint">Cadastro</p>
        <h1 className="font-heading text-3xl font-medium leading-tight">Crie sua organização</h1>
        <p className="text-base leading-6 text-white/70">14 dias grátis, sem cartão de crédito.</p>
      </div>

      <div className="flex flex-col gap-5">
        {erro && (
          <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {erro}
          </p>
        )}

        {/* Honeypot: fora da visão e do fluxo de tab, mas presente no DOM —
            um autofill/bot que preenche todo formulário cai aqui. */}
        <div className="hidden" aria-hidden="true">
          <label htmlFor="site">Site</label>
          <input id="site" name="site" type="text" tabIndex={-1} autoComplete="off" />
        </div>
        <input type="hidden" name="carimbo" value={carimbo} />

        <div className="grid gap-2">
          <Label className="text-sm font-medium text-white" htmlFor="empresa">Nome da empresa</Label>
          <div className="relative">
            <Building2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="empresa" name="empresa" type="text" required className={`${CAMPO} pl-10`} />
          </div>
        </div>

        <div className="grid gap-2">
          <Label className="text-sm font-medium text-white" htmlFor="nome">Seu nome</Label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="nome" name="nome" type="text" required className={`${CAMPO} pl-10`} />
          </div>
        </div>

        <div className="grid gap-2">
          <Label className="text-sm font-medium text-white" htmlFor="email">E-mail</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required className={`${CAMPO} pl-10`} />
          </div>
        </div>

        <div className="grid gap-2">
          <Label className="text-sm font-medium text-white" htmlFor="password">Senha</Label>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              name="password"
              type={senhaVisivel ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={6}
              className={`${CAMPO} px-10`}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute right-2 top-1/2 -translate-y-1/2"
              onClick={() => setSenhaVisivel((v) => !v)}
              aria-label={senhaVisivel ? 'Ocultar senha' : 'Mostrar senha'}
            >
              {senhaVisivel ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </Button>
          </div>
        </div>

        <BotaoCriarConta />

        <p className="text-center text-sm text-white/60">
          Já tem conta?{' '}
          <Link href="/login" className="text-vertice-mint hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </form>
  )
}
