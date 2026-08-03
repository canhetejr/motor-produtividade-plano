'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react'

import { login, loginComGoogle } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GoogleMark } from '@/components/google-mark'

// Campos e botão vivem em client component só por causa do useFormStatus: sem
// ele o clique em "Continuar" não dá retorno nenhum enquanto o servidor
// autentica, e a pessoa clica de novo achando que não pegou.
const CAMPO = 'h-[52px] rounded-none border-white/20 bg-transparent text-base text-white shadow-none transition-colors placeholder:text-white/45 focus-visible:border-[#00ffce] focus-visible:ring-1 focus-visible:ring-[#00ffce]/50 md:text-sm'

function BotaoEntrar() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      size="lg"
      className="h-12 w-full rounded-none bg-[#820ad1] text-base font-semibold shadow-[0_8px_24px_rgba(130,10,209,.35)] hover:bg-[#9410e8]"
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? 'Entrando…' : 'Entrar'}
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
      className="relative overflow-hidden bg-transparent p-0"
    >
      <BarraDeProgresso />

      {children}

      <div className="mt-8 flex flex-col gap-5">
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

        <div className="grid gap-2">
          <Label className="text-sm font-medium text-white" htmlFor="email">E-mail</Label>
          <div className="relative"><Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
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
              autoComplete="current-password"
              required
              className={`${CAMPO} px-10`}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setSenhaVisivel((v) => !v)}
              aria-label={senhaVisivel ? 'Ocultar senha' : 'Mostrar senha'}
              aria-pressed={senhaVisivel}
              className="absolute inset-y-0 right-1 my-auto rounded-none text-muted-foreground hover:text-foreground"
            >
              {senhaVisivel ? <EyeOff /> : <Eye />}
            </Button>
          </div>
        </div>

        <div className="mt-2 flex flex-col gap-4">
          <BotaoEntrar />
          <div className="relative py-1 text-center text-sm text-white/70 before:absolute before:inset-x-0 before:top-1/2 before:border-t before:border-white/20">
            <span className="relative bg-[#08070e] px-5">ou</span>
          </div>
          <Button
            type="submit"
            formAction={loginComGoogle}
            formNoValidate
            variant="outline"
            size="lg"
            style={{ color: '#1f1f1f' }}
            className="h-12 w-full rounded-none border-[#dadce0] bg-white text-base font-semibold !text-[#1f1f1f] shadow-sm hover:bg-[#f8f9fa] hover:!text-[#1f1f1f] dark:!bg-white dark:!text-[#1f1f1f] dark:hover:!bg-[#f8f9fa] dark:hover:!text-[#1f1f1f]"
          >
            <GoogleMark className="size-[18px]" />
            Continuar com Google
          </Button>
          <p className="text-center text-sm text-violet-100/75">
            Não tem acesso? <span className="text-[#00ffce]">Fale com seu gestor.</span>
          </p>
        </div>
      </div>
    </form>
  )
}
