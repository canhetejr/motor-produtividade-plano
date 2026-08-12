'use client'

import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, Download, ShieldCheck } from 'lucide-react'
import { PageShell } from '@/components/layout/page-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EstadoBadge, type EstadoBadgeEstado } from '@/components/ui/estado-badge'
import { VerticeSymbol } from '@/components/vertice-symbol'
import { cn } from '@/lib/utils'
import type { SaudeCron, EnvEsperada, StatusCron } from '@/lib/admin-saude'
import { emailConfigurado } from '@/lib/admin-saude'
import { PainelOrganizacao } from './painel-organizacao'
import { CatalogoPlanos } from './catalogo-planos'
import { IntegracoesCobranca } from './integracoes-cobranca'
import type { AcaoOperador, OrganizacaoOperador, PlanoOperador } from './tipos'

type EnvStatus = EnvEsperada & { presente: boolean }

const ESTADO_STATUS: Record<string, { estado: EstadoBadgeEstado; rotulo: string }> = {
  trialing: { estado: 'atencao', rotulo: 'Em teste' },
  ativa: { estado: 'sucesso', rotulo: 'Cliente' },
  suspensa: { estado: 'erro', rotulo: 'Suspensa' },
  expirada: { estado: 'neutro', rotulo: 'Expirada' },
  excluindo: { estado: 'erro', rotulo: 'Em exclusão' },
}

const ROTULO_ACAO: Record<string, string> = {
  'organizacao.ativar': 'Liberou acesso',
  'organizacao.suspender': 'Suspendeu',
  'organizacao.reativar': 'Reativou',
  'organizacao.limite_assentos': 'Mudou assentos',
  'organizacao.estender_trial': 'Estendeu cortesia',
  'organizacao.encerrar_trial': 'Encerrou cortesia',
  'organizacao.marcar_exclusao': 'Marcou para exclusão',
  'organizacao.cancelar_exclusao': 'Cancelou exclusão',
  'organizacao.excluir': 'APAGOU em definitivo',
  'organizacao.atribuir_plano': 'Trocou o plano',
  'plano.criar': 'Criou plano',
  'plano.atualizar': 'Atualizou plano',
  'plano.ativar': 'Ativou plano',
  'plano.desativar': 'Desativou plano',
  'assinatura_manual.criar': 'Registrou assinatura manual',
  'assinatura_manual.atualizar': 'Atualizou assinatura manual',
  'assinatura_manual.pausar': 'Pausou assinatura manual',
  'assinatura_manual.cancelar': 'Cancelou assinatura manual',
}

const FILTROS = [
  { valor: 'todas', rotulo: 'Todas' },
  { valor: 'ativa', rotulo: 'Clientes' },
  { valor: 'trialing', rotulo: 'Em teste' },
  { valor: 'inativas', rotulo: 'Inativas' },
] as const satisfies readonly { valor: string; rotulo: string }[]

const COLUNAS_CSV = [
  'nome',
  'slug',
  'status',
  'plano',
  'assentos_ocupados',
  'limite_assentos',
  'trial_expira_em',
  'criado_em',
  'ultima_atividade',
  'dias_sem_atividade',
  'em_risco',
] as const

/**
 * Exporta a carteira como CSV, gerado no navegador a partir do que já está em
 * memória — sem rota nova, sem consulta a mais.
 *
 * Aspas dobradas e campo entre aspas porque nome de empresa com vírgula é
 * comum e quebraria a coluna seguinte em silêncio; separador `;` e BOM porque
 * o destino real disto é o Excel em pt-BR, que sem os dois abre tudo numa
 * coluna só.
 */
function baixarCsv(organizacoes: OrganizacaoOperador[]) {
  const escapar = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`
  const linhas = organizacoes.map((o) =>
    [
      o.nome,
      o.slug,
      o.status,
      o.plano,
      o.assentosOcupados,
      o.limiteAssentos,
      o.trialExpiraEm ?? '',
      o.criadoEm,
      o.ultimaAtividade ?? '',
      o.diasSemAtividade ?? '',
      o.emRisco ? 'sim' : 'nao',
    ]
      .map(escapar)
      .join(';')
  )
  const csv = '﻿' + [COLUNAS_CSV.join(';'), ...linhas].join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `vertice-organizacoes-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function diasAte(iso: string | null): number | null {
  if (!iso) return null
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

function formatarDesde(horas: number | null): string {
  if (horas === null) return 'nunca'
  if (horas < 1) return `${Math.max(1, Math.round(horas * 60))} min`
  if (horas < 48) return `${Math.round(horas)} h`
  return `${Math.round(horas / 24)} d`
}

/** Motivo pelo qual a conta pede atenção — o alarme sem o porquê não serve. */
function motivoRisco(o: OrganizacaoOperador): string | null {
  const dias = o.status === 'trialing' ? diasAte(o.trialExpiraEm) : null
  if (dias !== null && dias <= 3) {
    return dias <= 0 ? 'cortesia venceu' : `cortesia acaba em ${dias}d`
  }
  if (o.diasSemAtividade !== null && o.diasSemAtividade >= 14) {
    return `parada há ${o.diasSemAtividade}d`
  }
  return null
}

/** Medidor de assentos — a mesma linguagem visual de /gestao/acessos. */
function Medidor({ ocupados, limite, className }: { ocupados: number; limite: number; className?: string }) {
  const pct = limite > 0 ? Math.min(100, Math.round((ocupados / limite) * 100)) : 0
  const livre = limite - ocupados
  return (
    <span className={cn('block h-1 overflow-hidden rounded-full bg-muted', className)} role="presentation">
      <span
        className={cn('block h-full rounded-full', livre <= 0 ? 'bg-danger' : pct >= 80 ? 'bg-warning' : 'bg-success')}
        style={{ width: `${pct}%` }}
      />
    </span>
  )
}

export function ConsoleOperador({
  organizacoes,
  planos,
  crons,
  envs,
  trilha,
}: {
  organizacoes: OrganizacaoOperador[]
  planos: PlanoOperador[]
  crons: SaudeCron[]
  envs: EnvStatus[]
  trilha: AcaoOperador[]
}) {
  const [aberta, setAberta] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<'todas' | 'ativa' | 'trialing' | 'inativas'>('todas')

  const presencaEnv = Object.fromEntries(envs.map((e) => [e.nome, e.presente])) as Record<string, boolean>
  const envsFaltando = envs.filter((e) => e.nivel === 'obrigatoria' && !e.presente)
  const emailOk = emailConfigurado(presencaEnv)
  const cronsComProblema = crons.filter((c) => c.status !== 'ok')
  const infraOk = envsFaltando.length === 0 && emailOk && cronsComProblema.length === 0

  const clientes = organizacoes.filter((o) => o.status === 'ativa')
  const emTeste = organizacoes.filter((o) => o.status === 'trialing')
  const emRisco = organizacoes.filter((o) => o.emRisco)
  // Duas contas diferentes, de propósito:
  //  - capacidade: teto somado de TODAS as organizações (é com o que os
  //    assentos em uso se comparam — mesmo conjunto dos dois lados).
  //  - contratados: só de quem paga. É o número comercial, e misturá-lo com
  //    trial daria uma fração que não quer dizer nada.
  const capacidadeTotal = organizacoes.reduce((s, o) => s + o.limiteAssentos, 0)
  const assentosContratados = clientes.reduce((s, o) => s + o.limiteAssentos, 0)
  const assentosEmUso = organizacoes.reduce((s, o) => s + o.assentosOcupados, 0)
  const novasNoMes = organizacoes.filter((o) => o.novaNoMes).length

  // Filtro só sobre a LISTA — os números do cabeçalho continuam falando da
  // plataforma inteira. Um total que muda quando se digita na busca deixa de
  // ser um total.
  const termo = busca.trim().toLowerCase()
  const listadas = organizacoes.filter((o) => {
    if (termo && !o.nome.toLowerCase().includes(termo) && !o.slug.toLowerCase().includes(termo)) return false
    if (filtro === 'inativas') return o.status !== 'ativa' && o.status !== 'trialing'
    if (filtro !== 'todas') return o.status === filtro
    return true
  })

  return (
    <PageShell contentClassName="space-y-10">
      {/* ── Estado da plataforma ────────────────────────────────────────
          Um número dominante, não quatro de mesmo peso (design.md §1,
          "convergência"). O que manda numa plataforma por assento é quanto
          do que foi contratado está de fato em uso. */}
      <header className="border-b border-border/70 pb-6">
        <div className="flex items-center gap-2">
          <VerticeSymbol className="h-4 w-4" />
          <p className="font-mono text-2xs uppercase tracking-[0.14em] text-muted-foreground">
            Console do operador
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-end gap-x-10 gap-y-5">
          <div>
            <p className="flex items-baseline gap-2 font-mono tabular-nums">
              <span className="text-5xl font-medium leading-none text-foreground">{assentosEmUso}</span>
              <span className="text-xl leading-none text-muted-foreground">/ {capacidadeTotal || '—'}</span>
            </p>
            <p className="mt-2 text-sm text-muted-foreground">assentos em uso na plataforma</p>
            {capacidadeTotal > 0 && (
              <Medidor ocupados={assentosEmUso} limite={capacidadeTotal} className="mt-3 w-56" />
            )}
          </div>

          <dl className="flex flex-wrap gap-x-8 gap-y-3 pb-1 text-sm">
            <div>
              <dt className="text-2xs uppercase tracking-wide text-muted-foreground">Clientes</dt>
              <dd className="mt-0.5 font-mono text-2xl font-medium tabular-nums text-success-texto">
                {clientes.length}
              </dd>
            </div>
            <div>
              <dt className="text-2xs uppercase tracking-wide text-muted-foreground">Em teste</dt>
              <dd className="mt-0.5 font-mono text-2xl font-medium tabular-nums text-warning-texto">
                {emTeste.length}
              </dd>
            </div>
            <div>
              <dt className="text-2xs uppercase tracking-wide text-muted-foreground">Novas em 30d</dt>
              <dd className="mt-0.5 font-mono text-2xl font-medium tabular-nums text-foreground">{novasNoMes}</dd>
            </div>
            <div>
              <dt className="text-2xs uppercase tracking-wide text-muted-foreground">Contratados</dt>
              <dd className="mt-0.5 font-mono text-2xl font-medium tabular-nums text-foreground">
                {assentosContratados}
              </dd>
            </div>
          </dl>
        </div>
      </header>

      {/* Só aparece quando há de fato algo para agir. Um bloco "0" todo dia
          treina o olho a ignorar a seção — e no dia que importar, ninguém
          olha (mesma decisão do painel de atenção em /gestao). */}
      {emRisco.length > 0 && (
        <section className="rounded-md border border-warning-borda bg-warning-superficie p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-warning-texto">
            <AlertTriangle className="size-4 shrink-0" aria-hidden />
            {emRisco.length === 1 ? '1 conta pede atenção hoje' : `${emRisco.length} contas pedem atenção hoje`}
          </h2>
          <ul className="mt-3 flex flex-col gap-1.5">
            {emRisco.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => setAberta(o.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-md border border-border/60 bg-card px-3 py-2 text-left text-sm transition-colors hover:border-warning-borda"
                >
                  <span className="min-w-0 truncate font-medium">{o.nome}</span>
                  <span className="shrink-0 text-2xs text-muted-foreground">{motivoRisco(o)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <CatalogoPlanos planos={planos} />

      <IntegracoesCobranca />

      {/* ── Organizações ───────────────────────────────────────────────
          Lista com divisores, não tabela emoldurada: design.md pede seção
          sem moldura, e sem <table> o texto do painel expandido volta a
          quebrar linha sozinho (TableCell impõe whitespace-nowrap). */}
      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-2 border-b border-border pb-2">
          <h2 className="text-base font-semibold">Organizações</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou slug"
              className="h-8 w-52"
              aria-label="Buscar organização"
            />
            <div className="flex gap-1" role="group" aria-label="Filtrar por situação">
              {FILTROS.map((f) => (
                <button
                  key={f.valor}
                  type="button"
                  onClick={() => setFiltro(f.valor)}
                  aria-pressed={filtro === f.valor}
                  className={cn(
                    'rounded-sm border px-2 py-1 text-3xs transition-colors',
                    filtro === f.valor
                      ? 'border-primary/40 bg-primary/10 text-foreground'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  )}
                >
                  {f.rotulo}
                </button>
              ))}
            </div>
            <Button size="xs" variant="ghost" onClick={() => baixarCsv(listadas)} disabled={listadas.length === 0}>
              <Download className="size-3.5" /> CSV
            </Button>
          </div>
        </div>

        <p className="pt-2 font-mono text-2xs text-muted-foreground">
          {listadas.length === organizacoes.length
            ? `${organizacoes.length} no total`
            : `${listadas.length} de ${organizacoes.length}`}
        </p>

        <ul className="divide-y divide-border">
          {listadas.map((o) => {
            const estado = ESTADO_STATUS[o.status] ?? { estado: 'neutro' as const, rotulo: o.status }
            const dias = o.status === 'trialing' ? diasAte(o.trialExpiraEm) : null
            const expandida = aberta === o.id
            return (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => setAberta(expandida ? null : o.id)}
                  aria-expanded={expandida}
                  className="flex w-full items-center gap-4 px-1 py-3 text-left transition-colors hover:bg-muted/40"
                >
                  <span className="shrink-0 text-muted-foreground">
                    {expandida ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium">{o.nome}</span>
                      <EstadoBadge estado={estado.estado} tamanho="sm">{estado.rotulo}</EstadoBadge>
                      {dias !== null && (
                        <span className="font-mono text-3xs text-muted-foreground">
                          {dias > 0 ? `${dias}d` : 'venceu'}
                        </span>
                      )}
                      {o.emRisco && (
                        <span className="font-mono text-3xs text-warning-texto">· {motivoRisco(o)}</span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-3xs text-muted-foreground">
                      {o.slug} · {o.plano}
                      {o.assinaturaManual && ` · assinatura ${o.assinaturaManual.status}`}
                      {/* No celular a coluna de assentos não cabe e some — mas
                          assento é o número central desta tela, então ele volta
                          aqui em vez de sumir. */}
                      <span className="sm:hidden"> · {o.assentosOcupados}/{o.limiteAssentos} assentos</span>
                    </span>
                  </span>

                  <span className="hidden w-32 shrink-0 sm:block">
                    <span className="mb-1 block text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {o.assentosOcupados}/{o.limiteAssentos}
                    </span>
                    <Medidor ocupados={o.assentosOcupados} limite={o.limiteAssentos} />
                  </span>

                  <span className="hidden w-24 shrink-0 text-right font-mono text-3xs text-muted-foreground md:block">
                    {o.diasSemAtividade === null
                      ? 'nunca usou'
                      : o.diasSemAtividade === 0
                        ? 'hoje'
                        : `há ${o.diasSemAtividade}d`}
                  </span>
                </button>

                {expandida && <PainelOrganizacao org={o} planos={planos} />}
              </li>
            )
          })}
          {listadas.length === 0 && (
            <li className="py-10 text-center text-sm text-muted-foreground">
              {organizacoes.length === 0
                ? 'Nenhuma organização cadastrada.'
                : 'Nenhuma organização com esse filtro.'}
            </li>
          )}
        </ul>
      </section>

      {/* ── Trilha ─────────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2">
          <h2 className="text-base font-semibold">Trilha das suas ações</h2>
          {/* Escondido no celular: ao lado de um título que já quebra em duas
              linhas, a legenda quebrava em outras duas e o cabeçalho virava um
              bloco de quatro linhas. É explicação, não informação. */}
          <p className="hidden text-2xs text-muted-foreground sm:block">toda decisão sobre conta de cliente</p>
        </div>
        {trilha.length > 0 ? (
          <ul className="divide-y divide-border">
            {trilha.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline gap-x-2 px-1 py-2 text-sm">
                <span className="font-medium">{ROTULO_ACAO[a.acao] ?? a.acao}</span>
                <span className="min-w-0 truncate text-muted-foreground">{a.organizacaoNome ?? '—'}</span>
                <time className="ml-auto shrink-0 font-mono text-3xs text-muted-foreground">
                  {new Date(a.criadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                </time>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-6 text-sm text-muted-foreground">
            Nada ainda. Liberar acesso, mexer em assentos ou na cortesia registra aqui.
          </p>
        )}
      </section>

      {/* ── Infraestrutura ─────────────────────────────────────────────
          Crons e ambiente juntos: são a mesma pergunta ("a plataforma está
          de pé?"), e separá-los em duas seções longas empurrava o que
          importa para fora da tela. Detalhe só quando há problema. */}
      <section>
        <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2">
          <h2 className="text-base font-semibold">Infraestrutura</h2>
          {infraOk ? (
            <EstadoBadge estado="sucesso" tamanho="sm" icone={ShieldCheck}>tudo em dia</EstadoBadge>
          ) : (
            <EstadoBadge estado="erro" tamanho="sm">
              {(() => {
                const n = cronsComProblema.length + envsFaltando.length + (emailOk ? 0 : 1)
                return n === 1 ? '1 problema' : `${n} problemas`
              })()}
            </EstadoBadge>
          )}
        </div>

        <ul className="divide-y divide-border">
          {crons.map((c) => {
            const cor: Record<StatusCron, string> = {
              ok: 'text-success-texto',
              atrasado: 'text-danger-texto',
              nunca: 'text-muted-foreground',
            }
            return (
              <li key={c.tipo} className="flex flex-wrap items-baseline gap-x-3 px-1 py-2 text-sm">
                <span className={cn('font-mono text-3xs', cor[c.status])}>●</span>
                <span className="font-medium">{c.rotulo}</span>
                <code className="font-mono text-3xs text-muted-foreground">{c.agenda}</code>
                <span className={cn('ml-auto shrink-0 font-mono text-3xs', cor[c.status])}>
                  {formatarDesde(c.horasDesde)}
                  {c.status === 'atrasado' && ` · passou de ${c.toleranciaHoras}h`}
                </span>
              </li>
            )
          })}
        </ul>

        {/* Lista completa de variáveis é ruído num console: o que importa é
            o que está FALTANDO. Tudo certo vira uma linha. */}
        {envsFaltando.length === 0 && emailOk ? (
          <p className="mt-3 text-2xs text-muted-foreground">
            {envs.length} variáveis de ambiente conferidas — nenhuma pendência, e o envio de e-mail está configurado.
          </p>
        ) : (
          <div className="mt-3 space-y-1.5 rounded-md border border-danger-borda bg-danger-superficie p-3">
            <p className="text-2xs font-semibold uppercase tracking-wide text-danger-texto">Configuração incompleta</p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {envsFaltando.map((e) => (
                <li key={e.nome}>
                  <span className="font-mono text-foreground">{e.nome}</span> ausente — {e.impacto}
                </li>
              ))}
              {!emailOk && (
                <li>Nenhum caminho de e-mail configurado (SMTP ou Resend) — convite e notificação não saem.</li>
              )}
            </ul>
          </div>
        )}
      </section>
    </PageShell>
  )
}
