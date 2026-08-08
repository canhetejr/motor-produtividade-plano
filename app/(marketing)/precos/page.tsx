import Link from 'next/link'
import { Check } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const metadata = {
  title: 'Preços — Vértice',
}

function formatarPreco(centavos: number): string {
  if (centavos === 0) return 'Grátis'
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default async function PrecosPage() {
  // planos tem select público (policy planos_leitura_publica) — o client
  // anônimo padrão já resolve, sem precisar de service role aqui.
  const supabase = await createClient()
  const { data: planos } = await supabase
    .from('planos')
    .select('codigo, nome, assentos_inclusos, preco_mensal_centavos')
    .eq('ativo', true)
    // 'interno' é o plano da organização migrada na Fase 1 (Teralabs), não é
    // um plano de venda — não deve aparecer para quem visita /precos.
    .neq('codigo', 'interno')
    .order('ordem')

  return (
    <section className="px-6 py-20">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-14 text-center">
          <p className="font-mono text-sm font-medium text-vertice-mint">Preços</p>
          <h1 className="mt-3 font-heading text-4xl font-medium">Um plano por assento, sem letra miúda</h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-white/70">
            Comece no trial de 14 dias. Mude de plano quando a equipe crescer.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          {(planos ?? []).map((plano, i) => {
            // Meio da grade em destaque — um único plano com peso visual
            // maior, nunca dois CTAs do mesmo peso na tela.
            const destaque = i === 1
            return (
              <div
                key={plano.codigo}
                className={cn(
                  'flex flex-col gap-6 rounded-md border p-6',
                  destaque ? 'border-vertice-mint/40 bg-white/[0.05]' : 'border-white/10 bg-white/[0.02]'
                )}
              >
                <div>
                  <h2 className="font-heading text-xl font-semibold">{plano.nome}</h2>
                  <p className="mt-2 font-mono text-3xl font-medium">
                    {formatarPreco(plano.preco_mensal_centavos)}
                    {plano.preco_mensal_centavos > 0 && (
                      <span className="text-sm font-normal text-white/50"> /mês</span>
                    )}
                  </p>
                </div>
                <ul className="flex-1 space-y-2 text-sm text-white/80">
                  <li className="flex items-center gap-2">
                    <Check className="size-4 shrink-0 text-vertice-mint" />
                    Até {plano.assentos_inclusos} assentos
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-4 shrink-0 text-vertice-mint" />
                    Apontamento, dashboard e Kanban completo
                  </li>
                </ul>
                <Button
                  render={<Link href="/cadastro" />}
                  variant={destaque ? 'default' : 'outline'}
                  className="w-full"
                >
                  Começar grátis
                </Button>
              </div>
            )
          })}
        </div>

        {(!planos || planos.length === 0) && (
          <p className="text-center text-white/60">Nenhum plano disponível no momento.</p>
        )}
      </div>
    </section>
  )
}
