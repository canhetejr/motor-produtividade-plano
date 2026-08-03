'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp, Clock3, ExternalLink, Pause, TimerReset } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/utils/supabase/client'
import { obterSessaoAberta, pausarTimer } from '@/app/(app)/kanban/actions-tempo'
import type { SessaoTempo } from '@/app/(app)/kanban/[quadroId]/types'

// Widget flutuante global (visível em toda página autenticada, não só
// dentro de um quadro) — reflete a sessão de tempo aberta do usuário. Só
// pode existir UMA sessão aberta por colaborador em todo o app (índice
// único parcial no banco), então esse widget é sempre a fonte da verdade de
// "o que estou cronometrando agora".

function elapsedLabel(totalSegundos: number): string {
  const segundos = Math.max(0, totalSegundos)
  const h = Math.floor(segundos / 3600)
  const m = Math.floor((segundos % 3600) / 60)
  const s = segundos % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

function duracaoCurta(totalSegundos: number): string {
  const minutos = Math.max(0, Math.round(totalSegundos / 60))
  if (minutos < 60) return `${minutos} min`
  return `${Math.floor(minutos / 60)}h ${String(minutos % 60).padStart(2, '0')}m`
}

export function KanbanTimerWidget({ userId }: { userId: string }) {
  const [sessao, setSessao] = useState<SessaoTempo | null>(null)
  const [segundos, setSegundos] = useState<number | null>(null)
  const [pausando, setPausando] = useState(false)
  const [expandido, setExpandido] = useState(false)
  const [sidebarRecolhida, setSidebarRecolhida] = useState(false)

  useEffect(() => {
    const sincronizar = () => setSidebarRecolhida(localStorage.getItem('sidebar_collapsed') === 'true')
    sincronizar()
    window.addEventListener('storage', sincronizar)
    window.addEventListener('vertice:sidebar-collapse', sincronizar)
    return () => {
      window.removeEventListener('storage', sincronizar)
      window.removeEventListener('vertice:sidebar-collapse', sincronizar)
    }
  }, [])

  useEffect(() => {
    let ativo = true

    function carregar() {
      obterSessaoAberta().then((r) => {
        if (!ativo || !r.ok) return
        const nova = r.data ?? null
        // Preserva a identidade do objeto quando nada mudou: o ticker abaixo
        // depende de `sessao`, e trocar a referência a cada evento de realtime
        // reiniciaria o intervalo de 1s sem necessidade.
        setSessao((prev) =>
          prev?.id === nova?.id && prev?.iniciadoEm === nova?.iniciadoEm ? prev : nova
        )
      })
    }

    carregar()

    const supabase = createClient()
    const channelName = `timer:${userId}:${Math.random().toString(36).substring(2, 9)}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cartoes_sessoes_tempo', filter: `colaborador_id=eq.${userId}` },
        carregar
      )
      .subscribe()

    return () => {
      ativo = false
      supabase.removeChannel(channel)
    }
  }, [userId])

  // A âncora é calculada DENTRO do efeito, não no render: `Date.now()` no
  // corpo do componente seria impuro.
  //
  // `Math.min(..., Date.now())` protege de relógio dessincronizado — se a
  // máquina do usuário estiver atrás do servidor, o início cairia no futuro,
  // o elapsed daria negativo e o widget travaria em 00:00 (o sintoma clássico
  // de "o timer não está marcando").
  useEffect(() => {
    if (!sessao?.iniciadoEm) return
    const ancora = Math.min(new Date(sessao.iniciadoEm).getTime(), Date.now())
    const tick = () => setSegundos(Math.max(0, Math.floor((Date.now() - ancora) / 1000)))
    const immediate = setTimeout(tick, 0)
    const interval = setInterval(tick, 1000)
    return () => {
      clearTimeout(immediate)
      clearInterval(interval)
    }
  }, [sessao])

  function handlePausar() {
    if (!sessao) return
    setPausando(true)
    pausarTimer(sessao.quadroId ?? '')
      .then((result) => {
        if (result.ok) {
          if (result.data?.aviso) toast.warning(result.data.aviso)
          // Só some da tela se o servidor confirmou o fechamento da sessão.
          setSessao(null)
        }
      })
      .finally(() => setPausando(false))
  }

  if (!sessao || segundos === null) return null

  const totalNoCardSegundos = (sessao.tempoRegistradoSegundos ?? 0) + segundos
  const estimativaSegundos = (sessao.tempoEstimadoMin ?? 0) * 60
  const temEstimativa = estimativaSegundos > 0
  const percentual = temEstimativa ? Math.min(100, Math.round((totalNoCardSegundos / estimativaSegundos) * 100)) : 0
  const acimaDaEstimativa = temEstimativa && totalNoCardSegundos > estimativaSegundos
  const href = sessao.quadroId ? `/kanban/${sessao.quadroId}?cartao=${sessao.cartaoId}` : '#'

  return (
    <div
      className={`fixed z-30 bottom-[calc(4rem+env(safe-area-inset-bottom)+0.5rem)] left-3 md:bottom-4 ${
        sidebarRecolhida ? 'md:left-20' : 'md:left-[17rem]'
      }`}
    >
      <div className="w-[min(22rem,calc(100vw-1.5rem))] border border-border bg-card/95 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-3 px-3 py-2.5">
          <button
            type="button"
            onClick={handlePausar}
            disabled={pausando}
            className="flex h-9 w-9 items-center justify-center bg-success text-success-foreground shadow-sm transition-transform hover:scale-105 disabled:opacity-60"
            aria-label="Pausar e salvar o foco"
            title="Pausar e salvar"
          >
            {pausando ? <TimerReset className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" fill="currentColor" />}
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-success">
              <span className="h-1.5 w-1.5 animate-pulse bg-success" />
              Foco em andamento
            </div>
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className="font-mono text-lg font-semibold tabular-nums leading-none">{elapsedLabel(segundos)}</span>
              {expandido && <span className="text-xs text-muted-foreground">nesta sessão</span>}
            </div>
            {!expandido && (
              <p className="mt-1 max-w-55 truncate text-[11px] text-muted-foreground" title={sessao.cartaoTitulo}>
                {sessao.cartaoTitulo ?? 'Card em andamento'}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setExpandido((aberto) => !aberto)}
            className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label={expandido ? 'Recolher detalhes do foco' : 'Expandir detalhes do foco'}
            aria-expanded={expandido}
          >
            {expandido ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>

        {expandido && (
          <div className="border-t border-border px-3 pb-3 pt-2.5">
            <div className="flex items-start gap-2">
              <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold" title={sessao.cartaoTitulo}>{sessao.cartaoTitulo ?? 'Card sem título'}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{sessao.colunaNome ?? 'Kanban'}</p>
              </div>
              {sessao.quadroId && (
                <Link href={href} className="p-1 text-muted-foreground hover:text-foreground" aria-label="Abrir card" title="Abrir card">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>

            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px]">
                <span className="text-muted-foreground">Tempo no card</span>
                <span className={acimaDaEstimativa ? 'font-medium text-amber-500' : 'font-medium'}>
                  {duracaoCurta(totalNoCardSegundos)}{temEstimativa ? ` / ${duracaoCurta(estimativaSegundos)}` : ''}
                </span>
              </div>
              {temEstimativa ? (
                <>
                  <div className="h-1.5 overflow-hidden bg-secondary" aria-label={`${percentual}% da estimativa consumida`}>
                    <div className={`h-full transition-[width] duration-500 ${acimaDaEstimativa ? 'bg-amber-500' : 'bg-primary'}`} style={{ width: `${percentual}%` }} />
                  </div>
                  <p className={`mt-1 text-[10px] ${acimaDaEstimativa ? 'text-amber-500' : 'text-muted-foreground'}`}>
                    {acimaDaEstimativa ? 'Estimativa ultrapassada — revise o escopo se necessário.' : `${percentual}% da estimativa usado`}
                  </p>
                </>
              ) : (
                <p className="text-[10px] text-muted-foreground">Sem estimativa definida para este card.</p>
              )}
            </div>

            <div className="mt-3 flex gap-2">
              {sessao.quadroId && (
                <Link href={href} className="flex-1 border border-border px-2.5 py-2 text-center text-xs font-medium transition-colors hover:bg-secondary">
                  Abrir tarefa
                </Link>
              )}
              <button type="button" onClick={handlePausar} disabled={pausando} className="flex-1 bg-success px-2.5 py-2 text-xs font-semibold text-success-foreground transition-opacity hover:opacity-90 disabled:opacity-60">
                Pausar foco
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
