import Link from 'next/link'
import { VerticeLockup } from '@/components/vertice-symbol'
import { Button } from '@/components/ui/button'

// Layout público — sem sidebar, sem FundoParticulas autenticado, sem
// requireUser(). app/(app)/layout.tsx chama requireUser() incondicionalmente,
// por isso landing/preços/cadastro vivem fora daquele route group.
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#05050b] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <Link href="/" aria-label="Vértice">
            <VerticeLockup priority className="h-8 w-auto" />
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/precos" className="hidden text-sm text-white/70 transition-colors hover:text-white sm:inline">
              Preços
            </Link>
            <Link href="/login" className="text-sm text-white/70 transition-colors hover:text-white">
              Entrar
            </Link>
            {/* Único CTA de peso primário na barra — cadastro é a ação que a
                landing inteira aponta. */}
            <Button render={<Link href="/cadastro" />} size="sm">
              Começar grátis
            </Button>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-white/10 py-8">
        <div className="mx-auto w-full max-w-6xl px-6 text-sm text-white/50">
          <p>Vértice — um produto Tera.</p>
        </div>
      </footer>
    </div>
  )
}
