import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-dvh gap-4 p-4 text-center">
      <p className="text-6xl font-bold text-muted-foreground/40">404</p>
      <h2 className="text-xl font-semibold">Página não encontrada</h2>
      <p className="text-muted-foreground max-w-md">
        O endereço que você acessou não existe ou foi movido.
      </p>
      <Link href="/apontamento" className={buttonVariants()}>Ir para apontamentos</Link>
    </div>
  )
}
