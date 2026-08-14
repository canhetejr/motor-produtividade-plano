import Link from 'next/link'
import { Check, Sparkles, Users } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const metadata = {
  title: 'Preços — Vértice',
}

const PLANOS = [
  {
    codigo: 'trial',
    nome: 'Teste grátis',
    icone: Sparkles,
    resumo: '14 dias para a equipe inteira sentir a diferença, sem compromisso.',
    destaque: false,
    itens: [
      'Todos os recursos liberados, sem versão reduzida',
      'Apontamento, dashboard e Kanban completo',
      'Convide sua equipe e comece a medir hoje',
      'Sem cartão de crédito',
    ],
    cta: 'Começar grátis',
    href: '/cadastro',
  },
  {
    codigo: 'empresa',
    nome: 'Vértice para empresas',
    icone: Users,
    resumo: 'Plano sob medida para o tamanho e o momento da sua equipe.',
    destaque: true,
    itens: [
      'Assentos e condições ajustados ao seu time',
      'Onboarding e suporte próximo na implantação',
      'Prioridade em novos recursos e integrações',
      'Contrato e faturamento sob medida',
    ],
    cta: 'Falar com a gente',
    href: 'mailto:vendas@teralabs.cloud?subject=Vértice%20para%20empresas',
  },
] as const

export default function PrecosPage() {
  return (
    // pt maior que pb: o cabeçalho da landing é `fixed`, então o conteúdo
    // precisa começar abaixo da faixa dele em vez de nascer atrás.
    <section className="px-6 pt-32 pb-20">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-14 text-center">
          <p className="font-mono text-sm font-medium text-vertice-mint">Preços</p>
          <h1 className="mt-3 font-heading text-4xl font-medium">Comece grátis. Cresça sob medida.</h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-white/70">
            Sem tabela engessada por assento. Teste com a equipe inteira por 14 dias e,
            quando fizer sentido virar cliente, a gente monta a condição junto com você.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {PLANOS.map((plano) => {
            const Icone = plano.icone
            return (
              <div
                key={plano.codigo}
                className={cn(
                  'flex flex-col gap-6 rounded-md border p-6',
                  plano.destaque ? 'border-vertice-mint/40 bg-white/[0.05]' : 'border-white/10 bg-white/[0.02]'
                )}
              >
                <div className="flex items-center gap-3">
                  <Icone className="size-5 shrink-0 text-vertice-mint" />
                  <h2 className="font-heading text-xl font-semibold">{plano.nome}</h2>
                </div>
                <p className="text-sm leading-6 text-white/70">{plano.resumo}</p>
                <ul className="flex-1 space-y-2 text-sm text-white/80">
                  {plano.itens.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-vertice-mint" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plano.href}
                  className={cn(buttonVariants({ variant: plano.destaque ? 'default' : 'outline' }), 'w-full')}
                >
                  {plano.cta}
                </Link>
              </div>
            )
          })}
        </div>

        <p className="mt-10 text-center text-sm text-white/50">
          Dúvida sobre qual caminho faz sentido?{' '}
          <a
            href="mailto:vendas@teralabs.cloud?subject=D%C3%BAvida%20sobre%20planos%20do%20V%C3%A9rtice"
            className="text-vertice-mint hover:underline"
          >
            Fale com a gente
          </a>{' '}
          antes mesmo de criar a conta.
        </p>
      </div>
    </section>
  )
}
