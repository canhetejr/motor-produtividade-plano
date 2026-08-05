import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { ShieldCheck } from 'lucide-react'

import { verificarMfa } from '../mfa-actions'
import { COOKIE_MFA } from '@/lib/mfa-cookie'
import { VerticeSymbol } from '@/components/vertice-symbol'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { VALIDADE_MIN } from '@/lib/mfa'

export const dynamic = 'force-dynamic'

export default async function VerificarPage(props: {
  searchParams: Promise<{ erro?: string }>
}) {
  const [searchParams, jar] = await Promise.all([props.searchParams, cookies()])
  // Sem desafio pendente não há o que verificar — e deixar a tela acessível
  // convidaria a chutar códigos sem nem ter feito login.
  if (!jar.get(COOKIE_MFA)) redirect('/login')

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-5 sm:p-8">
      <div className="w-full max-w-sm">
        <form
          action={verificarMfa}
          className="rounded-md border border-border bg-card p-7 shadow-md sm:p-8"
        >
          <div className="grid justify-items-center gap-3 text-center">
            <VerticeSymbol className="h-11 w-11" />
            <div className="grid gap-1">
              <h1 className="font-heading text-2xl font-semibold leading-snug">Confirme que é você</h1>
              <p className="text-sm text-muted-foreground">
                Enviamos um código de 6 dígitos para o seu e-mail. Ele vale por{' '}
                {VALIDADE_MIN} minutos.
              </p>
            </div>
          </div>

          <div className="mt-7 flex flex-col gap-4">
            {searchParams.erro && (
              <p
                role="alert"
                className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
              >
                {searchParams.erro}
              </p>
            )}

            <div className="grid gap-1.5">
              <Label htmlFor="codigo">Código</Label>
              <Input
                id="codigo"
                name="codigo"
                // inputMode numérico abre o teclado certo no celular;
                // autoComplete one-time-code deixa o iOS oferecer o código do
                // e-mail sem a pessoa alternar de app.
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                autoFocus
                required
                placeholder="000000"
                className="h-12 text-center font-mono text-xl"
              />
            </div>

            <Button type="submit" size="lg" className="h-10 w-full gap-2 text-sm">
              <ShieldCheck className="h-4 w-4" /> Confirmar
            </Button>

            <a
              href="/login"
              className="text-center text-xs text-muted-foreground hover:text-foreground"
            >
              Voltar e entrar de novo
            </a>
          </div>
        </form>
      </div>
    </div>
  )
}
