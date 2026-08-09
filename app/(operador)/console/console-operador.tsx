'use client'

import { useState } from 'react'
import { AlertTriangle, Building2, ChevronDown, ChevronRight, Clock, History, ShieldCheck, CircleDot } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageHeader, PageShell, SectionHeader } from '@/components/layout/page-shell'
import { EstadoBadge, type EstadoBadgeEstado } from '@/components/ui/estado-badge'
import type { SaudeCron, EnvEsperada, StatusCron } from '@/lib/admin-saude'
import { emailConfigurado } from '@/lib/admin-saude'
import { PainelOrganizacao } from './painel-organizacao'
import type { AcaoOperador, OrganizacaoOperador } from './tipos'

type EnvStatus = EnvEsperada & { presente: boolean }

const ESTADO_STATUS: Record<string, { estado: EstadoBadgeEstado; rotulo: string }> = {
  trialing: { estado: 'atencao', rotulo: 'Em teste' },
  ativa: { estado: 'sucesso', rotulo: 'Cliente ativo' },
  suspensa: { estado: 'erro', rotulo: 'Suspensa' },
  expirada: { estado: 'neutro', rotulo: 'Expirada' },
  excluindo: { estado: 'erro', rotulo: 'Em exclusão' },
}

const ESTADO_CRON: Record<StatusCron, EstadoBadgeEstado> = { ok: 'sucesso', atrasado: 'erro', nunca: 'neutro' }

const ROTULO_ACAO: Record<string, string> = {
  'organizacao.ativar': 'Liberou acesso',
  'organizacao.suspender': 'Suspendeu',
  'organizacao.reativar': 'Reativou',
  'organizacao.limite_assentos': 'Mudou assentos',
  'organizacao.estender_trial': 'Estendeu cortesia',
  'organizacao.encerrar_trial': 'Encerrou cortesia',
}

function diasAte(iso: string | null): number | null {
  if (!iso) return null
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

function formatarDesde(horas: number | null): string {
  if (horas === null) return 'nunca executou'
  if (horas < 1) return `há ${Math.max(1, Math.round(horas * 60))} min`
  if (horas < 48) return `há ${Math.round(horas)} h`
  return `há ${Math.round(horas / 24)} dias`
}

function CartaoKpi({ rotulo, valor, nota, estado }: { rotulo: string; valor: React.ReactNode; nota?: string; estado?: EstadoBadgeEstado }) {
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
      {nota && <p className="mt-1 text-3xs text-muted-foreground">{nota}</p>}
    </div>
  )
}

export function ConsoleOperador({
  organizacoes,
  crons,
  envs,
  trilha,
}: {
  organizacoes: OrganizacaoOperador[]
  crons: SaudeCron[]
  envs: EnvStatus[]
  trilha: AcaoOperador[]
}) {
  const [aberta, setAberta] = useState<string | null>(null)

  const presencaEnv = Object.fromEntries(envs.map((e) => [e.nome, e.presente])) as Record<string, boolean>
  const envsFaltando = envs.filter((e) => e.nivel === 'obrigatoria' && !e.presente)
  const emailOk = emailConfigurado(presencaEnv)
  const cronsComProblema = crons.filter((c) => c.status !== 'ok').length
  const configOk = envsFaltando.length === 0 && emailOk

  // ── Relatórios ──────────────────────────────────────────────────────
  const clientes = organizacoes.filter((o) => o.status === 'ativa')
  const emTeste = organizacoes.filter((o) => o.status === 'trialing')
  const emRisco = organizacoes.filter((o) => o.emRisco)
  const assentosVendidos = clientes.reduce((s, o) => s + o.limiteAssentos, 0)
  const assentosEmUso = organizacoes.reduce((s, o) => s + o.assentosOcupados, 0)
  // Vem pronto do servidor: ler o relógio no render do cliente é impuro
  // (react-hooks/purity) e daria número diferente a cada re-render.
  const novasNoMes = organizacoes.filter((o) => o.novaNoMes).length

  return (
    <PageShell contentClassName="space-y-8">
      <PageHeader
        title="Console do operador"
        description="A plataforma inteira: clientes, acessos, assentos e saúde da infraestrutura. Isto não é a tela de administração de uma empresa cliente."
        icon={Building2}
        level={2}
        className="mb-0"
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CartaoKpi
          rotulo="Clientes ativos"
          valor={clientes.length}
          nota={`${assentosVendidos} assentos contratados`}
          estado={clientes.length > 0 ? 'sucesso' : undefined}
        />
        <CartaoKpi
          rotulo="Em teste"
          valor={emTeste.length}
          nota={`${novasNoMes} nova(s) em 30 dias`}
          estado={emTeste.length > 0 ? 'atencao' : undefined}
        />
        <CartaoKpi rotulo="Assentos em uso" valor={assentosEmUso} nota="soma de toda a plataforma" />
        <CartaoKpi
          rotulo="Precisam de atenção"
          valor={emRisco.length}
          nota="cortesia acabando ou parado há 14 dias"
          estado={emRisco.length > 0 ? 'erro' : undefined}
        />
      </div>

      <div>
        <SectionHeader
          title="Organizações"
          description="Clique numa linha para liberar acesso, ajustar assentos, mexer na cortesia ou conferir os dados."
        />
        <div className="overflow-x-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Organização</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Assentos</TableHead>
                <TableHead className="text-right">Atividade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizacoes.map((o) => {
                const estado = ESTADO_STATUS[o.status] ?? { estado: 'neutro' as const, rotulo: o.status }
                const dias = o.status === 'trialing' ? diasAte(o.trialExpiraEm) : null
                const expandida = aberta === o.id
                return [
                  <TableRow
                    key={o.id}
                    onClick={() => setAberta(expandida ? null : o.id)}
                    className="cursor-pointer"
                    aria-expanded={expandida}
                  >
                    <TableCell className="text-muted-foreground">
                      {expandida ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{o.nome}</span>
                        {o.emRisco && <EstadoBadge estado="erro" tamanho="sm" icone={AlertTriangle}>risco</EstadoBadge>}
                      </div>
                      <code className="text-3xs font-mono text-muted-foreground">
                        {o.slug} · {o.plano}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <EstadoBadge estado={estado.estado}>{estado.rotulo}</EstadoBadge>
                        {dias !== null && (
                          <span className="text-3xs text-muted-foreground">
                            {dias > 0 ? `${dias}d restante(s)` : 'venceu'}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {o.assentosOcupados} / {o.limiteAssentos}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {o.diasSemAtividade === null
                        ? 'nunca usou'
                        : o.diasSemAtividade === 0
                          ? 'hoje'
                          : `há ${o.diasSemAtividade}d`}
                    </TableCell>
                  </TableRow>,
                  expandida ? (
                    <TableRow key={`${o.id}-painel`}>
                      <TableCell colSpan={5} className="p-0">
                        <PainelOrganizacao org={o} />
                      </TableCell>
                    </TableRow>
                  ) : null,
                ]
              })}
              {organizacoes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
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
              <History className="size-4 text-muted-foreground" aria-hidden />
              Trilha das suas ações
            </span>
          }
          description="Toda decisão sobre conta de cliente fica registrada aqui."
        />
        <div className="divide-y divide-border overflow-hidden rounded-md border border-border">
          {trilha.map((a) => (
            <div key={a.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 bg-card px-3 py-2 text-sm">
              <span className="font-medium">{ROTULO_ACAO[a.acao] ?? a.acao}</span>
              <span className="text-muted-foreground">{a.organizacaoNome ?? '—'}</span>
              <span className="ml-auto shrink-0 font-mono text-3xs text-muted-foreground">
                {new Date(a.criadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
              </span>
            </div>
          ))}
          {trilha.length === 0 && (
            <p className="bg-card px-3 py-6 text-center text-sm text-muted-foreground">
              Nenhuma ação registrada ainda.
            </p>
          )}
        </div>
      </div>

      <div>
        <SectionHeader
          title={
            <span className="inline-flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" aria-hidden />
              Tarefas agendadas
            </span>
          }
          actions={
            cronsComProblema > 0 ? (
              <EstadoBadge estado="erro">{cronsComProblema} com problema</EstadoBadge>
            ) : (
              <EstadoBadge estado="sucesso" icone={ShieldCheck}>Tudo em dia</EstadoBadge>
            )
          }
        />
        <div className="divide-y divide-border overflow-hidden rounded-md border border-border">
          {crons.map((c) => (
            <div key={c.tipo} className="flex items-start gap-3 bg-card p-3">
              <CircleDot
                className={`mt-0.5 size-4 shrink-0 ${
                  c.status === 'ok' ? 'text-success-texto' : c.status === 'atrasado' ? 'text-danger-texto' : 'text-muted-foreground'
                }`}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium">{c.rotulo}</span>
                  <code className="text-3xs font-mono text-muted-foreground">{c.agenda}</code>
                </div>
                <p className="mt-0.5 text-2xs text-muted-foreground">{c.descricao}</p>
              </div>
              <div className="shrink-0 text-right">
                <EstadoBadge estado={ESTADO_CRON[c.status]} tamanho="sm">{formatarDesde(c.horasDesde)}</EstadoBadge>
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
              <EstadoBadge estado="sucesso" icone={ShieldCheck}>Completa</EstadoBadge>
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
              <AlertTriangle className="size-4 shrink-0" aria-hidden />
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
