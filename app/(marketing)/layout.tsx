import Link from 'next/link'

import { CabecalhoLanding } from '@/components/landing/cabecalho'

// Layout público — sem sidebar, sem FundoParticulas autenticado, sem
// requireUser(). app/(app)/layout.tsx chama requireUser() incondicionalmente,
// por isso landing/preços/cadastro vivem fora daquele route group.
//
// O fundo fica aqui, e não no `body`: a cena WebGL da landing é um canvas
// `fixed` em z-0, e um fundo opaco em qualquer elemento em fluxo acima dela a
// esconderia. Este `div` pinta a base e todo o conteúdo passa a viver por cima.
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col bg-[#05050b] text-white">
      <CabecalhoLanding />
      <main className="flex-1">{children}</main>
      <footer className="relative z-10 border-t border-white/10 bg-[#05050b] py-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 text-sm text-white/45 sm:flex-row sm:items-center sm:justify-between">
          <p>Vértice — um produto Tera.</p>
          <nav className="flex items-center gap-5" aria-label="Rodapé">
            <Link href="/precos" className="rounded-sm transition-colors hover:text-white/80">
              Preços
            </Link>
            <Link href="/login" className="rounded-sm transition-colors hover:text-white/80">
              Entrar
            </Link>
            <a
              href="mailto:vendas@teralabs.cloud"
              className="rounded-sm transition-colors hover:text-white/80"
            >
              Falar com a gente
            </a>
          </nav>
        </div>
      </footer>
    </div>
  )
}
