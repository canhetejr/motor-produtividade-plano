import Link from 'next/link'
import { BarChart3, Check, ClipboardList, GaugeCircle, KanbanSquare, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { VerticeSymbol } from '@/components/vertice-symbol'

// Assume a rota `/`. utils/supabase/middleware.ts já deixa `/` passar
// deslogado; o redirect de quem já está logado fica no proxy (que já tem o
// user em mãos), então esta página continua estática.
export const metadata = {
  title: 'Vértice — Clareza para o trabalho avançar',
}

const PASSOS = [
  {
    numero: '01',
    titulo: 'Aponte o dia',
    descricao: 'Cada pessoa registra o que fez em minutos, direto do celular ou do computador.',
  },
  {
    numero: '02',
    titulo: 'Organize no Kanban',
    descricao: 'Demandas viram cartões com prazo, responsável e aprovação — sem planilha paralela.',
  },
  {
    numero: '03',
    titulo: 'Veja o time convergir',
    descricao: 'Dashboards e alertas mostram onde o trabalho trava, antes que vire problema.',
  },
]

const BENEFICIOS = [
  {
    icone: GaugeCircle,
    titulo: 'Índice de produtividade automático',
    descricao: 'Sem fórmula em planilha: o Vértice calcula sozinho, a partir do apontamento diário.',
  },
  {
    icone: KanbanSquare,
    titulo: 'Kanban com automações e aprovações',
    descricao: 'Regras, checklists, subtarefas e formulários públicos para receber demanda de fora.',
  },
  {
    icone: BarChart3,
    titulo: 'Dashboards e relatórios semanais',
    descricao: 'Visão de gestão pronta, sem exportar dado para montar gráfico à mão.',
  },
  {
    icone: ClipboardList,
    titulo: 'Solicitações com fluxo de aprovação',
    descricao: 'Pedido de horas fora do padrão passa por aprovação — com notificação e histórico.',
  },
  {
    icone: ShieldCheck,
    titulo: 'Dados da sua empresa, isolados',
    descricao: 'Cada organização enxerga só o próprio dado. Ninguém mais tem acesso.',
  },
  {
    icone: Check,
    titulo: 'Sincronização com Google Calendar',
    descricao: 'Prazos de cartões viram eventos no seu calendário automaticamente.',
  },
]

export default function LandingPage() {
  return (
    <>
      <section className="relative overflow-hidden px-6 py-24 sm:py-32">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-8 text-center">
          <VerticeSymbol priority className="h-16 w-16" />
          <p className="font-mono text-sm font-medium text-vertice-mint">Gestão de trabalho</p>
          <h1 className="text-balance font-heading text-5xl font-light leading-tight sm:text-6xl">
            Clareza para o<br />trabalho avançar.
          </h1>
          <p className="max-w-xl text-lg leading-7 text-white/70">
            Prioridades, pessoas e execução no mesmo lugar. Substitua a planilha de
            produtividade por um sistema que mede, avisa e organiza sozinho.
          </p>
          {/* Uma única ação primária na dobra — o link abaixo é apoio, não compete em peso. */}
          <div className="flex flex-col items-center gap-3">
            <Button render={<Link href="/cadastro" />} size="lg" className="h-12 px-8 text-base">
              Começar grátis
            </Button>
            <p className="text-sm text-white/50">
              14 dias grátis, sem cartão de crédito ·{' '}
              <Link href="/precos" className="text-vertice-mint hover:underline">
                ver planos
              </Link>
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 px-6 py-20">
        <div className="mx-auto w-full max-w-4xl">
          <div className="mb-10 text-center">
            <p className="font-mono text-sm font-medium text-vertice-mint">Como funciona</p>
            <h2 className="mt-3 font-heading text-3xl font-medium">Três passos, sem curva de aprendizado</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {PASSOS.map((passo) => (
              <div key={passo.numero} className="rounded-md border border-white/10 bg-white/[0.03] p-6">
                <p className="font-mono text-sm font-medium text-vertice-mint">{passo.numero}</p>
                <h3 className="mt-3 font-heading text-lg font-semibold">{passo.titulo}</h3>
                <p className="mt-2 text-sm leading-6 text-white/70">{passo.descricao}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 px-6 py-20">
        <div className="mx-auto w-full max-w-5xl">
          <div className="mb-10 text-center">
            <p className="font-mono text-sm font-medium text-vertice-mint">Tudo em um lugar</p>
            <h2 className="mt-3 font-heading text-3xl font-medium">O que o Vértice resolve</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFICIOS.map((beneficio) => {
              const Icone = beneficio.icone
              return (
                <div key={beneficio.titulo} className="flex items-start gap-3 rounded-md border border-white/10 bg-white/[0.03] p-5">
                  <Icone className="mt-0.5 size-5 shrink-0 text-vertice-mint" />
                  <div>
                    <p className="text-sm font-semibold text-white">{beneficio.titulo}</p>
                    <p className="mt-1 text-sm leading-6 text-white/70">{beneficio.descricao}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 px-6 py-20 text-center">
        <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6">
          <h2 className="font-heading text-3xl font-medium">Pronto para ver a equipe convergir?</h2>
          <p className="max-w-md text-sm leading-6 text-white/60">
            Comece grátis por 14 dias com a equipe inteira, sem cartão de crédito.
          </p>
          <Button render={<Link href="/cadastro" />} size="lg" className="h-12 px-8 text-base">
            Criar minha conta
          </Button>
          <a href="mailto:vendas@teralabs.cloud" className="text-sm text-white/50 hover:text-white/80 hover:underline">
            Prefere conversar antes? Fale com a gente
          </a>
        </div>
      </section>
    </>
  )
}
