'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Eye, EyeOff } from 'lucide-react'

import { login } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Campos e botão vivem em client component só por causa do useFormStatus: sem
// ele o clique em "Continuar" não dá retorno nenhum enquanto o servidor
// autentica, e a pessoa clica de novo achando que não pegou.
const CAMPO = 'h-10 rounded-md bg-background/40 text-base md:text-sm'

function BotaoEntrar() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      size="lg"
      className="h-10 w-full text-sm"
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? 'Entrando…' : 'Continuar'}
    </Button>
  )
}

// Barra de progresso mint de 2px (design.md §11) — o único elemento que se
// move durante o envio. Fica na borda superior do painel, por isso o <form>
// precisa ser o próprio painel.
function BarraDeProgresso() {
  const { pending } = useFormStatus()
  if (!pending) return null
  return (
    <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden" role="progressbar" aria-label="Entrando">
      <div className="animate-progresso-indeterminado h-full w-2/5 bg-vertice-mint" />
    </div>
  )
}

export function LoginForm({
  mensagem,
  children,
}: {
  mensagem?: string
  children: React.ReactNode
}) {
  const [senhaVisivel, setSenhaVisivel] = useState(false)

  return (
    <form
      action={login}
      className="painel-vidro relative overflow-hidden rounded-lg p-7 shadow-2xl ring-1 ring-foreground/10 sm:p-8"
    >
      <BarraDeProgresso />

      {children}

      <div className="mt-7 flex flex-col gap-4">
        {mensagem && (
          // role="alert" faz o leitor de tela anunciar o erro na hora; sem isso
          // a mensagem aparece na tela e passa despercebida por quem não a vê.
          <p
            role="alert"
            className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
          >
            {mensagem}
          </p>
        )}

        <div className="grid gap-1.5">
          <Label htmlFor="email">E-mail corporativo</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="voce@empresa.com"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            className={CAMPO}
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="password">Senha</Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={senhaVisivel ? 'text' : 'password'}
              autoComplete="current-password"
              required
              className={`${CAMPO} pr-10`}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setSenhaVisivel((v) => !v)}
              aria-label={senhaVisivel ? 'Ocultar senha' : 'Mostrar senha'}
              aria-pressed={senhaVisivel}
              className="absolute inset-y-0 right-1 my-auto text-muted-foreground hover:text-foreground"
            >
              {senhaVisivel ? <EyeOff /> : <Eye />}
            </Button>
          </div>
        </div>

        <div className="mt-2 flex flex-col gap-3">
          <BotaoEntrar />
          <p className="text-center text-xs text-muted-foreground">
            Sem conta? Solicite acesso ao seu gestor.
          </p>
        </div>
      </div>
    </form>
  )
}
