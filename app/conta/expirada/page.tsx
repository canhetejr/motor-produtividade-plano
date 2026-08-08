import Link from 'next/link'

export const metadata = {
  title: 'Trial expirado — Vértice',
}

// Fora de app/(app): NÃO chama requireUser(), pelo mesmo motivo de
// app/conta/suspensa/page.tsx — requireUser() já redireciona pra cá.
export default function ContaExpiradaPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#05050b] px-6 text-white">
      <div className="grid max-w-md gap-4 text-center">
        <h1 className="font-heading text-2xl font-medium">Seu trial expirou</h1>
        <p className="text-base leading-6 text-white/70">
          Os 14 dias grátis chegaram ao fim. Escolha um plano para continuar usando o
          Vértice com sua equipe.
        </p>
        <Link href="/precos" className="mt-2 text-sm text-vertice-mint hover:underline">
          Ver planos
        </Link>
      </div>
    </div>
  )
}
