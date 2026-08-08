import Link from 'next/link'

export const metadata = {
  title: 'Conta suspensa — Vértice',
}

// Fora de app/(app): NÃO chama requireUser(). requireUser() redireciona para
// cá quando organizacoes.status é 'suspensa' — se esta página chamasse
// requireUser() de novo, o redirect apontaria para ela mesma e viraria loop
// infinito (ver comentário em lib/auth.ts).
export default function ContaSuspensaPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#05050b] px-6 text-white">
      <div className="grid max-w-md gap-4 text-center">
        <h1 className="font-heading text-2xl font-medium">Sua organização está suspensa</h1>
        <p className="text-base leading-6 text-white/70">
          O acesso foi pausado, provavelmente por pendência de pagamento. Fale com o
          administrador da sua organização para regularizar.
        </p>
        <Link href="/precos" className="mt-2 text-sm text-vertice-mint hover:underline">
          Ver planos
        </Link>
      </div>
    </div>
  )
}
