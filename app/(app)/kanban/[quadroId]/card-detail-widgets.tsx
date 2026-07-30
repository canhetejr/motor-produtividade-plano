'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Play, Pause, Clock, Users, ListChecks, Plus, Trash2, ShieldCheck, X, Check, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/utils/supabase/client'
import { formatarTempo } from '@/lib/tempo'
import { listarSeguidores, alternarSeguidor } from '../actions'
import { listarChecklist, criarItemChecklist, alternarItemChecklist, excluirItemChecklist } from '../actions-checklist'
import {
  iniciarTimer,
  pausarTimer,
  listarTempoCartao,
  ajustarHorasRegistradas,
  obterSessaoAberta,
  excluirSessaoTempo,
} from '../actions-tempo'
import { listarAprovacoes, solicitarAprovacao, aprovarCartao, rejeitarCartao } from '../actions-aprovacao'
import type { MembroQuadro, ChecklistItem, Aprovacao, SessaoTempo } from './types'

function formatarTempoLive(totalSegundos: number): string {
  const seg = Math.max(0, Math.floor(totalSegundos))
  const h = Math.floor(seg / 3600)
  const m = Math.floor((seg % 3600) / 60)
  const s = seg % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`
  return `${pad(m)}:${pad(s)}`
}

// --- Timer do card --------------------------------------------------------

/**
 * Estado do cronômetro de um card. Vive num hook porque dois componentes o
 * usam — o bloco "Tempo nesta tarefa" na sidebar e o play/cronômetro no
 * cabeçalho do dialog — e a lógica é sutil demais (realtime + ticker do
 * cliente + início otimista) pra ser duplicada sem divergir.
 */
function useTimerCartao(cartaoId: string, quadroId: string) {
  const [totalSegundosBase, setTotalSegundosBase] = useState(0)
  const [sessoes, setSessoes] = useState<SessaoTempo[]>([])
  const [iniciadoEmMs, setIniciadoEmMs] = useState<number | null>(null)
  const [segundosDecorridos, setSegundosDecorridos] = useState(0)
  const [isPending, startTransition] = useTransition()

  // `iniciadoEmMs` é a única fonte de "está rodando neste card": mantê-lo em
  // um booleano à parte deixava os dois dessincronizados.
  const rodandoAqui = iniciadoEmMs !== null

  function recarregar() {
    listarTempoCartao(cartaoId).then((r) => {
      if (r.ok) {
        setTotalSegundosBase(Math.max(0, r.data?.totalSegundos ?? 0))
        setSessoes(r.data?.sessoes ?? [])
      }
    })
    obterSessaoAberta().then((r) => {
      if (!r.ok) return
      const abertaAqui = r.data?.cartaoId === cartaoId ? r.data : null
      if (abertaAqui?.iniciadoEm) {
        const inicio = new Date(abertaAqui.iniciadoEm).getTime()
        setIniciadoEmMs(inicio)
        setSegundosDecorridos(Math.max(0, Math.floor((Date.now() - inicio) / 1000)))
      } else {
        // Sessão fechada em outro lugar (widget flutuante, outra aba) — este
        // card não está mais cronometrando.
        setIniciadoEmMs(null)
        setSegundosDecorridos(0)
      }
    })
  }

  useEffect(recarregar, [cartaoId])

  // Play/pause pode acontecer no widget flutuante ou em outra aba; a mesma
  // publicação de realtime usada lá mantém este bloco em sincronia.
  useEffect(() => {
    const supabase = createClient()
    const channelName = `tempo-card:${cartaoId}:${Math.random().toString(36).substring(2, 9)}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cartoes_sessoes_tempo', filter: `cartao_id=eq.${cartaoId}` },
        () => recarregar()
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartaoId])

  // Ticker de segundos em tempo real baseado no relógio do cliente
  useEffect(() => {
    if (iniciadoEmMs === null) return

    const tick = () => {
      const diff = Math.max(0, Math.floor((Date.now() - iniciadoEmMs) / 1000))
      setSegundosDecorridos(diff)
    }

    const immediate = setTimeout(tick, 0)
    const interval = setInterval(tick, 1000)

    return () => {
      clearTimeout(immediate)
      clearInterval(interval)
    }
  }, [iniciadoEmMs])

  function alternar() {
    if (!rodandoAqui) {
      // Início instantâneo na máquina do cliente (0ms de atraso visual)
      setIniciadoEmMs(Date.now())
      setSegundosDecorridos(0)

      startTransition(async () => {
        const result = await iniciarTimer(cartaoId, quadroId)
        if (!result.ok) {
          toast.error(result.error)
          setIniciadoEmMs(null)
          setSegundosDecorridos(0)
          return
        }
        // Iniciar fecha qualquer sessão aberta em outro card, então o total
        // deste card também pode ter mudado — recarrega do servidor.
        recarregar()
      })
    } else {
      // Pausa: limpa estado local e deixa o servidor confirmar o total real
      const anterior = iniciadoEmMs
      setIniciadoEmMs(null)
      setSegundosDecorridos(0)

      startTransition(async () => {
        const result = await pausarTimer(quadroId)
        if (!result.ok) {
          toast.error(result.error)
          setIniciadoEmMs(anterior)
          return
        }
        // Após servidor confirmar, atualiza o total com dados reais do banco
        const atualizado = await listarTempoCartao(cartaoId)
        if (atualizado.ok && atualizado.data) {
          setTotalSegundosBase(Math.max(0, atualizado.data.totalSegundos))
        }
      })
    }
  }

  return {
    totalSegundosBase,
    setTotalSegundosBase,
    sessoes,
    setSessoes,
    iniciadoEmMs,
    setIniciadoEmMs,
    segundosDecorridos,
    rodandoAqui,
    isPending,
    startTransition,
    recarregar,
    alternar,
  }
}

/**
 * "Nesta etapa há 2h59min". Precisa de componente próprio porque `Date.now()`
 * no render seria impuro e daria mismatch de hidratação (servidor e cliente
 * calculariam valores diferentes) — aqui o relógio só entra depois da montagem.
 */
export function TempoNaEtapa({ etapaDesde, slaHoras }: { etapaDesde: string; slaHoras: number | null }) {
  const [minutos, setMinutos] = useState<number | null>(null)

  useEffect(() => {
    const calcular = () => setMinutos(Math.max(0, Math.round((Date.now() - new Date(etapaDesde).getTime()) / 60000)))
    const immediate = setTimeout(calcular, 0)
    // De minuto em minuto: o valor é exibido em minutos, atualizar mais
    // rápido não mudaria nada na tela.
    const interval = setInterval(calcular, 60_000)
    return () => {
      clearTimeout(immediate)
      clearInterval(interval)
    }
  }, [etapaDesde])

  if (minutos === null) return null

  const estourouSla = slaHoras !== null && minutos > slaHoras * 60

  return (
    <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <Clock className="h-3 w-3" />
      <span className={estourouSla ? 'font-semibold text-rose-500' : undefined}>Nesta etapa há {formatarTempo(minutos)}</span>
      {slaHoras !== null && (
        <span className={estourouSla ? 'font-semibold text-rose-500' : 'text-amber-500'}>
          · SLA {slaHoras}h{estourouSla ? ' estourado' : ''}
        </span>
      )}
    </p>
  )
}

/** Play/pause compacto para o cabeçalho do dialog. */
export function TimerInline({ cartaoId, quadroId }: { cartaoId: string; quadroId: string }) {
  const { rodandoAqui, segundosDecorridos, isPending, alternar } = useTimerCartao(cartaoId, quadroId)

  return (
    <button
      type="button"
      onClick={alternar}
      disabled={isPending}
      title={rodandoAqui ? 'Pausar cronômetro' : 'Iniciar cronômetro'}
      className={
        'flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-bold transition-colors cursor-pointer disabled:opacity-60 ' +
        (rodandoAqui
          ? 'border-primary/30 bg-primary text-primary-foreground'
          : 'border-border bg-secondary/50 text-foreground hover:bg-secondary')
      }
    >
      {rodandoAqui ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      {rodandoAqui && <span className="font-mono tabular-nums">{formatarTempoLive(segundosDecorridos)}</span>}
    </button>
  )
}

// --- Tempo nesta tarefa ---------------------------------------------------

export function TempoWidget({
  cartaoId,
  quadroId,
  tempoEstimadoMin,
  segundosSubtarefas = 0,
}: {
  cartaoId: string
  quadroId: string
  tempoEstimadoMin: number | null
  /** Soma das sessões das subtarefas, para as barras "nas subtarefas" e "total". */
  segundosSubtarefas?: number
}) {
  const {
    totalSegundosBase,
    sessoes,
    setSessoes,
    segundosDecorridos,
    rodandoAqui,
    isPending,
    startTransition,
    recarregar,
    alternar: handleToggle,
  } = useTimerCartao(cartaoId, quadroId)

  const [mostrarHistorico, setMostrarHistorico] = useState(false)
  const [ajustando, setAjustando] = useState(false)
  const [tempoAjuste, setTempoAjuste] = useState('')

  const sessoesFechadas = sessoes.filter((s) => s.finalizadoEm)

  function handleExcluirSessao(sessaoId: string) {
    setSessoes((prev) => prev.filter((s) => s.id !== sessaoId))
    startTransition(async () => {
      const result = await excluirSessaoTempo(sessaoId, quadroId)
      if (!result.ok) toast.error(result.error)
      recarregar()
    })
  }

  function handleAjustar() {
    if (!tempoAjuste.trim()) return
    startTransition(async () => {
      const result = await ajustarHorasRegistradas(cartaoId, quadroId, tempoAjuste)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setTempoAjuste('')
      setAjustando(false)
      recarregar()
      toast.success('Horas ajustadas.')
    })
  }

  const totalSegundosExibicao = Math.max(0, rodandoAqui 
    ? totalSegundosBase + segundosDecorridos
    : totalSegundosBase)

  const totalMinutosEstimadoCalc = Math.round(totalSegundosBase / 60)
  const progresso = tempoEstimadoMin ? Math.min(100, Math.round((totalMinutosEstimadoCalc / tempoEstimadoMin) * 100)) : null

  // As três barras compartilham a mesma escala — senão "nesta tarefa" e
  // "nas subtarefas" apareceriam do mesmo tamanho com valores diferentes.
  const maximoBarras = Math.max(1, totalSegundosExibicao + segundosSubtarefas)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Clock className={`h-3.5 w-3.5 ${rodandoAqui ? 'text-primary animate-spin' : 'text-primary'}`} /> 
          Tempo nesta tarefa
        </span>
        <Button 
          type="button" 
          size="icon-sm" 
          variant={rodandoAqui ? 'default' : 'outline'} 
          onClick={handleToggle} 
          disabled={isPending}
          className={rodandoAqui ? 'bg-primary text-primary-foreground animate-pulse shadow-md h-8 w-8 rounded-lg cursor-pointer' : 'h-8 w-8 rounded-lg border-border hover:bg-secondary cursor-pointer'}
          title={rodandoAqui ? 'Pausar cronômetro' : 'Iniciar cronômetro'}
        >
          {rodandoAqui ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
      </div>

      <div className="flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          {rodandoAqui ? (
            <span className="text-lg font-black tracking-tight tabular-nums text-primary flex items-center gap-2 bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-lg">
              <span className="h-2 w-2 rounded-full bg-primary animate-ping shrink-0" />
              {formatarTempoLive(totalSegundosExibicao)}
            </span>
          ) : (
            <span className="text-base font-extrabold tracking-tight tabular-nums text-foreground">
              {formatarTempoLive(totalSegundosBase)}
            </span>
          )}
        </div>
        {tempoEstimadoMin && (
          <span className="text-[11px] font-semibold text-muted-foreground">
            meta: {formatarTempo(tempoEstimadoMin)}
          </span>
        )}
      </div>

      {/* Três linhas como na ferramenta de referência: o tempo do card sozinho
          esconde o esforço que foi parar nas subtarefas. */}
      <div className="space-y-1 pt-0.5">
        <LinhaTempo rotulo="Nesta tarefa" segundos={totalSegundosExibicao} maximo={maximoBarras} />
        {segundosSubtarefas > 0 && (
          <LinhaTempo rotulo="Nas subtarefas" segundos={segundosSubtarefas} maximo={maximoBarras} />
        )}
        {segundosSubtarefas > 0 && (
          <LinhaTempo rotulo="Total" segundos={totalSegundosExibicao + segundosSubtarefas} maximo={maximoBarras} destaque />
        )}
      </div>

      {progresso !== null && (
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary border border-border/40">
            <div
              className={`h-full rounded-full transition-all ${progresso >= 100 ? 'bg-amber-500' : 'bg-primary'}`}
              style={{ width: `${progresso}%` }}
            />
          </div>
          <span className={`text-[10px] font-bold tabular-nums ${progresso >= 100 ? 'text-amber-500' : 'text-muted-foreground'}`}>
            {progresso}%
          </span>
        </div>
      )}

      {ajustando ? (
        <div className="flex items-center gap-1.5 pt-1">
          <Input
            autoFocus
            value={tempoAjuste}
            onChange={(e) => setTempoAjuste(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAjustar()
              }
            }}
            placeholder="01:30 ou 90"
            className="h-7 text-xs bg-secondary/50 border-border rounded-md"
          />
          <Button type="button" size="icon-sm" onClick={handleAjustar} disabled={isPending || !tempoAjuste.trim()} className="h-7 w-7 rounded-md"><Check className="h-3 w-3" /></Button>
          <Button type="button" size="icon-sm" variant="ghost" onClick={() => setAjustando(false)} className="h-7 w-7 rounded-md"><X className="h-3 w-3" /></Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => setAjustando(true)} className="text-[11px] font-semibold text-primary hover:underline cursor-pointer">
            Ajustar horas registradas
          </button>
          {sessoesFechadas.length > 0 && (
            <button
              type="button"
              onClick={() => setMostrarHistorico((v) => !v)}
              className="flex items-center gap-0.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
            >
              {sessoesFechadas.length} lançamento{sessoesFechadas.length > 1 ? 's' : ''}
              <ChevronDown className={`h-3 w-3 transition-transform ${mostrarHistorico ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      )}

      {/* Sem essa lista, um lançamento errado só podia ser compensado somando
          mais tempo por cima — listarTempoCartao já devolvia as sessões. */}
      {mostrarHistorico && sessoesFechadas.length > 0 && (
        <div className="max-h-40 space-y-1 overflow-y-auto custom-scrollbar rounded-lg border border-border/60 bg-secondary/20 p-1.5">
          {sessoesFechadas.map((s) => (
            <div key={s.id} className="group flex items-center justify-between gap-2 rounded-md px-1.5 py-1 text-[11px] hover:bg-secondary/50">
              <div className="min-w-0">
                <span className="font-semibold tabular-nums text-foreground">{formatarTempo(minutosDaSessao(s))}</span>
                <span className="ml-1.5 text-muted-foreground">
                  {new Date(s.iniciadoEm).toLocaleDateString('pt-BR')}
                  {s.colaboradorNome ? ` · ${s.colaboradorNome}` : ''}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleExcluirSessao(s.id)}
                disabled={isPending}
                className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 cursor-pointer"
                aria-label="Excluir lançamento de tempo"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function LinhaTempo({
  rotulo,
  segundos,
  maximo,
  destaque,
}: {
  rotulo: string
  segundos: number
  maximo: number
  destaque?: boolean
}) {
  const pct = Math.min(100, Math.round((segundos / maximo) * 100))
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-24 shrink-0 text-muted-foreground">{rotulo}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary border border-border/40">
        <div className={`h-full rounded-full ${destaque ? 'bg-foreground/60' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`w-14 shrink-0 text-right font-mono tabular-nums ${destaque ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>
        {formatarTempo(Math.round(segundos / 60))}
      </span>
    </div>
  )
}

// Sessão de cronômetro mede pelos timestamps; sessão de "ajustar horas" tem
// início e fim iguais e guarda o valor em `minutos`.
function minutosDaSessao(s: SessaoTempo): number {
  if (!s.finalizadoEm) return 0
  if (s.iniciadoEm === s.finalizadoEm) return s.minutos ?? 0
  const diffMs = Math.max(0, new Date(s.finalizadoEm).getTime() - new Date(s.iniciadoEm).getTime())
  return Math.round(diffMs / 60000)
}

// --- Seguidores -----------------------------------------------------------

export function SeguidoresWidget({
  cartaoId,
  quadroId,
  currentUserId,
  membros,
}: {
  cartaoId: string
  quadroId: string
  currentUserId: string
  membros: MembroQuadro[]
}) {
  const [seguidores, setSeguidores] = useState<string[]>([])
  const [isPending, startTransition] = useTransition()

  function recarregar() {
    listarSeguidores(cartaoId).then((r) => {
      if (r.ok) setSeguidores(r.data ?? [])
    })
  }

  useEffect(recarregar, [cartaoId])

  const souSeguidor = seguidores.includes(currentUserId)

  function handleToggle() {
    startTransition(async () => {
      const result = await alternarSeguidor(cartaoId, quadroId, !souSeguidor)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      recarregar()
    })
  }

  return (
    <div className="space-y-1.5 pt-2 border-t border-border/60">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> Seguidores ({seguidores.length})
        </span>
        <Button
          type="button"
          size="sm"
          variant={souSeguidor ? 'default' : 'outline'}
          onClick={handleToggle}
          disabled={isPending}
          className="h-7 text-xs px-2.5 rounded-lg cursor-pointer"
        >
          {souSeguidor ? 'Seguindo' : '+ Seguir'}
        </Button>
      </div>

      {seguidores.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {membros
            .filter((m) => seguidores.includes(m.id))
            .map((m) => (
              <span key={m.id} className="text-[11px] font-medium bg-secondary px-2 py-0.5 rounded-full border border-border text-foreground">
                {m.nome}
              </span>
            ))}
        </div>
      )}
    </div>
  )
}

// --- Checklist -----------------------------------------------------------

export function ChecklistWidget({ cartaoId, quadroId }: { cartaoId: string; quadroId: string }) {
  const [itens, setItens] = useState<ChecklistItem[]>([])
  const [novoItemText, setNovoItemText] = useState('')
  const [showNovo, setShowNovo] = useState(false)
  const [isPending, startTransition] = useTransition()

  function recarregar() {
    listarChecklist(cartaoId).then((r) => {
      if (r.ok) setItens(r.data ?? [])
    })
  }

  useEffect(recarregar, [cartaoId])

  function handleAdd() {
    if (!novoItemText.trim()) return
    const texto = novoItemText.trim()
    setNovoItemText('')
    startTransition(async () => {
      const result = await criarItemChecklist(cartaoId, quadroId, texto)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      recarregar()
    })
  }

  function handleToggle(itemId: string, concluido: boolean) {
    setItens((prev) => prev.map((item) => (item.id === itemId ? { ...item, concluido } : item)))
    marcarItem(itemId, concluido)
  }

  function marcarItem(itemId: string, concluido: boolean) {
    startTransition(async () => {
      await alternarItemChecklist(itemId, quadroId, concluido)
    })
  }

  function handleExcluir(itemId: string) {
    setItens((prev) => prev.filter((item) => item.id !== itemId))
    startTransition(async () => {
      await excluirItemChecklist(itemId, quadroId)
    })
  }

  const concluidosCount = itens.filter((i) => i.concluido).length
  const pct = itens.length > 0 ? Math.round((concluidosCount / itens.length) * 100) : 0

  return (
    <div className="space-y-1.5 pt-2 border-t border-border/60">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <ListChecks className="h-3.5 w-3.5 text-primary" /> Checklist ({concluidosCount}/{itens.length})
        </span>
        <button type="button" onClick={() => setShowNovo((v) => !v)} className="text-[11px] font-bold text-primary hover:underline cursor-pointer">
          + Item
        </button>
      </div>

      {itens.length > 0 && (
        <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden border border-border/40 my-1">
          <div className="h-full bg-primary transition-all rounded-full" style={{ width: `${pct}%` }} />
        </div>
      )}

      {showNovo && (
        <div className="flex items-center gap-1.5 my-2">
          <Input
            autoFocus
            value={novoItemText}
            onChange={(e) => setNovoItemText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAdd()
              }
            }}
            placeholder="Novo item..."
            className="h-8 flex-1 text-xs bg-secondary/50 border-border rounded-lg"
          />
          <Button type="button" size="icon-sm" onClick={handleAdd} disabled={isPending || !novoItemText.trim()} className="h-8 w-8 rounded-lg cursor-pointer"><Plus className="h-3.5 w-3.5" /></Button>
        </div>
      )}

      <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
        {itens.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-2 p-1.5 rounded-lg hover:bg-secondary/40 transition-colors group text-xs">
            <label className="flex items-center gap-2 cursor-pointer min-w-0 flex-1">
              <Checkbox checked={item.concluido} onCheckedChange={(v) => handleToggle(item.id, !!v)} />
              <span className={item.concluido ? 'text-muted-foreground line-through truncate' : 'text-foreground font-medium truncate'}>
                {item.texto}
              </span>
            </label>
            <button
              type="button"
              onClick={() => handleExcluir(item.id)}
              className="text-muted-foreground hover:text-destructive shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// --- Aprovação -----------------------------------------------------------

export function AprovacaoWidget({
  cartaoId,
  quadroId,
  currentUserId,
  membros,
  onStatusChange,
}: {
  cartaoId: string
  quadroId: string
  currentUserId: string
  membros: MembroQuadro[]
  onStatusChange?: (ap: Aprovacao | null) => void
}) {
  const [aprovacoes, setAprovacoes] = useState<Aprovacao[]>([])
  const [solicitando, setSolicitando] = useState(false)
  const [aprovadorId, setAprovadorId] = useState('')
  const [rejeitando, setRejeitando] = useState(false)
  const [motivoRejeicao, setMotivoRejeicao] = useState('')
  const [isPending, startTransition] = useTransition()

  function recarregar() {
    listarAprovacoes(cartaoId).then((r) => {
      if (r.ok) setAprovacoes(r.data ?? [])
    })
  }

  useEffect(recarregar, [cartaoId])

  useEffect(() => {
    onStatusChange?.(aprovacoes.length > 0 ? aprovacoes[0] : null)
  }, [aprovacoes, onStatusChange])

  const ultimaAprovacao = aprovacoes.length > 0 ? aprovacoes[0] : null
  // Só uma solicitação em aberto por vez; depois de decidida (aprovada ou
  // rejeitada) o card pode passar por uma nova rodada de aprovação.
  const temPendente = ultimaAprovacao?.status === 'PENDENTE'
  const aprovadoresDisponiveis = membros.filter((m) => m.id !== currentUserId)

  function handleSolicitar() {
    if (!aprovadorId) return
    startTransition(async () => {
      const result = await solicitarAprovacao(cartaoId, aprovadorId, quadroId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setSolicitando(false)
      setAprovadorId('')
      recarregar()
      toast.success('Solicitação enviada.')
    })
  }

  function handleAprovar() {
    if (!ultimaAprovacao) return
    startTransition(async () => {
      const result = await aprovarCartao(ultimaAprovacao.id, quadroId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      recarregar()
      toast.success('Card aprovado!')
    })
  }

  function handleRejeitar() {
    if (!ultimaAprovacao) return
    startTransition(async () => {
      const result = await rejeitarCartao(ultimaAprovacao.id, motivoRejeicao.trim() || null, quadroId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setRejeitando(false)
      setMotivoRejeicao('')
      recarregar()
      toast.info('Card rejeitado.')
    })
  }

  const souAprovador = ultimaAprovacao?.aprovadorId === currentUserId && ultimaAprovacao.status === 'PENDENTE'

  return (
    <div className="space-y-1.5 pt-2 border-t border-border/60">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Aprovação
        </span>
        {!temPendente && aprovadoresDisponiveis.length > 0 && (
          <button type="button" onClick={() => setSolicitando((v) => !v)} className="text-[11px] font-bold text-primary hover:underline cursor-pointer">
            {ultimaAprovacao ? '+ Nova solicitação' : '+ Solicitar'}
          </button>
        )}
      </div>

      {solicitando && (
        <div className="space-y-2 my-2 bg-secondary/30 p-2.5 rounded-lg border border-border">
          <Select value={aprovadorId} onValueChange={(v) => v && setAprovadorId(v)}>
            <SelectTrigger className="h-8 text-xs bg-card border-border rounded-md">
              <SelectValue placeholder="Selecione o aprovador" />
            </SelectTrigger>
            <SelectContent className="rounded-lg border border-border">
              {aprovadoresDisponiveis.map((m) => (
                <SelectItem key={m.id} value={m.id} className="text-xs cursor-pointer">
                  {m.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center justify-end gap-1.5">
            <Button type="button" size="sm" variant="ghost" onClick={() => setSolicitando(false)} className="h-7 text-xs cursor-pointer">
              Cancelar
            </Button>
            <Button type="button" size="sm" onClick={handleSolicitar} disabled={!aprovadorId || isPending} className="h-7 text-xs font-bold bg-primary text-primary-foreground cursor-pointer">
              Enviar
            </Button>
          </div>
        </div>
      )}

      {ultimaAprovacao && (
        <div className="p-2.5 rounded-lg border border-border bg-secondary/20 text-xs space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-foreground">Status: {ultimaAprovacao.status}</span>
            {souAprovador && !rejeitando && (
              <div className="flex items-center gap-1">
                <Button type="button" size="xs" variant="default" onClick={handleAprovar} disabled={isPending} className="h-6 text-[10px] bg-emerald-500 hover:bg-emerald-600 font-bold cursor-pointer">
                  Aprovar
                </Button>
                <Button type="button" size="xs" variant="destructive" onClick={() => setRejeitando(true)} disabled={isPending} className="h-6 text-[10px] font-bold cursor-pointer">
                  Rejeitar
                </Button>
              </div>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">Aprovador: {ultimaAprovacao.aprovadorNome ?? '—'}</p>
          {ultimaAprovacao.comentario && (
            <p className="text-[11px] text-muted-foreground">Motivo: {ultimaAprovacao.comentario}</p>
          )}

          {souAprovador && rejeitando && (
            <div className="space-y-1.5">
              <Input
                autoFocus
                value={motivoRejeicao}
                onChange={(e) => setMotivoRejeicao(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleRejeitar()
                  }
                }}
                placeholder="Motivo (opcional)"
                className="h-7 text-xs bg-card border-border rounded-md"
              />
              <div className="flex items-center justify-end gap-1.5">
                <Button type="button" size="xs" variant="ghost" onClick={() => { setRejeitando(false); setMotivoRejeicao('') }} className="h-6 text-[10px] cursor-pointer">
                  Cancelar
                </Button>
                <Button type="button" size="xs" variant="destructive" onClick={handleRejeitar} disabled={isPending} className="h-6 text-[10px] font-bold cursor-pointer">
                  Confirmar rejeição
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
