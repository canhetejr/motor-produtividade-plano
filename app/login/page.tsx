import { LoginForm } from './login-form'
import { VerticeSymbol } from '@/components/vertice-symbol'

export default async function LoginPage(props: { searchParams: Promise<{ message?: string }> }) {
  const searchParams = await props.searchParams

  return (
    <div className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-background p-5 sm:p-8">
      {/* Malha viva: vértices + as duas tramas de arestas nos ±62° da marca,
          cada uma derivando numa velocidade. Só decoração — aria-hidden e fora
          da ordem de leitura. */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="malha-viva malha-vertices" />
        <div className="malha-viva malha-arestas-a" />
        <div className="malha-viva malha-arestas-b" />
        {/* O halo concentra luz no centro; a vinheta apaga a malha nas bordas
            para ela não terminar cortada de forma dura. */}
        <div className="bg-halo absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-background/80" />
      </div>

      <div className="w-full max-w-sm">
        <LoginForm mensagem={searchParams?.message}>
          <div className="grid justify-items-center gap-3 text-center">
            <VerticeSymbol className="h-11 w-11" />
            <div className="grid gap-1">
              <h1 className="font-heading text-2xl leading-snug font-light">Entrar no Vértice</h1>
              <p className="text-sm text-muted-foreground">
                Entre na sua conta para registrar seus apontamentos.
              </p>
            </div>
          </div>
        </LoginForm>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Vértice · Motor de Produtividade
        </p>
      </div>
    </div>
  )
}
