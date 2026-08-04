'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { BellRing, Check, ChevronDown, ChevronUp, Clock3, Copy, ExternalLink, Maximize2, Minimize2, Pause, Timer, TimerReset } from 'lucide-react'
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

function tempoRestante(totalSegundos: number): string {
  const segundos = Math.max(0, totalSegundos)
  const minutos = Math.floor(segundos / 60)
  const segundosRestantes = segundos % 60
  return `${String(minutos).padStart(2, '0')}:${String(segundosRestantes).padStart(2, '0')}`
}

const CHAVE_EXPANDIDO = 'vertice:timer-expandido'
const CHAVE_META = 'vertice:timer-meta-minutos'
const METAS = [25, 50, 90] as const

export function KanbanTimerWidget({ userId }: { userId: string }) {
  const [sessao, setSessao] = useState<SessaoTempo | null>(null)
  const [segundos, setSegundos] = useState<number | null>(null)
  const [pausando, setPausando] = useState(false)
  const [expandido, setExpandido] = useState(false)
  const [sidebarRecolhida, setSidebarRecolhida] = useState(false)
  const [metaMinutos, setMetaMinutos] = useState<number>(25)
  const [modoFoco, setModoFoco] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const metaNotificadaRef = useRef<string | null>(null)
  const tituloOriginalRef = useRef<string | null>(null)
  const pausarRef = useRef<() => void>(() => undefined)

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

  // Preferências leves de interface: não dependem da rede nem atrapalham o
  // primeiro segundo do timer quando a pessoa retorna ao app.
  useEffect(() => {
    setExpandido(localStorage.getItem(CHAVE_EXPANDIDO) === 'true')
    const salva = Number(localStorage.getItem(CHAVE_META))
    if (METAS.includes(salva as (typeof METAS)[number])) setMetaMinutos(salva)
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
        setSessao((prev) => {
          // A consulta inicial pode terminar entre o clique em "play" e a
          // persistência da sessão. Não deixe essa resposta antiga apagar o
          // estado otimista que acabou de ser mostrado.
          if (prev?.id.startsWith('local:') && !nova) return prev
          return prev?.id === nova?.id && prev?.iniciadoEm === nova?.iniciadoEm ? prev : nova
        })
      })
    }

    carregar()

    // Resposta imediata para ações iniciadas/pausadas nesta aba. Não substitui
    // o canal abaixo: ele é a fonte de sincronização entre abas/dispositivos.
    const receberAcaoLocal = (evento: Event) => {
      const detalhe = (evento as CustomEvent<{ tipo?: string; sessao?: SessaoTempo }>).detail
      if (detalhe?.tipo === 'iniciado' && detalhe.sessao) {
        setSessao(detalhe.sessao)
        return
      }
      if (detalhe?.tipo === 'parado') {
        setSessao(null)
        setSegundos(null)
      }
    }
    window.addEventListener('vertice:timer-local', receberAcaoLocal)

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
      window.removeEventListener('vertice:timer-local', receberAcaoLocal)
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

  useEffect(() => {
    if (!sessao || segundos === null) {
      if (tituloOriginalRef.current !== null) {
        document.title = tituloOriginalRef.current
        tituloOriginalRef.current = null
      }
      return
    }
    if (tituloOriginalRef.current === null) tituloOriginalRef.current = document.title
    document.title = `${elapsedLabel(segundos)} · ${sessao.cartaoTitulo ?? 'Foco'} | Vértice`
  }, [sessao, segundos])

  useEffect(() => () => {
    if (tituloOriginalRef.current !== null) document.title = tituloOriginalRef.current
  }, [])

  useEffect(() => {
    if (!sessao || segundos === null || segundos < metaMinutos * 60) return
    const chave = `${sessao.iniciadoEm}:${metaMinutos}`
    if (metaNotificadaRef.current === chave) return
    metaNotificadaRef.current = chave
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Meta de foco concluída', { body: `${metaMinutos} min em ${sessao.cartaoTitulo ?? 'sua tarefa'}.` })
    }
  }, [metaMinutos, segundos, sessao])

  function handlePausar() {
    if (!sessao) return
    const anterior = sessao
    // Pausar é uma intenção local inequívoca. Remover agora elimina a sensação
    // de atraso; se a operação falhar, o estado volta e o Realtime reconcilia.
    setSessao(null)
    setSegundos(null)
    setPausando(true)
    pausarTimer(anterior.quadroId ?? '')
      .then((result) => {
        if (result.ok) {
          if (result.data?.aviso) toast.warning(result.data.aviso)
        } else {
          setSessao(anterior)
        }
      })
      .catch(() => setSessao(anterior))
      .finally(() => setPausando(false))
  }

  // Atalho global e discreto: não usa Espaço (que já pertence a campos,
  // botões e editores de texto) e não compete com atalhos do navegador.
  pausarRef.current = handlePausar
  useEffect(() => {
    const aoPressionar = (evento: KeyboardEvent) => {
      if (evento.altKey && evento.shiftKey && evento.key.toLowerCase() === 'p') {
        evento.preventDefault()
        pausarRef.current()
      }
    }
    window.addEventListener('keydown', aoPressionar)
    return () => window.removeEventListener('keydown', aoPressionar)
  }, [])

  if (!sessao || segundos === null) return null

  const totalNoCardSegundos = (sessao.tempoRegistradoSegundos ?? 0) + segundos
  const estimativaSegundos = (sessao.tempoEstimadoMin ?? 0) * 60
  const temEstimativa = estimativaSegundos > 0
  const percentual = temEstimativa ? Math.min(100, Math.round((totalNoCardSegundos / estimativaSegundos) * 100)) : 0
  const acimaDaEstimativa = temEstimativa && totalNoCardSegundos > estimativaSegundos
  const href = sessao.quadroId ? `/kanban/${sessao.quadroId}?cartao=${sessao.cartaoId}` : '#'
  const metaSegundos = metaMinutos * 60
  const segundosRestantesMeta = Math.max(0, metaSegundos - segundos)
  const metaConcluida = segundos >= metaSegundos
  const progressoMeta = Math.min(100, Math.round((segundos / metaSegundos) * 100))

  function alternarExpandido() {
    setExpandido((aberto) => {
      localStorage.setItem(CHAVE_EXPANDIDO, String(!aberto))
      return !aberto
    })
  }

  function trocarMeta(meta: number) {
    setMetaMinutos(meta)
    localStorage.setItem(CHAVE_META, String(meta))
    metaNotificadaRef.current = null
  }

  async function copiarTitulo() {
    if (!sessao?.cartaoTitulo || !navigator.clipboard) return
    await navigator.clipboard.writeText(sessao.cartaoTitulo)
    setCopiado(true)
    window.setTimeout(() => setCopiado(false), 1600)
  }

  function ativarAviso() {
    if (!('Notification' in window)) {
      toast.message('Seu navegador não oferece avisos de foco.')
      return
    }
    Notification.requestPermission().then((permissao) => {
      toast[permissao === 'granted' ? 'success' : 'message'](
        permissao === 'granted' ? 'Avisos de foco ativados.' : 'Permissão de aviso não concedida.'
      )
    })
  }

  return (
    <>
    <div
      className={`fixed z-30 bottom-[calc(4rem+env(safe-area-inset-bottom)+0.5rem)] left-3 md:bottom-4 ${
        sidebarRecolhida ? 'md:left-20' : 'md:left-[17rem]'
      }`}
    >
      <div className="w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-border bg-card/95 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-3 px-3 py-2.5">
          <button
            type="button"
            onClick={handlePausar}
            disabled={pausando}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-success text-success-foreground shadow-sm transition-transform hover:scale-105 disabled:opacity-60"
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
            onClick={alternarExpandido}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
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
              <div className="mb-3 border border-primary/20 bg-primary/5 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-primary"><Timer className="h-3.5 w-3.5" /> Meta de foco</span>
                  <span className={metaConcluida ? 'text-xs font-semibold text-success' : 'font-mono text-xs font-semibold tabular-nums'}>
                    {metaConcluida ? 'Concluída' : `faltam ${tempoRestante(segundosRestantesMeta)}`}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full bg-primary transition-[width] duration-500" style={{ width: `${progressoMeta}%` }} />
                </div>
                <div className="mt-2 flex gap-1">
                  {METAS.map((meta) => (
                    <button key={meta} type="button" onClick={() => trocarMeta(meta)} className={`flex-1 rounded-sm border px-1.5 py-1 text-[10px] font-semibold transition-colors ${meta === metaMinutos ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:bg-secondary'}`}>
                      {meta}m
                    </button>
                  ))}
                  <button type="button" onClick={ativarAviso} className="rounded-sm border border-border px-2 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Ativar aviso ao concluir a meta" title="Ativar aviso ao concluir a meta">
                    <BellRing className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px]">
                <span className="text-muted-foreground">Tempo no card</span>
                <span className={acimaDaEstimativa ? 'font-medium text-amber-500' : 'font-medium'}>
                  {duracaoCurta(totalNoCardSegundos)}{temEstimativa ? ` / ${duracaoCurta(estimativaSegundos)}` : ''}
                </span>
              </div>
              {temEstimativa ? (
                <>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary" aria-label={`${percentual}% da estimativa consumida`}>
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
                <Link href={href} className="flex-1 rounded-md border border-border px-2.5 py-2 text-center text-xs font-medium transition-colors hover:bg-secondary">
                  Abrir tarefa
                </Link>
              )}
              <button type="button" onClick={handlePausar} disabled={pausando} className="flex-1 rounded-md bg-success px-2.5 py-2 text-xs font-semibold text-success-foreground transition-opacity hover:opacity-90 disabled:opacity-60">
                Pausar foco
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Atalho: Alt + Shift + P</span>
              <div className="flex gap-1">
                <button type="button" onClick={copiarTitulo} className="flex items-center gap-1 px-1.5 py-1 hover:text-foreground" title="Copiar título da tarefa">
                  {copiado ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}{copiado ? 'Copiado' : 'Copiar'}
                </button>
                <button type="button" onClick={() => setModoFoco(true)} className="flex items-center gap-1 px-1.5 py-1 hover:text-foreground" title="Abrir modo foco">
                  <Maximize2 className="h-3 w-3" /> Imersão
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    {modoFoco && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-6 backdrop-blur-xl">
        <div className="w-full max-w-xl border border-border bg-card p-8 text-center shadow-2xl sm:p-12">
          <div className="flex justify-end"><button type="button" onClick={() => setModoFoco(false)} className="p-2 text-muted-foreground hover:text-foreground" aria-label="Sair do modo foco"><Minimize2 className="h-5 w-5" /></button></div>
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-success">Foco protegido</p>
          <h2 className="mx-auto mt-4 max-w-md text-balance text-2xl font-semibold sm:text-3xl">{sessao.cartaoTitulo ?? 'Tarefa em andamento'}</h2>
          <p className="mt-3 text-sm text-muted-foreground">{sessao.colunaNome ?? 'Kanban'}</p>
          <p className="mt-10 font-mono text-6xl font-semibold tracking-tight tabular-nums sm:text-8xl">{elapsedLabel(segundos)}</p>
          <p className="mt-3 text-sm text-muted-foreground">{metaConcluida ? `Meta de ${metaMinutos} min concluída` : `${tempoRestante(segundosRestantesMeta)} restantes na meta de ${metaMinutos} min`}</p>
          <div className="mx-auto mt-8 h-2 max-w-sm overflow-hidden rounded-full bg-secondary"><div className="h-full bg-primary transition-[width] duration-500" style={{ width: `${progressoMeta}%` }} /></div>
          <div className="mx-auto mt-10 flex max-w-sm gap-3">
            {sessao.quadroId && <Link href={href} onClick={() => setModoFoco(false)} className="flex-1 rounded-md border border-border px-3 py-3 text-sm font-medium hover:bg-secondary">Abrir tarefa</Link>}
            <button type="button" onClick={handlePausar} disabled={pausando} className="flex-1 rounded-md bg-success px-3 py-3 text-sm font-semibold text-success-foreground hover:opacity-90 disabled:opacity-60">Pausar foco</button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
