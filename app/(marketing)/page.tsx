import Link from 'next/link'
import {
  ArrowRight,
  BarChart3,
  Bell,
  CalendarSync,
  ClipboardList,
  FileInput,
  GaugeCircle,
  KanbanSquare,
  Lock,
  ShieldCheck,
  Workflow,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Vertice3D } from '@/components/vertice-3d'
import { JanelaApp } from '@/components/marketing/janela-app'
import { PreviewKanban } from '@/components/marketing/preview-kanban'
import { PreviewDashboard } from '@/components/marketing/preview-dashboard'

// Assume a rota `/`. utils/supabase/middleware.ts já deixa `/` passar
// deslogado; o redirect de quem já está logado fica no proxy (que já tem o
// user em mãos), então esta página continua estática.
export const metadata = {
  title: 'Vértice — Clareza para o trabalho avançar',
  description:
    'Apontamento diário, Kanban com automações e dashboards de produtividade no mesmo lugar. 14 dias grátis, sem cartão de crédito.',
}

const SEM_VERTICE = [
  'Planilha que só o autor entende, atualizada de memória na sexta',
  'Ninguém sabe quem está sobrecarregado até alguém estourar o prazo',
  'Relatório de produtividade custa uma tarde de exportação e fórmula',
]

const COM_VERTICE = [
  'Apontamento de dois minutos, índice calculado sozinho',
  'Capacidade da equipe visível todo dia, antes de virar problema',
  'Relatório semanal pronto, no e-mail de quem precisa ver',
]

const RECURSOS = [
  {
    icone: Workflow,
    titulo: 'Automações no quadro',
    descricao: 'Regras que movem cartão, avisam responsável e disparam checklist sem ninguém lembrar.',
  },
  {
    icone: ClipboardList,
    titulo: 'Aprovações com histórico',
    descricao: 'Horas fora do padrão e entregas sensíveis passam por aprovação — com trilha de quem decidiu o quê.',
  },
  {
    icone: FileInput,
    titulo: 'Formulários públicos',
    descricao: 'Receba demanda de fora da equipe por um link, e ela entra direto no quadro como cartão.',
  },
  {
    icone: Bell,
    titulo: 'Alertas que chegam antes',
    descricao: 'Queda de produtividade e prazo curto viram notificação e push, não descoberta tardia.',
  },
  {
    icone: CalendarSync,
    titulo: 'Google Calendar',
    descricao: 'Prazo de cartão vira evento na agenda de quem é responsável, atualizado automaticamente.',
  },
  {
    icone: BarChart3,
    titulo: 'Relatórios agendados',
    descricao: 'O resumo da semana sai sozinho, no dia e para a lista que você definir.',
  },
]

export default function LandingPage() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────
          O produto aparece na primeira tela. A página antes descrevia o
          Vértice sem nunca deixar ver — mostrar a interface é o que faz a
          diferença entre explicar e convencer. */}
      <section className="relative overflow-hidden px-6 pt-20 pb-0 sm:pt-28">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 -z-10 h-[720px] bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,color-mix(in_oklch,var(--v-purple),transparent_78%),transparent_70%)]"
        />
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-7 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 font-mono text-xs text-white/70">
            <span className="size-1.5 rounded-full bg-[var(--v-mint)]" aria-hidden />
            Gestão de trabalho, de ponta a ponta
          </span>
          <h1 className="text-balance font-heading text-5xl font-light leading-[1.05] sm:text-7xl">
            Clareza para o<br />
            <span className="text-[var(--v-mint)]">trabalho avançar.</span>
          </h1>
          <p className="max-w-xl text-lg leading-7 text-white/70">
            Apontamento, Kanban e dashboards no mesmo lugar. Substitua a planilha de
            produtividade por um sistema que mede, avisa e organiza sozinho.
          </p>
          <div className="flex flex-col items-center gap-3">
            <Button render={<Link href="/cadastro" />} size="lg" className="h-12 px-8 text-base">
              Começar grátis <ArrowRight className="size-4" />
            </Button>
            <p className="text-sm text-white/50">
              14 dias grátis, sem cartão de crédito ·{' '}
              <Link href="/precos" className="text-[var(--v-mint)] hover:underline">
                ver planos
              </Link>
            </p>
          </div>
        </div>

        {/* A janela invade a seção seguinte de propósito: sugere continuidade
            em vez de fechar o bloco. */}
        <div className="relative mx-auto mt-16 w-full max-w-5xl">
          <div
            aria-hidden
            className="absolute -inset-x-8 -top-8 bottom-0 -z-10 rounded-[2rem] bg-[radial-gradient(ellipse_at_center,color-mix(in_oklch,var(--v-purple),transparent_84%),transparent_72%)] blur-2xl"
          />
          <JanelaApp titulo="vertice.app / quadros / Qualidade EAD">
            <PreviewKanban />
          </JanelaApp>
        </div>
      </section>

      {/* ── Antes / depois ───────────────────────────────────────────── */}
      <section className="px-6 pt-24 pb-20">
        <div className="mx-auto grid w-full max-w-4xl gap-6 sm:grid-cols-2">
          <div className="rounded-md border border-white/10 bg-white/[0.02] p-6">
            <p className="font-mono text-xs uppercase tracking-wide text-white/40">Sem o Vértice</p>
            <ul className="mt-4 flex flex-col gap-3">
              {SEM_VERTICE.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm leading-6 text-white/55">
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-white/25" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-md border border-[var(--v-mint)]/25 bg-[var(--v-mint)]/[0.04] p-6">
            <p className="font-mono text-xs uppercase tracking-wide text-[var(--v-mint)]">Com o Vértice</p>
            <ul className="mt-4 flex flex-col gap-3">
              {COM_VERTICE.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm leading-6 text-white/85">
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-[var(--v-mint)]" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Medir ────────────────────────────────────────────────────── */}
      <section className="border-t border-white/10 px-6 py-20 sm:py-24">
        <div className="mx-auto grid w-full max-w-5xl items-center gap-12 lg:grid-cols-2">
          <div className="flex flex-col gap-5">
            <p className="font-mono text-sm font-medium text-[var(--v-mint)]">Medir</p>
            <h2 className="text-balance font-heading text-3xl font-medium leading-tight sm:text-4xl">
              O número que a planilha nunca deu no tempo certo.
            </h2>
            <p className="text-base leading-7 text-white/70">
              Cada pessoa aponta o dia em minutos. O índice de produtividade sai
              sozinho, comparado com a meta de cada um — e a capacidade da equipe
              fica visível antes de alguém estourar.
            </p>
            <ul className="flex flex-col gap-2.5">
              {[
                'Meta individual, não régua única para todo mundo',
                'Quem está sobrecarregado e quem tem folga, hoje',
                'Histórico semanal sem exportar nada',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm leading-6 text-white/70">
                  <GaugeCircle className="mt-0.5 size-4 shrink-0 text-[var(--v-mint)]" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <JanelaApp titulo="vertice.app / dashboard">
            <PreviewDashboard />
          </JanelaApp>
        </div>
      </section>

      {/* ── Recursos ─────────────────────────────────────────────────── */}
      <section className="border-t border-white/10 px-6 py-20 sm:py-24">
        <div className="mx-auto w-full max-w-5xl">
          <div className="mb-12 max-w-2xl">
            <p className="font-mono text-sm font-medium text-[var(--v-mint)]">Organizar</p>
            <h2 className="mt-3 text-balance font-heading text-3xl font-medium leading-tight sm:text-4xl">
              Um Kanban que trabalha junto, não mais um lugar para atualizar.
            </h2>
          </div>
          <div className="grid gap-px overflow-hidden rounded-md border border-white/10 bg-white/[0.06] sm:grid-cols-2 lg:grid-cols-3">
            {RECURSOS.map((recurso) => {
              const Icone = recurso.icone
              return (
                <div key={recurso.titulo} className="bg-[#07060d] p-6">
                  <Icone className="size-5 text-[var(--v-mint)]" aria-hidden />
                  <p className="mt-4 text-sm font-semibold text-white">{recurso.titulo}</p>
                  <p className="mt-1.5 text-sm leading-6 text-white/60">{recurso.descricao}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Isolamento ───────────────────────────────────────────────── */}
      <section className="border-t border-white/10 px-6 py-20 sm:py-24">
        <div className="mx-auto grid w-full max-w-5xl items-center gap-12 lg:grid-cols-[1fr_auto]">
          <div className="flex flex-col gap-5">
            <p className="font-mono text-sm font-medium text-[var(--v-mint)]">Isolamento</p>
            <h2 className="text-balance font-heading text-3xl font-medium leading-tight sm:text-4xl">
              O dado da sua empresa não encosta no de ninguém.
            </h2>
            <p className="max-w-lg text-base leading-7 text-white/70">
              Cada organização é isolada no próprio banco de dados, com a barreira
              aplicada na camada mais baixa — não por um filtro que alguém pode
              esquecer de escrever.
            </p>
            <div className="flex flex-wrap gap-3">
              {[
                { icone: Lock, texto: 'Isolamento no banco, não só no código' },
                { icone: ShieldCheck, texto: 'Segundo fator por e-mail' },
                { icone: KanbanSquare, texto: 'Trilha de auditoria das ações' },
              ].map(({ icone: Icone, texto }) => (
                <span
                  key={texto}
                  className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/70"
                >
                  <Icone className="size-3.5 shrink-0 text-[var(--v-mint)]" aria-hidden />
                  {texto}
                </span>
              ))}
            </div>
          </div>
          <Vertice3D className="hidden lg:block lg:scale-110" />
        </div>
      </section>

      {/* ── CTA final ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-t border-white/10 px-6 py-24 text-center">
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 -z-10 h-96 bg-[radial-gradient(ellipse_55%_100%_at_50%_100%,color-mix(in_oklch,var(--v-purple),transparent_80%),transparent_70%)]"
        />
        <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6">
          <h2 className="text-balance font-heading text-4xl font-light leading-tight sm:text-5xl">
            Pronto para ver a equipe convergir?
          </h2>
          <p className="max-w-md text-base leading-7 text-white/60">
            Crie a conta e leve a equipe inteira por 14 dias. Sem cartão de crédito,
            sem versão reduzida.
          </p>
          <Button render={<Link href="/cadastro" />} size="lg" className="h-12 px-8 text-base">
            Criar minha conta <ArrowRight className="size-4" />
          </Button>
          <a href="mailto:vendas@teralabs.cloud" className="text-sm text-white/50 hover:text-white/80 hover:underline">
            Prefere conversar antes? Fale com a gente
          </a>
        </div>
      </section>
    </>
  )
}
