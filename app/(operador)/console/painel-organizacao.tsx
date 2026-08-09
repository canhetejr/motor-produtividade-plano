'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { CalendarPlus, CalendarX, CheckCircle2, Loader2, PauseCircle, PlayCircle, Search, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EstadoBadge } from '@/components/ui/estado-badge'
import {
  ativarOrganizacao,
  definirSuspensao,
  definirLimiteAssentos,
  estenderTrial,
  encerrarTrial,
  conferirOrganizacao,
  type Conferencia,
} from './actions'
import type { OrganizacaoOperador } from './tipos'

const DIAS_SUGERIDOS = [7, 15, 30]

/**
 * As ações do operador sobre UMA organização, abertas sob a linha da tabela.
 *
 * Fica escondido até alguém pedir de propósito: são operações que mudam a
 * conta de um cliente pagante, e não devem ficar a um clique de distância
 * enquanto se percorre a lista.
 */
export function PainelOrganizacao({ org }: { org: OrganizacaoOperador }) {
  const [isPending, startTransition] = useTransition()
  const [limite, setLimite] = useState(String(org.limiteAssentos))
  const [dias, setDias] = useState('15')
  const [conferencia, setConferencia] = useState<Conferencia | null>(null)
  const [carregandoConferencia, setCarregandoConferencia] = useState(false)

  const rodar = (fn: () => Promise<{ ok: boolean; error?: string }>, sucesso: string) =>
    startTransition(async () => {
      const res = await fn()
      if (res.ok) toast.success(sucesso)
      else toast.error(res.error ?? 'Não foi possível concluir.')
    })

  const conferir = () => {
    setCarregandoConferencia(true)
    startTransition(async () => {
      const res = await conferirOrganizacao(org.id)
      if (res.ok && res.data) setConferencia(res.data)
      else if (!res.ok) toast.error(res.error)
      setCarregandoConferencia(false)
    })
  }

  const emTrial = org.status === 'trialing'
  const suspensa = org.status === 'suspensa'

  return (
    <div className="mb-3 grid gap-4 rounded-md border border-border bg-muted/30 p-4 lg:grid-cols-3">
      {/* Acesso */}
      <section className="grid min-w-0 content-start gap-2">
        <h4 className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">Acesso</h4>
        <div className="flex flex-wrap gap-2">
          {org.status !== 'ativa' && (
            <Button
              size="xs"
              disabled={isPending}
              onClick={() => rodar(() => ativarOrganizacao(org.id), `${org.nome} agora é cliente ativo.`)}
            >
              <CheckCircle2 className="size-3.5" /> Liberar acesso
            </Button>
          )}
          {suspensa ? (
            <Button
              size="xs"
              variant="outline"
              disabled={isPending}
              onClick={() => rodar(() => definirSuspensao(org.id, false), `${org.nome} reativada.`)}
            >
              <PlayCircle className="size-3.5" /> Reativar
            </Button>
          ) : (
            <Button
              size="xs"
              variant="outline"
              disabled={isPending}
              onClick={() => rodar(() => definirSuspensao(org.id, true), `${org.nome} suspensa.`)}
            >
              <PauseCircle className="size-3.5" /> Suspender
            </Button>
          )}
        </div>
        <p className="min-w-0 text-3xs leading-4 text-muted-foreground">
          Liberar acesso converte teste em cliente. Suspender bloqueia o acesso na hora, sem apagar nada.
        </p>
      </section>

      {/* Assentos */}
      <section className="grid min-w-0 content-start gap-2">
        <h4 className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">Assentos</h4>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            value={limite}
            onChange={(e) => setLimite(e.target.value)}
            className="h-8 w-24"
            aria-label={`Limite de assentos de ${org.nome}`}
          />
          <Button
            size="xs"
            variant="outline"
            disabled={isPending || Number(limite) === org.limiteAssentos}
            onClick={() =>
              rodar(
                () => definirLimiteAssentos(org.id, Number(limite)),
                `Limite de ${org.nome} agora é ${limite}.`
              )
            }
          >
            Salvar
          </Button>
        </div>
        <p className="min-w-0 text-3xs leading-4 text-muted-foreground">
          Em uso agora: {org.assentosOcupados}. Não dá para baixar abaixo disso.
        </p>
      </section>

      {/* Período de cortesia */}
      <section className="grid min-w-0 content-start gap-2">
        <h4 className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">Período de cortesia</h4>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="number"
            min={1}
            value={dias}
            onChange={(e) => setDias(e.target.value)}
            className="h-8 w-20"
            aria-label={`Dias de cortesia para ${org.nome}`}
          />
          <Button
            size="xs"
            variant="outline"
            disabled={isPending}
            onClick={() => rodar(() => estenderTrial(org.id, Number(dias)), `Cortesia de ${org.nome} estendida.`)}
          >
            <CalendarPlus className="size-3.5" /> Estender
          </Button>
          {emTrial && (
            <Button
              size="xs"
              variant="ghost"
              disabled={isPending}
              onClick={() => rodar(() => encerrarTrial(org.id), `Cortesia de ${org.nome} encerrada.`)}
            >
              <CalendarX className="size-3.5" /> Encerrar agora
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {DIAS_SUGERIDOS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDias(String(d))}
              className="rounded-sm border border-border px-1.5 py-0.5 text-3xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {d}d
            </button>
          ))}
        </div>
      </section>

      {/* Conferência */}
      <section className="grid content-start gap-2 lg:col-span-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">Conferência</h4>
          {!conferencia && (
            <Button size="xs" variant="ghost" onClick={conferir} disabled={isPending}>
              {carregandoConferencia ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
              Conferir dados
            </Button>
          )}
        </div>

        {conferencia && (
          <div className="grid gap-3 rounded-md border border-border bg-card p-3 sm:grid-cols-[auto_1fr]">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-1">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Apontamentos</dt>
                <dd className="font-mono tabular-nums">{conferencia.totais.apontamentos}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Quadros</dt>
                <dd className="font-mono tabular-nums">{conferencia.totais.quadros}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Cartões</dt>
                <dd className="font-mono tabular-nums">{conferencia.totais.cartoes}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Convites</dt>
                <dd className="font-mono tabular-nums">{conferencia.convitesPendentes}</dd>
              </div>
            </dl>
            <div className="min-w-0">
              <p className="mb-1.5 flex items-center gap-1.5 text-2xs font-semibold text-muted-foreground">
                <Users className="size-3" aria-hidden /> {conferencia.pessoas.length} pessoa(s)
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {conferencia.pessoas.map((p) => (
                  <li key={p.nome}>
                    <EstadoBadge estado={p.ativo ? 'neutro' : 'erro'} tamanho="sm">
                      {p.nome}
                      {p.role === 'gestor' && ' · gestor'}
                      {!p.ativo && ' · inativo'}
                    </EstadoBadge>
                  </li>
                ))}
              </ul>
              {conferencia.ultimoApontamento && (
                <p className="mt-2 text-3xs text-muted-foreground">
                  Último apontamento em {new Date(conferencia.ultimoApontamento).toLocaleDateString('pt-BR')}.
                </p>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
