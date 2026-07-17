import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-dvh gap-4 p-4 text-center">
      <p className="text-6xl font-bold text-muted-foreground/40">404</p>
      <h2 className="text-xl font-bold">Página não encontrada</h2>
      <p className="text-muted-foreground max-w-md">
        O endereço que você acessou não existe ou foi movido.
      </p>
      <Button render={<Link href="/apontamento" />}>Ir para o Apontamento</Button>
    </div>
  )
}
