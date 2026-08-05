'use client'

import { useEffect, useState, useTransition } from 'react'

import { useDistintivoDoApp } from '@/components/pwa/distintivo'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { createClient } from '@/utils/supabase/client'
import { marcarNotificacaoLida, marcarTodasNotificacoesLidas } from '@/lib/notification-actions'
import { cn } from '@/lib/utils'

// Intl.RelativeTimeFormat e nativo. Trocar date-fns por ele aqui tira a lib
// (e o locale ptBR) do chunk compartilhado por todas as rotas autenticadas,
// ja que o sino vive no layout do grupo (app).
const RELATIVO = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })
const ESCALAS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 31536000],
  ['month', 2592000],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
]

function tempoRelativo(iso: string): string {
  const segundos = (Date.now() - new Date(iso).getTime()) / 1000
  for (const [unidade, tamanho] of ESCALAS) {
    if (Math.abs(segundos) >= tamanho) {
      return RELATIVO.format(-Math.round(segundos / tamanho), unidade)
    }
  }
  return RELATIVO.format(-Math.round(segundos), 'second')
}

type Notificacao = {
  id: string
  titulo: string
  mensagem: string | null
  link: string | null
  lida: boolean
  criado_em: string
}

export function NotificationBell({ initial, userId }: { initial: Notificacao[]; userId: string }) {
  const [notificacoes, setNotificacoes] = useState(initial)
  const [open, setOpen] = useState(false)
  const [, startTransition] = useTransition()

  const unreadCount = notificacoes.filter((n) => !n.lida).length

  // O contador tem que sair daqui: este componente e o unico que acompanha as
  // notificacoes em tempo real (realtime abaixo). Ler do servidor deixaria o
  // distintivo do launcher defasado em relacao ao sino.
  useDistintivoDoApp(unreadCount)

  // Instantâneo via Realtime em vez de polling — a segurança continua sendo
  // a RLS (notificacoes_select_own); o filter aqui é só otimização.
  useEffect(() => {
    const supabase = createClient()
    const channelName = `notificacoes:${userId}:${Math.random().toString(36).substring(2, 9)}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notificacoes', filter: `destinatario_id=eq.${userId}` },
        (payload) => {
          const nova = payload.new as Notificacao
          setNotificacoes((prev) => [nova, ...prev].slice(0, 20))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

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
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] p-0 gap-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
          <span className="text-sm font-semibold">Notificações</span>
          {unreadCount > 0 && (
            <button type="button" onClick={handleMarcarTodas} className="min-h-9 rounded-md px-2 text-xs text-primary hover:bg-primary/10 hover:underline">
              Marcar todas como lidas
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notificacoes.length === 0 ? (
            <EmptyState icone={Bell} titulo="Nenhuma notificação por enquanto" className="border-none py-8" />
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
                    {tempoRelativo(n.criado_em)}
                  </span>
                </div>
              )

              return n.link ? (
                <Link key={n.id} href={n.link} onClick={() => handleClickNotificacao(n)}>
                  {item}
                </Link>
              ) : (
                <button type="button" key={n.id} onClick={() => handleClickNotificacao(n)} className="w-full text-left">
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
