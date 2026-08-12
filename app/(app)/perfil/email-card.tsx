'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { AtSign, Loader2, MailCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { solicitarTrocaEmail } from './actions'

export function EmailCard({
  email,
  /** `auth.users.new_email`: pedido feito e ainda não confirmado. Enquanto
   *  existir, o endereço de login continua sendo o antigo. */
  emailPendente,
  /** Vêm da query que /auth/confirmar devolve. Chegam por prop, e não por
   *  `useSearchParams`, porque a página é server component com
   *  `force-dynamic` — ler ali evita empurrar este card para dentro de um
   *  Suspense só por causa de dois parâmetros. */
  resultado,
  erro,
}: {
  email: string
  emailPendente: string | null
  resultado: string | null
  erro: string | null
}) {
  const [isPending, startTransition] = useTransition()
  const [editando, setEditando] = useState(false)

  const enviar = (formData: FormData) => {
    startTransition(async () => {
      const res = await solicitarTrocaEmail(formData)
      if (res.ok) {
        setEditando(false)
        toast.success('Pedido registrado. Confirme pelo link que enviamos para o novo endereço.')
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <section className="mt-6 rounded-md border border-border bg-card p-4 shadow-xs sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">E-mail de acesso</h2>
          <p className="mt-1 truncate text-sm text-muted-foreground">{email}</p>
        </div>
        {!editando && (
          <Button variant="outline" size="sm" onClick={() => setEditando(true)}>
            <AtSign className="size-4" /> Trocar e-mail
          </Button>
        )}
      </div>

      {resultado === '1' && (
        <p className="mt-3 flex items-start gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
          <MailCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          E-mail confirmado. É por ele que você entra a partir de agora.
        </p>
      )}

      {/* "Secure email change" ligado no Supabase pede confirmação nos dois
          endereços — dizer "pronto" depois do primeiro clique faria a pessoa
          parar no meio e depois não conseguir entrar. */}
      {resultado === 'parcial' && (
        <p className="mt-3 text-sm text-muted-foreground">
          Um dos dois links foi confirmado. Falta confirmar o outro — procure a mensagem no endereço que ainda
          não foi usado.
        </p>
      )}

      {erro && <p className="mt-3 text-sm text-destructive">{erro}</p>}

      {emailPendente && (
        <p className="mt-3 text-sm text-muted-foreground">
          Pendente de confirmação: <span className="font-medium text-foreground">{emailPendente}</span>. Até o
          link ser aberto, você continua entrando com o endereço atual. Pedir de novo abaixo substitui este
          pedido.
        </p>
      )}

      {editando && (
        <form action={enviar} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="novo-email">Novo e-mail</Label>
            <Input
              id="novo-email"
              name="email"
              type="email"
              required
              autoFocus
              autoComplete="email"
              placeholder="voce@empresa.com"
            />
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : 'Enviar confirmação'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setEditando(false)} disabled={isPending}>
            Cancelar
          </Button>
        </form>
      )}

      {editando && (
        <p className="mt-2 text-xs text-muted-foreground">
          A troca só vale depois que você abrir o link enviado. Sua sessão atual continua aberta o tempo todo.
        </p>
      )}
    </section>
  )
}
