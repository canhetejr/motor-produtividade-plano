'use client'

import { useEffect } from 'react'
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
    <html lang="pt-BR">
      <body className="antialiased min-h-screen bg-background text-foreground">
        <div className="flex flex-col items-center justify-center min-h-dvh gap-4 p-4 text-center">
          <div className="h-12 w-12 rounded-full bg-danger/10 text-danger flex items-center justify-center">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-semibold">Algo deu errado</h2>
          <p className="text-muted-foreground max-w-md">
            Ocorreu um erro inesperado ao carregar o app. Tente novamente — se o problema persistir, avise o gestor.
          </p>
          <button
            onClick={reset}
            className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90"
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  )
}
