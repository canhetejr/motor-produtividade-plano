'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { createClient } from '@/utils/supabase/client'
import { marcarNotificacaoLida, marcarTodasNotificacoesLidas } from '@/lib/notification-actions'
import { cn } from '@/lib/utils'

type Notificacao = {
  id: string
  titulo: string
  mensagem: string | null
  link: string | null
  lida: boolean
  criado_em: string
}

const POLL_INTERVAL_MS = 60_000

export function NotificationBell({ initial }: { initial: Notificacao[] }) {
  const [notificacoes, setNotificacoes] = useState(initial)
  const [open, setOpen] = useState(false)
  const [, startTransition] = useTransition()

  const unreadCount = notificacoes.filter((n) => !n.lida).length

  useEffect(() => {
    const supabase = createClient()

    async function fetchNotificacoes() {
      const { data } = await supabase
        .from('notificacoes')
        .select('id, titulo, mensagem, link, lida, criado_em')
        .order('criado_em', { ascending: false })
        .limit(20)
      if (data) setNotificacoes(data)
    }

    const interval = setInterval(fetchNotificacoes, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  function handleClickNotificacao(n: Notificacao) {
    if (n.lida) return
    setNotificacoes((prev) => prev.map((item) => (item.id === n.id ? { ...item, lida: true } : item)))
    startTransition(() => {
      marcarNotificacaoLida(n.id)
    })
  }

  function handleMarcarTodas() {
    setNotificacoes((prev) => prev.map((item) => ({ ...item, lida: true })))
    startTransition(() => {
      marcarTodasNotificacoesLidas()
    })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="ghost" size="icon" className="relative" />}>
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
        <span className="sr-only">Notificações</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 gap-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
          <span className="text-sm font-semibold">Notificações</span>
          {unreadCount > 0 && (
            <button onClick={handleMarcarTodas} className="text-xs text-primary hover:underline">
              Marcar todas como lidas
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notificacoes.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground text-center">Nenhuma notificação por enquanto.</p>
          ) : (
            notificacoes.map((n) => {
              const item = (
                <div
                  className={cn(
                    'flex flex-col gap-0.5 px-3 py-2.5 text-sm border-b border-border/50 last:border-0 transition-colors hover:bg-muted/50',
                    !n.lida && 'bg-primary/5'
                  )}
                >
                  <div className="flex items-center gap-2">
                    {!n.lida && <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                    <span className="font-medium truncate">{n.titulo}</span>
                  </div>
                  {n.mensagem && <p className="text-xs text-muted-foreground line-clamp-2">{n.mensagem}</p>}
                  <span className="text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(n.criado_em), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
              )

              return n.link ? (
                <Link key={n.id} href={n.link} onClick={() => handleClickNotificacao(n)}>
                  {item}
                </Link>
              ) : (
                <button key={n.id} onClick={() => handleClickNotificacao(n)} className="w-full text-left">
                  {item}
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
