'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Building2, CheckCircle2, XCircle, AlertTriangle, Clock, Users } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { PageHeader, PageShell } from '@/components/layout/page-shell'
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

const ESTILO_STATUS: Record<string, { texto: string; rotulo: string }> = {
  trialing: { texto: 'text-amber-600 dark:text-amber-400', rotulo: 'Trial' },
  ativa: { texto: 'text-emerald-600 dark:text-emerald-400', rotulo: 'Ativa' },
  suspensa: { texto: 'text-rose-600 dark:text-rose-400', rotulo: 'Suspensa' },
  expirada: { texto: 'text-muted-foreground', rotulo: 'Expirada' },
  excluindo: { texto: 'text-rose-600 dark:text-rose-400', rotulo: 'Excluindo' },
}

function IconeStatusCron({ status }: { status: StatusCron }) {
  if (status === 'ok') {
    return <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
  }
  if (status === 'atrasado') {
    return <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" aria-hidden="true" />
  }
  return <XCircle className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
}

function formatarDesde(horas: number | null): string {
  if (horas === null) return 'nunca executou'
  if (horas < 1) return `há ${Math.max(1, Math.round(horas * 60))} min`
  if (horas < 48) return `há ${Math.round(horas)} h`
  return `há ${Math.round(horas / 24)} dias`
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

      <div>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
          Organizações
        </h2>
        <div className="rounded-md border border-border overflow-x-auto">
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
                const estilo = ESTILO_STATUS[o.status] ?? { texto: 'text-muted-foreground', rotulo: o.status }
                return (
                  <TableRow key={o.id}>
                    <TableCell>
                      <div className="font-medium">{o.nome}</div>
                      <code className="text-3xs text-muted-foreground font-mono">{o.slug}</code>
                    </TableCell>
                    <TableCell>
                      <span className={`text-2xs font-medium ${estilo.texto}`}>{estilo.rotulo}</span>
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
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                    Nenhuma organização cadastrada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
          Tarefas agendadas
          {cronsComProblema > 0 && (
            <span className="ml-1 rounded-full bg-rose-600 px-1.5 py-0.5 text-3xs font-semibold text-white">
              {cronsComProblema}
            </span>
          )}
        </h2>
        <div className="rounded-md border border-border divide-y divide-border overflow-hidden">
          {crons.map((c) => (
            <div key={c.tipo} className="flex items-start gap-3 p-3 bg-card">
              <IconeStatusCron status={c.status} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium">{c.rotulo}</span>
                  <code className="text-3xs text-muted-foreground font-mono">{c.agenda}</code>
                </div>
                <p className="text-2xs text-muted-foreground mt-0.5">{c.descricao}</p>
              </div>
              <div className="text-right shrink-0">
                <div
                  className={`text-xs font-medium ${
                    c.status === 'atrasado'
                      ? 'text-rose-600 dark:text-rose-400'
                      : c.status === 'nunca'
                        ? 'text-muted-foreground'
                        : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {formatarDesde(c.horasDesde)}
                </div>
                {c.status === 'atrasado' && (
                  <div className="text-3xs text-muted-foreground">passou de {c.toleranciaHoras}h</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-3">Configuração do ambiente</h2>
        <div className="rounded-md border border-border divide-y divide-border overflow-hidden">
          {envs.map((e) => (
            <div key={e.nome} className="flex items-start gap-3 p-3 bg-card">
              {e.presente ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
              ) : e.nivel === 'obrigatoria' ? (
                <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
              ) : (
                <XCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <code className="text-xs font-mono font-medium">{e.nome}</code>
                  {e.nivel === 'alternativa' && <span className="text-3xs text-muted-foreground">grupo {e.grupo}</span>}
                  {e.nivel === 'opcional' && <span className="text-3xs text-muted-foreground">opcional</span>}
                </div>
                <p className="text-2xs text-muted-foreground mt-0.5">{e.impacto}</p>
              </div>
              <span
                className={`text-2xs font-medium shrink-0 ${e.presente ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}
              >
                {e.presente ? 'configurada' : 'ausente'}
              </span>
            </div>
          ))}
        </div>
        {(envsFaltando.length > 0 || !emailOk) && (
          <div className="mt-3 rounded-md border border-rose-600/30 bg-rose-500/5 p-4 space-y-2">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-semibold text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              Configuração incompleta
            </div>
            <ul className="text-xs text-muted-foreground space-y-1">
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
