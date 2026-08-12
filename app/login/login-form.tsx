'use client'

import { useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Eye, EyeOff, Loader2, LockKeyhole, Mail } from 'lucide-react'

import { login, loginComGoogle } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GoogleMark } from '@/components/google-mark'
import { createClient } from '@/utils/supabase/client'
import { urlRedefinicaoSenha } from '@/lib/auth-recovery-redirect'

// Campos e botão vivem em client component só por causa do useFormStatus: sem
// ele o clique em "Continuar" não dá retorno nenhum enquanto o servidor
// autentica, e a pessoa clica de novo achando que não pegou.
// `md:h-[52px] md:text-base` repetem o valor sem variante porque a classe base
// do Input declara `md:h-8 md:text-sm` — variante de breakpoint vence
// utilitária sem variante por ordem na folha de estilo, e o campo alto das
// telas de autenticação virava um campo de 32px no desktop.
const CAMPO = 'h-[52px] md:h-[52px] md:text-base rounded-md border-white/20 bg-transparent text-base text-white shadow-none transition-colors placeholder:text-white/45 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/50'

function BotaoEntrar() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      size="lg"
      className="h-12 w-full rounded-md bg-primary text-base font-semibold shadow-xs hover:bg-primary/90"
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
      <div className="animate-progresso-indeterminado h-full w-2/5 bg-primary" />
    </div>
  )
}

function FormularioRecuperacao({ onVoltar }: { onVoltar: () => void }) {
  const [enviando, setEnviando] = useState(false)
  const [estado, setEstado] = useState<'inicial' | 'enviado' | 'erro'>('inicial')

  async function solicitarRecuperacao(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const email = String(new FormData(event.currentTarget).get('email') ?? '').trim()
    if (!email) return

    setEnviando(true)
    setEstado('inicial')
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: urlRedefinicaoSenha(window.location.origin),
    })
    setEnviando(false)

    if (error) {
      console.error('Erro ao solicitar recuperação de senha:', error.message)
      setEstado('erro')
      return
    }

    setEstado('enviado')
  }

  return (
    <form onSubmit={solicitarRecuperacao} className="relative overflow-hidden bg-transparent p-0">
      <div className="grid justify-items-center gap-3 text-center">
        <p className="font-mono text-sm font-medium text-primary">Recuperar acesso</p>
        <h2 className="font-heading text-3xl font-medium leading-tight">Esqueceu sua senha?</h2>
        <p className="text-base leading-6 text-white/70">Informe seu e-mail para receber um link seguro de redefinição.</p>
      </div>

      <div className="mt-8 grid gap-5">
        {estado === 'enviado' && (
          <p role="status" className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-white">
            Se houver uma conta com este e-mail, enviaremos as instruções de recuperação em instantes.
          </p>
        )}
        {estado === 'erro' && (
          <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            Não foi possível enviar o e-mail agora. Tente novamente em alguns minutos.
          </p>
        )}

        <div className="grid gap-2">
          <Label className="text-sm font-medium text-white" htmlFor="recovery-email">E-mail</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="recovery-email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required className={`${CAMPO} pl-10`} />
          </div>
        </div>

        <Button type="submit" size="lg" className="h-12 w-full rounded-md bg-primary text-base font-semibold shadow-xs hover:bg-primary/90" disabled={enviando} aria-busy={enviando}>
          {enviando ? <><Loader2 className="size-4 animate-spin" /> Enviando…</> : 'Enviar link de recuperação'}
        </Button>
        <Button type="button" variant="ghost" className="text-white/75 hover:text-white" onClick={onVoltar} disabled={enviando}>
          Voltar para entrar
        </Button>
      </div>
    </form>
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
  const [recuperandoSenha, setRecuperandoSenha] = useState(false)

  useEffect(() => {
    if (!window.location.hash.includes('type=recovery')) return
    const supabase = createClient()
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') window.location.replace('/auth/redefinir-senha')
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  if (recuperandoSenha) {
    return <FormularioRecuperacao onVoltar={() => setRecuperandoSenha(false)} />
  }

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
            {/* Sem z-index, ao contrário do que estava aqui: o Input é
                estático e o ícone é absoluto, então o ícone já pinta por cima
                por ser posicionado. O `z-10` era resíduo de uma tentativa de
                consertar a sobreposição pelo lado errado — a causa era o
                padding perdido para `md:px-2.5` (ver components/ui/input.tsx),
                e o envelope do campo de e-mail nunca teve z-index nenhum. */}
            <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
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
              className="absolute inset-y-0 right-1 my-auto rounded-md text-muted-foreground hover:text-foreground"
            >
              {senhaVisivel ? <EyeOff /> : <Eye />}
            </Button>
          </div>
        </div>

        <div className="mt-2 flex flex-col gap-4">
          <BotaoEntrar />
          <Button
            type="button"
            variant="link"
            onClick={() => setRecuperandoSenha(true)}
            className="h-auto self-end p-0 text-sm text-primary hover:text-primary/80"
          >
            Esqueci minha senha
          </Button>
          <div className="relative py-1 text-center text-sm text-white/70 before:absolute before:inset-x-0 before:top-1/2 before:border-t before:border-white/20">
            <span className="relative bg-[#101010] px-5">ou</span>
          </div>
          <Button
            type="submit"
            formAction={loginComGoogle}
            formNoValidate
            variant="outline"
            size="lg"
            style={{ color: '#1f1f1f' }}
            className="h-12 w-full rounded-md border-[#dadce0] bg-white text-base font-semibold !text-[#1f1f1f] shadow-xs hover:bg-[#f8f9fa] hover:!text-[#1f1f1f] dark:!bg-white dark:!text-[#1f1f1f] dark:hover:!bg-[#f8f9fa] dark:hover:!text-[#1f1f1f]"
          >
            <GoogleMark className="size-[18px]" />
            Continuar com Google
          </Button>
          <p className="text-center text-sm text-white/75">
            Não tem acesso? <span className="text-primary">Fale com seu gestor.</span>
          </p>
        </div>
      </div>
    </form>
  )
}
