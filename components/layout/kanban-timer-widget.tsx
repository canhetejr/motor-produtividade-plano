'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Pause } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { obterSessaoAberta, pausarTimer } from '@/app/(app)/kanban/actions-tempo'
import type { SessaoTempo } from '@/app/(app)/kanban/[quadroId]/types'

// Widget flutuante global (visível em toda página autenticada, não só
// dentro de um quadro) — reflete a sessão de tempo aberta do usuário. Só
// pode existir UMA sessão aberta por colaborador em todo o app (índice
// único parcial no banco), então esse widget é sempre a fonte da verdade de
// "o que estou cronometrando agora".

function elapsedLabel(iniciadoEmMs: number, tickMs: number): string {
  const segundos = Math.max(0, Math.floor((tickMs - iniciadoEmMs) / 1000))
  const h = Math.floor(segundos / 3600)
  const m = Math.floor((segundos % 3600) / 60)
  const s = segundos % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

export function KanbanTimerWidget({ userId }: { userId: string }) {
  const [sessao, setSessao] = useState<SessaoTempo | null>(null)
  const [now, setNow] = useState<number | null>(null)
  const [iniciadoEmMs, setIniciadoEmMs] = useState<number | null>(null)

  useEffect(() => {
    function handleSessao(s: SessaoTempo | null) {
      setSessao(s)
      if (s?.iniciadoEm) {
        const serverStart = new Date(s.iniciadoEm).getTime()
        const agora = Date.now()
        const decorridoSeg = Math.max(0, Math.floor((agora - serverStart) / 1000))
        setIniciadoEmMs((prev) => prev ?? (agora - (decorridoSeg * 1000)))
      } else {
        setIniciadoEmMs(null)
      }
    }

    obterSessaoAberta().then((r) => {
      if (r.ok) handleSessao(r.data ?? null)
    })

    const supabase = createClient()
    const channel = supabase
      .channel(`timer:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cartoes_sessoes_tempo', filter: `colaborador_id=eq.${userId}` },
        () => {
          obterSessaoAberta().then((r) => {
            if (r.ok) handleSessao(r.data ?? null)
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  useEffect(() => {
    if (!sessao) return
    const tick = () => setNow(Date.now())
    const immediate = setTimeout(tick, 0)
    const interval = setInterval(tick, 1000)
    return () => {
      clearTimeout(immediate)
      clearInterval(interval)
    }
  }, [sessao])

  if (!sessao || now === null || iniciadoEmMs === null) return null

  return (
    <div className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-full border border-border bg-card py-1.5 pl-1.5 pr-3 shadow-lg md:bottom-4">
      <button
        type="button"
        onClick={() => pausarTimer(sessao.quadroId ?? '').then(() => setSessao(null))}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-success text-success-foreground shrink-0"
        aria-label="Pausar timer"
      >
        <Pause className="h-3.5 w-3.5" fill="currentColor" />
      </button>
      <span className="font-mono text-xs font-semibold tabular-nums">{elapsedLabel(iniciadoEmMs, now)}</span>
      {sessao.quadroId && (
        <Link
          href={`/kanban/${sessao.quadroId}`}
          className="max-w-35 truncate text-xs text-muted-foreground hover:text-foreground"
          title={sessao.cartaoTitulo}
        >
          {sessao.cartaoTitulo}
        </Link>
      )}
    </div>
  )
}
