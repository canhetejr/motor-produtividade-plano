import { LoginForm } from './login-form'
import { VerticeSymbol } from '@/components/vertice-symbol'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function LoginPage(props: { searchParams: Promise<{ message?: string }> }) {
  const searchParams = await props.searchParams

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      {/* Painel de marca — só no desktop. No celular ele viraria uma tela de
          rolagem antes do formulário, que é o que a pessoa veio fazer. */}
      <aside className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div aria-hidden className="bg-brand-gradient absolute inset-0" />
        <div aria-hidden className="pattern-mesh absolute inset-0 opacity-25 mix-blend-overlay" />
        {/* Escurece a base: o trecho mint do gradiente é claro demais para
            sustentar texto branco sozinho. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10"
        />

        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/vertice-logos-svg/vertice-horizontal-branca.svg"
            alt="Vértice"
            className="h-7 w-auto"
          />
        </div>

        <div className="relative max-w-md">
          <p className="font-heading text-3xl leading-tight font-light text-balance text-white">
            O tempo da sua equipe, medido onde ele acontece.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-white/70">
            Apontamentos, quadros e indicadores no mesmo lugar — sem planilha paralela.
          </p>
        </div>

        <p className="relative text-xs text-white/50">Vértice · Motor de Produtividade</p>
      </aside>

      {/* Formulário. O halo agora existe de fato como token de marca — a página
          referenciava --gradient-halo desde sempre, mas ele nunca fora definido. */}
      <main className="bg-halo flex items-center justify-center bg-background p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <Card className="relative gap-6 py-8 shadow-xl">
            <CardHeader className="justify-items-center gap-3 text-center">
              <VerticeSymbol className="h-11 w-11" />
              <div className="grid gap-1">
                <CardTitle className="font-heading text-2xl font-light">
                  Entrar no Vértice
                </CardTitle>
                <CardDescription>
                  Entre na sua conta para registrar seus apontamentos.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent>
              <LoginForm mensagem={searchParams?.message} />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
