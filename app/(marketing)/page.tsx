import Link from 'next/link'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { VerticeSymbol } from '@/components/vertice-symbol'

// Assume a rota `/`. utils/supabase/middleware.ts já deixa `/` passar
// deslogado; o redirect de quem já está logado fica no proxy (que já tem o
// user em mãos), então esta página continua estática.
export const metadata = {
  title: 'Vértice — Clareza para o trabalho avançar',
}

const BENEFICIOS = [
  'Apontamento diário simples, com índice de produtividade calculado sozinho',
  'Kanban completo: automações, aprovações, checklists e formulários públicos',
  'Dashboards e relatórios semanais sem planilha',
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
          {/* Uma única ação primária na dobra — o resto da página é apoio. */}
          <Button render={<Link href="/cadastro" />} size="lg" className="h-12 px-8 text-base">
            Começar grátis
          </Button>
          <p className="text-sm text-white/50">14 dias grátis. Sem cartão de crédito.</p>
        </div>
      </section>

      <section className="border-t border-white/10 px-6 py-20">
        <div className="mx-auto grid w-full max-w-4xl gap-6 sm:grid-cols-3">
          {BENEFICIOS.map((beneficio) => (
            <div key={beneficio} className="flex items-start gap-3 rounded-md border border-white/10 bg-white/[0.03] p-5">
              <Check className="mt-0.5 size-5 shrink-0 text-vertice-mint" />
              <p className="text-sm leading-6 text-white/80">{beneficio}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-white/10 px-6 py-20 text-center">
        <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6">
          <h2 className="font-heading text-3xl font-medium">Pronto para ver a equipe convergir?</h2>
          <Button render={<Link href="/cadastro" />} size="lg" className="h-12 px-8 text-base">
            Criar minha conta
          </Button>
        </div>
      </section>
    </>
  )
}
