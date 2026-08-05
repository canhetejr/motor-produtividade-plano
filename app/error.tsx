'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh gap-4 p-4 text-center">
      <div className="h-12 w-12 rounded-full bg-danger/10 text-danger flex items-center justify-center">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h2 className="text-xl font-semibold">Algo deu errado</h2>
      <p className="text-muted-foreground max-w-md">
        Ocorreu um erro inesperado. Tente novamente — se o problema persistir, avise o gestor.
      </p>
      <Button onClick={reset}>Tentar novamente</Button>
    </div>
  )
}
