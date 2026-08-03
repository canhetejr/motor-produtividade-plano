import { LoginForm } from './login-form'
import { redirect } from 'next/navigation'
import { FundoParticulas } from '@/components/fundo-particulas'

export default async function LoginPage(props: { searchParams: Promise<{ message?: string; code?: string; next?: string }> }) {
  const searchParams = await props.searchParams

  // Se a URL de retorno cadastrada no Supabase cair no Site URL (/login),
  // preserva o PKCE e encaminha o código para o handler que troca a sessão.
  // O fluxo normal continua chegando direto em /auth/callback.
  if (searchParams.code) {
    const next = searchParams.next?.startsWith('/') ? searchParams.next : '/apontamento'
    redirect(`/auth/callback?code=${encodeURIComponent(searchParams.code)}&next=${encodeURIComponent(next)}`)
  }

  return (
    <div className="relative isolate min-h-dvh overflow-hidden bg-[#05050b] text-white">
      {/* Fundo e eixo central replicam a composição de duas áreas: marca à
          esquerda e autenticação sem distrações à direita. */}
      <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[26%] top-[38%] size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#820ad1]/10 blur-[150px]" />
        <div className="absolute inset-y-0 left-[56%] hidden w-px bg-white/15 lg:block" />
      </div>
      <FundoParticulas />

      <main className="relative z-10 grid min-h-dvh lg:grid-cols-[56%_44%]">
        <section className="relative hidden min-h-dvh px-[14%] py-24 lg:flex lg:flex-col lg:justify-center">
          <img src="/vertice-logos-svg/vertice-horizontal-branca.svg" alt="Vértice" className="absolute left-[14%] top-24 h-10 w-auto" />
          <div className="max-w-[700px]">
            <p className="mb-6 font-mono text-sm font-medium uppercase tracking-[.2em] text-[#00ffce]">Gestão de trabalho</p>
            <h1 className="font-heading text-[4.15rem] font-light leading-[1.15] tracking-[-.06em] text-white xl:text-[4.85rem]">Clareza para o<br />trabalho avançar.</h1>
            <p className="mt-6 text-lg leading-7 text-white/70">Prioridades, pessoas e execução no mesmo lugar.</p>
          </div>
        </section>

        <section className="flex min-h-dvh items-center justify-center px-6 py-12 sm:px-10 lg:px-16">
        <div className="w-full max-w-[444px]">
          <LoginForm mensagem={searchParams?.message}>
            <div className="grid justify-items-center gap-8 text-center">
              <img src="/vertice-logos-svg/vertice-simbolo-duotone.svg" alt="Vértice" className="h-14 w-auto" />
              <div className="grid gap-3">
                <p className="font-mono text-sm font-medium uppercase tracking-[.16em] text-[#00ffce]">Acesso</p>
                <h2 className="font-heading text-[2.35rem] font-light leading-tight tracking-[-.055em]">Boas-vindas de volta</h2>
                <p className="text-[1.05rem] leading-6 text-white/70">Entre para continuar.</p>
              </div>
            </div>
          </LoginForm>
        </div>
        </section>
      </main>
    </div>
  )
}
