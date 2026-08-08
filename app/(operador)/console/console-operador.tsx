'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Building2, Clock, Users, AlertTriangle, ShieldCheck, CircleDot } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { PageHeader, PageShell, SectionHeader } from '@/components/layout/page-shell'
import { EstadoBadge, type EstadoBadgeEstado } from '@/components/ui/estado-badge'
import type { SaudeCron, EnvEsperada, StatusCron } from '@/lib/admin-saude'
import { emailConfigurado } from '@/lib/admin-saude'
import { definirStatusOrganizacao } from './actions'

type OrganizacaoOperador = {
  id: string
  nome: string
  slug: string
  status: string
  limiteAssentos: number
  assentosOcupados: number
  trialExpiraEm: string | null
  criadoEm: string
}
type EnvStatus = EnvEsperada & { presente: boolean }

const ESTADO_STATUS: Record<string, { estado: EstadoBadgeEstado; rotulo: string }> = {
  trialing: { estado: 'atencao', rotulo: 'Trial' },
  ativa: { estado: 'sucesso', rotulo: 'Ativa' },
  suspensa: { estado: 'erro', rotulo: 'Suspensa' },
  expirada: { estado: 'neutro', rotulo: 'Expirada' },
  excluindo: { estado: 'erro', rotulo: 'Excluindo' },
}

const ESTADO_CRON: Record<StatusCron, EstadoBadgeEstado> = {
  ok: 'sucesso',
  atrasado: 'erro',
  nunca: 'neutro',
}

function diasRestantes(iso: string | null): number | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

function formatarDesde(horas: number | null): string {
  if (horas === null) return 'nunca executou'
  if (horas < 1) return `há ${Math.max(1, Math.round(horas * 60))} min`
  if (horas < 48) return `há ${Math.round(horas)} h`
  return `há ${Math.round(horas / 24)} dias`
}

/** Um número dominante por bloco (design.md: "convergência") — não é decoração. */
function CartaoKpi({
  rotulo,
  valor,
  estado,
}: {
  rotulo: string
  valor: React.ReactNode
  estado?: EstadoBadgeEstado
}) {
  const cor: Record<EstadoBadgeEstado, string> = {
    sucesso: 'text-success-texto',
    atencao: 'text-warning-texto',
    erro: 'text-danger-texto',
    neutro: 'text-foreground',
    marca: 'text-primary',
  }
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      <p className={`mt-1.5 font-mono text-3xl font-medium tabular-nums ${cor[estado ?? 'neutro']}`}>{valor}</p>
    </div>
  )
}

export function ConsoleOperador({
  organizacoes,
  crons,
  envs,
}: {
  organizacoes: OrganizacaoOperador[]
  crons: SaudeCron[]
  envs: EnvStatus[]
}) {
  const [isPending, startTransition] = useTransition()
  const [pendenteId, setPendenteId] = useState<string | null>(null)

  const presencaEnv = Object.fromEntries(envs.map((e) => [e.nome, e.presente])) as Record<string, boolean>
  const envsFaltando = envs.filter((e) => e.nivel === 'obrigatoria' && !e.presente)
  const emailOk = emailConfigurado(presencaEnv)
  const cronsComProblema = crons.filter((c) => c.status !== 'ok').length
  const configOk = envsFaltando.length === 0 && emailOk

  const emTrial = organizacoes.filter((o) => o.status === 'trialing').length
  const ativas = organizacoes.filter((o) => o.status === 'ativa').length
  const precisamAtencao = organizacoes.filter((o) => o.status === 'suspensa' || o.status === 'excluindo').length
  const assentosTotais = organizacoes.reduce((soma, o) => soma + o.assentosOcupados, 0)

  const alternarSuspensao = (org: OrganizacaoOperador) => {
    const novoStatus = org.status === 'suspensa' ? 'ativa' : 'suspensa'
    setPendenteId(org.id)
    startTransition(async () => {
      const res = await definirStatusOrganizacao(org.id, novoStatus)
      if (res.ok) toast.success(novoStatus === 'suspensa' ? 'Organização suspensa.' : 'Organização reativada.')
      else toast.error(res.error)
      setPendenteId(null)
    })
  }

  return (
    <PageShell contentClassName="space-y-8">
      <PageHeader
        title="Console do operador"
        description="Infraestrutura da plataforma: organizações, crons e configuração de ambiente. Isto não é a tela de administração de uma empresa cliente."
        icon={Building2}
        level={2}
        className="mb-0"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CartaoKpi rotulo="Organizações" valor={organizacoes.length} />
        <CartaoKpi rotulo="Em trial" valor={emTrial} estado={emTrial > 0 ? 'atencao' : undefined} />
        <CartaoKpi rotulo="Ativas" valor={ativas} estado={ativas > 0 ? 'sucesso' : undefined} />
        <CartaoKpi
          rotulo="Precisam de atenção"
          valor={precisamAtencao}
          estado={precisamAtencao > 0 ? 'erro' : undefined}
        />
      </div>

      <div>
        <SectionHeader
          title={
            <span className="inline-flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" aria-hidden="true" />
              Organizações
            </span>
          }
          description={`${assentosTotais} assento${assentosTotais === 1 ? '' : 's'} ocupados na plataforma inteira.`}
        />
        <div className="overflow-x-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organização</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Assentos</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizacoes.map((o) => {
                const estado = ESTADO_STATUS[o.status] ?? { estado: 'neutro' as const, rotulo: o.status }
                const dias = o.status === 'trialing' ? diasRestantes(o.trialExpiraEm) : null
                return (
                  <TableRow key={o.id}>
                    <TableCell>
                      <div className="font-medium">{o.nome}</div>
                      <code className="text-3xs font-mono text-muted-foreground">{o.slug}</code>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <EstadoBadge estado={estado.estado}>{estado.rotulo}</EstadoBadge>
                        {dias !== null && (
                          <span className="text-3xs text-muted-foreground">
                            {dias > 0 ? `expira em ${dias} dia${dias === 1 ? '' : 's'}` : 'expirou'}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {o.assentosOcupados} / {o.limiteAssentos}
                    </TableCell>
                    <TableCell className="text-right">
                      {(o.status === 'ativa' || o.status === 'suspensa') && (
                        <Button
                          variant="outline"
                          size="xs"
                          disabled={isPending && pendenteId === o.id}
                          onClick={() => alternarSuspensao(o)}
                        >
                          {o.status === 'suspensa' ? 'Reativar' : 'Suspender'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
              {organizacoes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                    Nenhuma organização cadastrada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div>
        <SectionHeader
          title={
            <span className="inline-flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
              Tarefas agendadas
            </span>
          }
          actions={
            cronsComProblema > 0 ? (
              <EstadoBadge estado="erro">{cronsComProblema} com problema</EstadoBadge>
            ) : (
              <EstadoBadge estado="sucesso" icone={ShieldCheck}>
                Tudo em dia
              </EstadoBadge>
            )
          }
        />
        <div className="divide-y divide-border overflow-hidden rounded-md border border-border">
          {crons.map((c) => (
            <div key={c.tipo} className="flex items-start gap-3 bg-card p-3">
              <CircleDot
                className={`mt-0.5 size-4 shrink-0 ${
                  c.status === 'ok'
                    ? 'text-success-texto'
                    : c.status === 'atrasado'
                      ? 'text-danger-texto'
                      : 'text-muted-foreground'
                }`}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium">{c.rotulo}</span>
                  <code className="text-3xs font-mono text-muted-foreground">{c.agenda}</code>
                </div>
                <p className="mt-0.5 text-2xs text-muted-foreground">{c.descricao}</p>
              </div>
              <div className="shrink-0 text-right">
                <EstadoBadge estado={ESTADO_CRON[c.status]} tamanho="sm">
                  {formatarDesde(c.horasDesde)}
                </EstadoBadge>
                {c.status === 'atrasado' && (
                  <div className="mt-1 text-3xs text-muted-foreground">passou de {c.toleranciaHoras}h</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionHeader
          title="Configuração do ambiente"
          actions={
            configOk ? (
              <EstadoBadge estado="sucesso" icone={ShieldCheck}>
                Completa
              </EstadoBadge>
            ) : (
              <EstadoBadge estado="erro">Incompleta</EstadoBadge>
            )
          }
        />
        <div className="divide-y divide-border overflow-hidden rounded-md border border-border">
          {envs.map((e) => (
            <div key={e.nome} className="flex items-start gap-3 bg-card p-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <code className="font-mono text-xs font-medium">{e.nome}</code>
                  {e.nivel === 'alternativa' && <span className="text-3xs text-muted-foreground">grupo {e.grupo}</span>}
                  {e.nivel === 'opcional' && <span className="text-3xs text-muted-foreground">opcional</span>}
                </div>
                <p className="mt-0.5 text-2xs text-muted-foreground">{e.impacto}</p>
              </div>
              <EstadoBadge
                estado={e.presente ? 'sucesso' : e.nivel === 'obrigatoria' ? 'erro' : 'neutro'}
                tamanho="sm"
                className="shrink-0"
              >
                {e.presente ? 'configurada' : 'ausente'}
              </EstadoBadge>
            </div>
          ))}
        </div>
        {(envsFaltando.length > 0 || !emailOk) && (
          <div className="mt-3 space-y-2 rounded-md border border-danger-borda bg-danger-superficie p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-danger-texto">
              <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
              Configuração incompleta
            </div>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {envsFaltando.map((e) => (
                <li key={e.nome}>
                  <span className="font-mono text-foreground">{e.nome}</span> ausente — {e.impacto}
                </li>
              ))}
              {!emailOk && <li>Nenhum caminho de e-mail configurado (SMTP ou Resend) — nenhuma notificação por e-mail sai.</li>}
            </ul>
          </div>
        )}
      </div>
    </PageShell>
  )
}
