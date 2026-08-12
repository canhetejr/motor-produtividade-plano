'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { CalendarClock, Check, Loader2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatarDataCompletaBR } from '@/lib/dates'
import { pedirCorrecao, aprovarCorrecao, rejeitarCorrecao, type Correcao } from './actions-correcoes'

// Primeira tela das correções de apontamento.
//
// As quatro actions (pedir/aprovar/rejeitar/listar) e as RPCs no banco existem
// desde 02/08/2026 e nunca tiveram consumidor: a capacidade estava completa e
// inalcançável. Nada de regra muda aqui — este arquivo só dá a elas uma porta.
//
// A regra "só se lança hoje" continua valendo: a policy de insert em
// `apontamentos` exige `data = CURRENT_DATE`. Um pedido de correção não a
// contorna; ele vira lançamento apenas quando um gestor aprova, pela RPC.

type Demanda = { id: string; nome: string }

export function CorrecoesPainel({
  correcoes,
  demandas,
  isGestor,
  ontemIso,
}: {
  correcoes: Correcao[]
  demandas: Demanda[]
  isGestor: boolean
  /** Maior data aceita pelo formulário: o banco recusa `data >= current_date`
   *  (constraint apontamentos_correcoes_data_passada), então deixar o seletor
   *  ir até hoje só produziria um erro depois de tudo preenchido. */
  ontemIso: string
}) {
  const [isPending, startTransition] = useTransition()
  const [aberto, setAberto] = useState(false)
  const [demandaId, setDemandaId] = useState('')

  const pendentes = correcoes.filter((c) => c.status === 'PENDENTE')
  const decididas = correcoes.filter((c) => c.status !== 'PENDENTE').slice(0, 5)

  const enviar = (formData: FormData) => {
    formData.set('demandaId', demandaId)
    startTransition(async () => {
      const res = await pedirCorrecao(formData)
      if (res.ok) {
        toast.success('Pedido enviado. Um gestor decide a partir daqui.')
        setAberto(false)
        setDemandaId('')
      } else {
        toast.error(res.error)
      }
    })
  }

  const decidir = (acao: () => Promise<{ ok: boolean; error?: string }>, sucesso: string) => {
    startTransition(async () => {
      const res = await acao()
      if (res.ok) toast.success(sucesso)
      else toast.error(res.error ?? 'Não foi possível concluir.')
    })
  }

  return (
    <section className="rounded-md border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <CalendarClock className="size-4 text-muted-foreground" aria-hidden="true" />
            Lançamentos de dias anteriores
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {isGestor
              ? 'Pedidos da equipe para lançar um dia que já passou. Aprovar cria o apontamento na data pedida.'
              : 'Esqueceu de lançar num dia anterior? Peça aqui — o lançamento só entra depois que um gestor aprova.'}
          </p>
        </div>
        {!aberto && (
          <Button variant="outline" size="sm" onClick={() => setAberto(true)}>
            Pedir lançamento
          </Button>
        )}
      </div>

      {aberto && (
        <form action={enviar} className="mt-4 grid gap-3 rounded-md border border-border bg-background p-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="correcao-demanda">Demanda</Label>
              <Select value={demandaId} onValueChange={(v) => setDemandaId(String(v ?? ''))} required>
                <SelectTrigger id="correcao-demanda">
                  <SelectValue placeholder="Escolha">
                    {(valor) => demandas.find((d) => d.id === valor)?.nome ?? 'Escolha'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {demandas.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="correcao-data">Dia</Label>
              <Input id="correcao-data" name="data" type="date" max={ontemIso} required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="correcao-quantidade">Quantidade</Label>
              <Input id="correcao-quantidade" name="quantidade" type="number" min="1" step="1" defaultValue={1} required />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="correcao-tempo">Tempo em minutos (só para demanda de tempo variável)</Label>
            <Input id="correcao-tempo" name="tempoManualMin" type="number" min="1" step="1" placeholder="Deixe vazio para usar o tempo padrão" />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="correcao-justificativa">Por que não foi lançado no dia</Label>
            <Textarea
              id="correcao-justificativa"
              name="justificativa"
              rows={2}
              required
              minLength={10}
              placeholder="É com isso que o gestor decide."
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={isPending || !demandaId}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : 'Enviar pedido'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAberto(false)} disabled={isPending}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {pendentes.length > 0 && (
        <ul className="mt-4 space-y-2">
          {pendentes.map((c) => (
            <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-border bg-background p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {isGestor && <span className="text-muted-foreground">{c.colaboradorNome} — </span>}
                  {c.demandaNome}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatarDataCompletaBR(c.data)} · {c.quantidade}
                  {c.tempoManualMin ? ` · ${c.tempoManualMin} min` : ''}
                </p>
                <p className="mt-1 text-sm">{c.justificativa}</p>
              </div>

              {isGestor ? (
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => decidir(() => aprovarCorrecao(c.id), 'Pedido aprovado — o apontamento foi criado.')}
                  >
                    <Check className="size-4" /> Aprovar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    aria-label={`Recusar o pedido de ${c.colaboradorNome}`}
                    onClick={() => decidir(() => rejeitarCorrecao(c.id), 'Pedido recusado.')}
                  >
                    <X className="size-4" /> Recusar
                  </Button>
                </div>
              ) : (
                <span className="shrink-0 text-xs font-medium text-muted-foreground">Aguardando o gestor</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {pendentes.length === 0 && !aberto && (
        <p className="mt-4 text-sm text-muted-foreground">
          {isGestor ? 'Nenhum pedido esperando decisão.' : 'Você não tem nenhum pedido em aberto.'}
        </p>
      )}

      {decididas.length > 0 && (
        <ul className="mt-4 space-y-1 border-t border-border pt-3">
          {decididas.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className={c.status === 'APROVADA' ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}>
                {c.status === 'APROVADA' ? 'Aprovado' : 'Recusado'}
              </span>
              <span>·</span>
              <span>{isGestor ? `${c.colaboradorNome} — ` : ''}{c.demandaNome}</span>
              <span>·</span>
              <span>{formatarDataCompletaBR(c.data)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
