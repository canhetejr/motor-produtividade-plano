import Link from 'next/link'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { VerticeSymbol } from '@/components/vertice-symbol'
import { sair } from './actions'

/**
 * Moldura das telas de conta bloqueada (trial expirado, organização
 * suspensa). As duas eram quase idênticas e cada uma tinha só um link para
 * /precos — o que deixava a pessoa a dois cliques de conseguir falar com
 * alguém, justamente no momento em que ela mais quer resolver.
 *
 * Três coisas que faltavam e estão aqui: contato direto (com assunto que
 * diz de qual tela veio), e uma saída — sem a sidebar de app/(app), não
 * havia como encerrar a sessão nem entrar com outra conta.
 */
export function TelaConta({
  titulo,
  descricao,
  acaoPrincipal,
  assuntoContato,
}: {
  titulo: string
  descricao: React.ReactNode
  acaoPrincipal?: { rotulo: string; href: string }
  assuntoContato: string
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#05050b] px-6 py-16 text-white">
      <div className="grid w-full max-w-md justify-items-center gap-5 text-center">
        <VerticeSymbol priority className="h-12 w-12" />
        <h1 className="font-heading text-2xl font-medium">{titulo}</h1>
        <p className="text-base leading-6 text-white/70">{descricao}</p>

        {acaoPrincipal && (
          <Link href={acaoPrincipal.href} className={cn(buttonVariants({ size: 'lg' }), 'mt-1 h-11 px-6')}>
            {acaoPrincipal.rotulo}
          </Link>
        )}

        <a
          href={`mailto:vendas@teralabs.cloud?subject=${encodeURIComponent(assuntoContato)}`}
          className="text-sm text-vertice-mint hover:underline"
        >
          Falar com a gente
        </a>

        {/* A saída. /conta/* fica fora de app/(app), então não há sidebar —
            sem isto a pessoa não consegue nem trocar de conta. */}
        <form action={sair} className="mt-2">
          <button type="submit" className="text-xs text-white/40 transition-colors hover:text-white/70 hover:underline">
            Sair e entrar com outra conta
          </button>
        </form>
      </div>
    </div>
  )
}
