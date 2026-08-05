'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Search,
  Activity,
  Kanban,
  Zap,
  Settings2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Mail,
  ScrollText,
  ExternalLink,
  LogIn,
  Archive,
  ArchiveRestore,
  ArrowRight,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { EVENTOS, ACOES } from '@/lib/automacoes-catalogo'
import type { ActionResult } from '@/lib/action-result'
import { entrarNoQuadro } from './actions'
import { arquivarQuadro } from '../kanban/actions'
import { alternarAutomacaoAtiva } from '../kanban/actions-automacoes'
import { emailConfigurado, type SaudeCron, type EnvEsperada, type StatusCron } from '@/lib/admin-saude'
import type { Achado, Severidade } from '@/lib/admin-diagnostico'
import { PageHeader, PageShell } from '@/components/layout/page-shell'

type QuadroAdmin = {
  id: string
  nome: string
  codigo: string
  ativo: boolean
  criadoEm: string
  dono: string
  donoAtivo: boolean
  membros: number
  souMembro: boolean
}
type AutomacaoAdmin = {
  id: string
  nome: string
  evento: string
  ativa: boolean
  quadroId: string
  quadroNome: string
  acoes: string[]
  ok: number
  erro: number
  cortado: number
  ultimoErro: string | null
}
type EnvStatus = EnvEsperada & { presente: boolean }
type Metricas = {
  cartoesAbertos: number
  emailsSemana: number
  apontamentosHoje: number
  errosUltimas24h: number
  sessoesAbertas: number
}

const TABS = ['visao-geral', 'quadros', 'automacoes', 'sistema'] as const
type TabValue = (typeof TABS)[number]

// `automacoes.evento` é text no banco, não enum — uma automação gravada antes
// de um evento ser renomeado no catálogo cai no fallback em vez de sumir.
const ROTULO_EVENTO = new Map<string, string>(EVENTOS.map((e) => [e.tipo, e.rotulo]))
const ROTULO_ACAO = new Map<string, string>(ACOES.map((a) => [a.tipo, a.rotulo]))

const ESTILO_SEVERIDADE: Record<Severidade, { borda: string; texto: string; rotulo: string }> = {
  alta: {
    borda: 'border-rose-600/40 bg-rose-500/5',
    texto: 'text-rose-600 dark:text-rose-400',
    rotulo: 'Corrigir',
  },
  media: {
    borda: 'border-amber-600/40 bg-amber-500/5',
    texto: 'text-amber-600 dark:text-amber-400',
    rotulo: 'Atenção',
  },
  baixa: {
    borda: 'border-border bg-card',
    texto: 'text-muted-foreground',
    rotulo: 'Informativo',
  },
}

function CartaoAchado({ achado }: { achado: Achado }) {
  const estilo = ESTILO_SEVERIDADE[achado.severidade]
  return (
    <div className={`rounded-md border p-4 ${estilo.borda}`}>
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <h3 className="text-sm font-semibold leading-snug">{achado.titulo}</h3>
        <span className={`text-3xs font-bold uppercase tracking-wide shrink-0 ${estilo.texto}`}>
          {estilo.rotulo}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{achado.consequencia}</p>

      {achado.exemplos && achado.exemplos.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1">
          {achado.exemplos.map((ex) => (
            <li
              key={ex}
              className="rounded-md bg-muted px-1.5 py-0.5 text-3xs font-medium text-muted-foreground"
            >
              {ex}
            </li>
          ))}
          {achado.quantidade > achado.exemplos.length && (
            <li className="px-1 py-0.5 text-3xs text-muted-foreground">
              +{achado.quantidade - achado.exemplos.length}
            </li>
          )}
        </ul>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-2xs text-muted-foreground flex-1 min-w-40">{achado.comoResolver}</p>
        {achado.link && (
          <Button variant="outline" size="xs" render={<Link href={achado.link.href} />}>
            {achado.link.rotulo}
          </Button>
        )}
      </div>
    </div>
  )
}

function TabCount({ value, tone = 'muted' }: { value: number; tone?: 'muted' | 'alert' }) {
  return (
    <span
      className={`ml-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-3xs font-semibold ${
        tone === 'alert' ? 'bg-rose-600 text-white' : 'bg-muted-foreground/15 text-muted-foreground'
      }`}
    >
      {value}
    </span>
  )
}

function CartaoMetrica({
  icone: Icone,
  rotulo,
  valor,
  detalhe,
  tom = 'neutro',
}: {
  icone: React.ElementType
  rotulo: string
  valor: string | number
  detalhe?: string
  tom?: 'neutro' | 'alerta' | 'erro'
}) {
  const cor =
    tom === 'erro'
      ? 'text-rose-600 dark:text-rose-400'
      : tom === 'alerta'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-foreground'

  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        <Icone className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="text-xs font-medium truncate">{rotulo}</span>
      </div>
      <div className={`text-2xl font-bold tabular-nums ${cor}`}>{valor}</div>
      {detalhe && <p className="text-2xs text-muted-foreground mt-1">{detalhe}</p>}
    </div>
  )
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

export function AdminConsole({
  quadros,
  automacoes,
  crons,
  envs,
  achados,
  metricas,
  defaultTab,
}: {
  quadros: QuadroAdmin[]
  automacoes: AutomacaoAdmin[]
  crons: SaudeCron[]
  envs: EnvStatus[]
  achados: Achado[]
  metricas: Metricas
  defaultTab?: string
}) {
  const [tab, setTab] = useState<TabValue>(
    defaultTab && (TABS as readonly string[]).includes(defaultTab) ? (defaultTab as TabValue) : 'visao-geral'
  )
  const [isPending, startTransition] = useTransition()
  const [buscaQuadros, setBuscaQuadros] = useState('')

  const executar = (acao: () => Promise<ActionResult>, sucesso: string) => {
    startTransition(async () => {
      const res = await acao()
      if (res.ok) toast.success(sucesso)
      else toast.error(res.error)
    })
  }

  const quadrosFiltrados = useMemo(() => {
    const termo = buscaQuadros.trim().toLowerCase()
    if (!termo) return quadros
    return quadros.filter((q) => q.nome.toLowerCase().includes(termo) || q.codigo.toLowerCase().includes(termo))
  }, [quadros, buscaQuadros])

  // "Informativo" não entra no contador: badge que nunca zera vira decoração.
  const achadosAcionaveis = achados.filter((a) => a.severidade !== 'baixa').length
  const cronsComProblema = crons.filter((c) => c.status !== 'ok').length
  const automacoesComErro = automacoes.filter((a) => a.erro > 0).length
  const quadrosOrfaos = quadros.filter((q) => q.ativo && !q.donoAtivo).length

  const presencaEnv = useMemo(
    () => Object.fromEntries(envs.map((e) => [e.nome, e.presente])) as Record<string, boolean>,
    [envs]
  )
  const envsFaltando = envs.filter((e) => e.nivel === 'obrigatoria' && !e.presente)
  const emailOk = emailConfigurado(presencaEnv)

  return (
    <PageShell contentClassName="space-y-6">
      <PageHeader
        title="Sistema"
        description="Diagnóstico, quadros globais, automações e infraestrutura."
        icon={Settings2}
        level={2}
        className="mb-0"
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="visao-geral">
            <Activity className="h-4 w-4 mr-1.5 shrink-0" aria-hidden="true" />
            Diagnóstico
            {achadosAcionaveis + cronsComProblema + envsFaltando.length > 0 && (
              <TabCount value={achadosAcionaveis + cronsComProblema + envsFaltando.length} tone="alert" />
            )}
          </TabsTrigger>
          <TabsTrigger value="quadros">
            <Kanban className="h-4 w-4 mr-1.5 shrink-0" aria-hidden="true" />
            Quadros
            {quadrosOrfaos > 0 ? <TabCount value={quadrosOrfaos} tone="alert" /> : <TabCount value={quadros.length} />}
          </TabsTrigger>
          <TabsTrigger value="automacoes">
            <Zap className="h-4 w-4 mr-1.5 shrink-0" aria-hidden="true" />
            Automações
            {automacoesComErro > 0 ? (
              <TabCount value={automacoesComErro} tone="alert" />
            ) : (
              <TabCount value={automacoes.length} />
            )}
          </TabsTrigger>
          <TabsTrigger value="sistema">
            <Settings2 className="h-4 w-4 mr-1.5 shrink-0" aria-hidden="true" />
            Infraestrutura
          </TabsTrigger>
        </TabsList>

        {/* ---------------------------------------------------------- */}
        <TabsContent value="visao-geral" className="mt-6 space-y-6">
          {/* Os achados vêm primeiro de propósito: a pergunta que traz alguém
              a esta tela é "tem algo quebrado?", não "quantos cartões existem". */}
          <div>
            <h2 className="text-sm font-semibold mb-3">
              Diagnóstico da operação
              {achados.length === 0 && (
                <span className="ml-2 text-xs font-normal text-emerald-600 dark:text-emerald-400">
                  nada a corrigir
                </span>
              )}
            </h2>
            {achados.length === 0 ? (
              <div className="rounded-md border border-border bg-card p-6 flex items-center gap-3">
                <CheckCircle2
                  className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0"
                  aria-hidden="true"
                />
                <p className="text-sm text-muted-foreground">
                  Nenhum problema detectado: todo cartão tem demanda, todo quadro ativo tem etapa de entrega e
                  membros, e não há cronômetro esquecido.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {achados.map((a) => (
                  <CartaoAchado key={a.id} achado={a} />
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <CartaoMetrica icone={Kanban} rotulo="Cartões abertos" valor={metricas.cartoesAbertos} />
            <CartaoMetrica
              icone={Clock}
              rotulo="Apontamentos hoje"
              valor={metricas.apontamentosHoje}
              detalhe={metricas.sessoesAbertas > 0 ? `${metricas.sessoesAbertas} cronômetro(s) rodando agora` : undefined}
            />
            <CartaoMetrica icone={Mail} rotulo="E-mails (7 dias)" valor={metricas.emailsSemana} />
            <CartaoMetrica
              icone={AlertTriangle}
              rotulo="Erros de automação (24h)"
              valor={metricas.errosUltimas24h}
              tom={metricas.errosUltimas24h > 0 ? 'erro' : 'neutro'}
            />
          </div>

          {(envsFaltando.length > 0 || !emailOk) && (
            <div className="rounded-md border border-rose-600/30 bg-rose-500/5 p-4 space-y-2">
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
                {!emailOk && (
                  <li>
                    Nenhum caminho de e-mail configurado (SMTP ou Resend) — nenhuma notificação por e-mail sai.
                  </li>
                )}
              </ul>
            </div>
          )}

          <div>
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
              Tarefas agendadas
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
            <p className="text-2xs text-muted-foreground mt-2">
              Baseado em <span className="font-mono">cron_execucoes</span>, que só é gravada quando o cron realmente
              roda — um agendamento que nunca disparou aparece aqui como &ldquo;nunca executou&rdquo;.
            </p>
          </div>
        </TabsContent>

        {/* ---------------------------------------------------------- */}

        {/* ---------------------------------------------------------- */}
        <TabsContent value="quadros" className="mt-6 space-y-4">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={buscaQuadros}
              onChange={(e) => setBuscaQuadros(e.target.value)}
              placeholder="Buscar por nome ou código..."
              className="pl-9"
              aria-label="Buscar quadro por nome ou código"
            />
          </div>

          {quadrosOrfaos > 0 && (
            <div className="rounded-lg border border-amber-600/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                {quadrosOrfaos} quadro{quadrosOrfaos > 1 ? 's' : ''} sem dono ativo.
              </span>{' '}
              Quem criou foi desativado — vale entrar e reatribuir, ou arquivar.
            </div>
          )}

          <div className="rounded-md border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quadro</TableHead>
                  <TableHead className="hidden md:table-cell">Dono</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Membros</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quadrosFiltrados.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell>
                      <div className="font-medium">{q.nome}</div>
                      <code className="text-3xs text-muted-foreground font-mono">{q.codigo}</code>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className={q.donoAtivo ? 'text-muted-foreground' : 'text-amber-600 dark:text-amber-400'}>
                        {q.dono}
                        {!q.donoAtivo && <span className="text-3xs ml-1">(inativo)</span>}
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-right tabular-nums text-muted-foreground">
                      {q.membros}
                    </TableCell>
                    <TableCell>
                      {q.ativo ? (
                        <span className="text-2xs text-emerald-600 dark:text-emerald-400 font-medium">Ativo</span>
                      ) : (
                        <span className="text-2xs text-muted-foreground">Arquivado</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!q.souMembro && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={isPending}
                            aria-label={`Entrar no quadro ${q.nome}`}
                            title="Entrar como membro"
                            onClick={() => executar(() => entrarNoQuadro(q.id), 'Você entrou no quadro.')}
                          >
                            <LogIn className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={isPending}
                          aria-label={q.ativo ? `Arquivar quadro ${q.nome}` : `Reativar quadro ${q.nome}`}
                          title={q.ativo ? 'Arquivar' : 'Reativar'}
                          onClick={() =>
                            executar(
                              () => arquivarQuadro(q.id, !q.ativo),
                              q.ativo ? 'Quadro arquivado.' : 'Quadro reativado.'
                            )
                          }
                        >
                          {q.ativo ? (
                            <Archive className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <ArchiveRestore className="h-4 w-4" aria-hidden="true" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Abrir quadro ${q.nome}`}
                          title="Abrir"
                          render={<Link href={`/kanban/${q.id}`} />}
                        >
                          <ExternalLink className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {quadrosFiltrados.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                      Nenhum quadro encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ---------------------------------------------------------- */}
        <TabsContent value="automacoes" className="mt-6 space-y-4">
          {automacoes.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-10 text-center">
              <Zap className="h-8 w-8 text-muted-foreground mx-auto mb-3" aria-hidden="true" />
              <p className="text-sm font-medium">Nenhuma automação criada ainda</p>
              <p className="text-xs text-muted-foreground mt-1">
                Elas são criadas dentro de cada quadro, na aba Automações.
              </p>
            </div>
          ) : (
            <div className="rounded-md border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Automação</TableHead>
                    <TableHead className="hidden lg:table-cell">Quando</TableHead>
                    <TableHead className="hidden sm:table-cell">Execuções (7 dias)</TableHead>
                    <TableHead className="text-right">Ativa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {automacoes.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div className="font-medium">{a.nome}</div>
                        <Link
                          href={`/kanban/${a.quadroId}`}
                          className="text-3xs text-muted-foreground hover:text-primary hover:underline"
                        >
                          {a.quadroNome}
                        </Link>
                      </TableCell>
                      {/* Nome de automação raramente descreve o que ela faz
                          ("TESTEEEE", "Play") — sem as ações, desligar uma
                          vira aposta. */}
                      <TableCell className="hidden lg:table-cell">
                        <div className="text-xs text-muted-foreground">
                          {ROTULO_EVENTO.get(a.evento) ?? a.evento}
                        </div>
                        {a.acoes.length > 0 && (
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" aria-hidden="true" />
                            {a.acoes.map((acao, i) => (
                              <span
                                key={`${acao}-${i}`}
                                className="rounded-md bg-muted px-1.5 py-0.5 text-3xs font-medium text-muted-foreground"
                              >
                                {ROTULO_ACAO.get(acao) ?? acao}
                              </span>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex items-center gap-2 text-2xs">
                          <span className="text-muted-foreground tabular-nums">{a.ok} ok</span>
                          {a.erro > 0 && (
                            <span className="text-rose-600 dark:text-rose-400 font-semibold tabular-nums">
                              {a.erro} erro{a.erro > 1 ? 's' : ''}
                            </span>
                          )}
                          {a.cortado > 0 && (
                            <span
                              className="text-amber-600 dark:text-amber-400 tabular-nums"
                              title="A trava anti-loop impediu o encadeamento"
                            >
                              {a.cortado} cortada{a.cortado > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        {a.ultimoErro && (
                          <p className="text-3xs text-muted-foreground mt-0.5 truncate max-w-xs" title={a.ultimoErro}>
                            {a.ultimoErro}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Switch
                          checked={a.ativa}
                          disabled={isPending}
                          aria-label={`${a.ativa ? 'Desligar' : 'Ligar'} a automação ${a.nome}`}
                          onCheckedChange={(v) =>
                            executar(
                              () => alternarAutomacaoAtiva(a.id, a.quadroId, v),
                              v ? 'Automação ligada.' : 'Automação desligada.'
                            )
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ---------------------------------------------------------- */}
        <TabsContent value="sistema" className="mt-6 space-y-6">
          <div>
            <h2 className="text-sm font-semibold mb-3">Configuração do ambiente</h2>
            <div className="rounded-md border border-border divide-y divide-border overflow-hidden">
              {envs.map((e) => (
                <div key={e.nome} className="flex items-start gap-3 p-3 bg-card">
                  {e.presente ? (
                    <CheckCircle2
                      className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                  ) : e.nivel === 'obrigatoria' ? (
                    <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
                  ) : (
                    <XCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <code className="text-xs font-mono font-medium">{e.nome}</code>
                      {e.nivel === 'alternativa' && (
                        <span className="text-3xs text-muted-foreground">grupo {e.grupo}</span>
                      )}
                      {e.nivel === 'opcional' && <span className="text-3xs text-muted-foreground">opcional</span>}
                    </div>
                    <p className="text-2xs text-muted-foreground mt-0.5">{e.impacto}</p>
                  </div>
                  <span
                    className={`text-2xs font-medium shrink-0 ${
                      e.presente ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
                    }`}
                  >
                    {e.presente ? 'configurada' : 'ausente'}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-2xs text-muted-foreground mt-2">
              Só a presença é exibida — nenhum valor sai do servidor.
            </p>
          </div>

          <div>
            <h2 className="text-sm font-semibold mb-3">Envio de e-mail</h2>
            <div className="rounded-md border border-border bg-card p-4 flex items-start gap-3">
              {emailOk ? (
                <CheckCircle2
                  className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
              ) : (
                <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
              )}
              <p className="text-xs text-muted-foreground">
                {emailOk
                  ? presencaEnv.SMTP_HOST && presencaEnv.SMTP_USER
                    ? 'Configurado via SMTP. O Resend é usado só se o SMTP sair do ar.'
                    : 'Configurado via Resend.'
                  : 'Nenhum caminho configurado. Basta SMTP_HOST + SMTP_USER, ou RESEND_API_KEY.'}
              </p>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold mb-3">Trilha de auditoria</h2>
            <Button variant="outline" render={<Link href="/gestao/auditoria" />}>
              <ScrollText className="h-4 w-4 mr-2" aria-hidden="true" />
              Abrir auditoria global
            </Button>
            <p className="text-2xs text-muted-foreground mt-2">
              Toda concessão e revogação de admin fica registrada lá, com quem fez e quando.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </PageShell>
  )
}
