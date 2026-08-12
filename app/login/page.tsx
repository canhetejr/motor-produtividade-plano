import { LoginForm } from './login-form'
import { redirect } from 'next/navigation'
import { FundoParticulas } from '@/components/fundo-particulas'
import { VerticeLockup, VerticeSymbol } from '@/components/vertice-symbol'

export default async function LoginPage(props: { searchParams: Promise<{ message?: string; code?: string; next?: string }> }) {
  const searchParams = await props.searchParams

  // Se a URL de retorno cadastrada no Supabase cair no Site URL (/login),
  // preserva o PKCE e encaminha o código para o handler que troca a sessão.
  // O fluxo normal continua chegando direto em /auth/callback.
  if (searchParams.code) {
    const next = searchParams.next?.startsWith('/') ? searchParams.next : '/minha-semana'
    redirect(`/auth/callback?code=${encodeURIComponent(searchParams.code)}&next=${encodeURIComponent(next)}`)
  }

  return (
    <div className="vertice-raio-fixo relative isolate min-h-dvh overflow-hidden bg-[#101010] text-white">
      {/* O eixo central separa marca e autenticação sem criar outra superfície. */}
      <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-y-0 left-[56%] hidden w-px bg-white/15 lg:block" />
      </div>
      <FundoParticulas />

      <main className="relative z-10 grid min-h-dvh lg:grid-cols-[56%_44%]">
        <section className="relative hidden min-h-dvh px-[14%] py-24 lg:flex lg:flex-col lg:justify-center">
          <VerticeLockup priority className="absolute left-[14%] top-24 h-12 w-auto" />
          <div className="max-w-[700px]">
            <p className="mb-6 font-mono text-sm font-medium text-primary">Gestão de trabalho</p>
            <h1 className="font-heading text-5xl font-light leading-tight text-white">Clareza para o<br />trabalho avançar.</h1>
            <p className="mt-6 text-base leading-7 text-white/70">Prioridades, pessoas e execução no mesmo lugar.</p>
          </div>
        </section>

        <section className="flex min-h-dvh items-center justify-center px-6 py-12 sm:px-10 lg:px-16">
        <div className="w-full max-w-[444px]">
          <LoginForm mensagem={searchParams?.message}>
            <div className="grid justify-items-center gap-8 text-center">
              <VerticeSymbol alt="Vértice" priority className="h-16 w-16" />
              <div className="grid gap-3">
                <p className="font-mono text-sm font-medium text-primary">Acesso</p>
                <h2 className="font-heading text-3xl font-medium leading-tight">Boas-vindas de volta</h2>
                <p className="text-base leading-6 text-white/70">Entre para continuar.</p>
              </div>
            </div>
          </LoginForm>
        </div>
        </section>
      </main>
    </div>
  )
}
