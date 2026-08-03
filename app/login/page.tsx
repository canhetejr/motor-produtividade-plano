import { LoginForm } from './login-form'
import { CheckCircle2 } from 'lucide-react'
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
      {/* Malha viva: vértices + as duas tramas de arestas nos ±62° da marca,
          cada uma derivando numa velocidade. Só decoração — aria-hidden e fora
          da ordem de leitura. */}
      <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[26%] top-[38%] size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#820ad1]/15 blur-[150px]" />
        <div className="absolute right-[-12rem] top-1/2 size-[34rem] -translate-y-1/2 rounded-full bg-[#820ad1]/20 blur-[130px]" />
        <div className="absolute inset-y-0 left-[54%] hidden w-px bg-gradient-to-b from-transparent via-[#00ffce] to-transparent lg:block" />
      </div>
      <FundoParticulas />

      <main className="relative z-10 grid min-h-dvh lg:grid-cols-[54%_46%]">
        <section className="relative hidden min-h-dvh px-[8.5%] py-20 lg:flex lg:flex-col lg:justify-center">
          <img src="/vertice-logos-svg/vertice-horizontal-branca.svg" alt="Vértice" className="absolute left-[8.5%] top-20 h-11 w-auto" />
          <div className="max-w-[680px]">
            <p className="mb-7 font-mono text-sm font-medium uppercase tracking-[.22em] text-[#00ffce]">Operação em movimento</p>
            <h1 className="max-w-[690px] font-heading text-[3.55rem] font-light leading-[1.22] tracking-[-.055em] text-white xl:text-[4rem]">Tudo o que move seu time,<br />no mesmo ponto.</h1>
            <p className="mt-6 max-w-md text-lg leading-7 text-violet-100/80">Transforme demandas dispersas em clareza<br />para decidir, priorizar e executar.</p>
            <div className="mt-12 grid gap-4 text-lg text-white/75">
              {['Prioridades que todos enxergam', 'Ritmo de execução em tempo real'].map((item) => <p key={item} className="flex items-center gap-4"><CheckCircle2 strokeWidth={1.75} className="size-6 text-[#00ffce]" />{item}</p>)}
            </div>
          </div>
        </section>

        <section className="flex min-h-dvh items-center justify-center px-5 py-12 sm:px-10 lg:px-16">
        <div className="w-full max-w-[454px]">
          <LoginForm mensagem={searchParams?.message}>
            <div className="grid justify-items-center gap-7 text-center">
              <img src="/vertice-logos-svg/vertice-vertical-duotone.svg" alt="Vértice" className="h-[102px] w-auto" />
              <div className="grid gap-4">
                <p className="font-mono text-sm font-medium uppercase tracking-[.16em] text-[#00ffce]">Acesso ao Vértice</p>
                <h2 className="font-heading text-[2.35rem] font-light leading-tight tracking-[-.055em]">Entre e avance com clareza</h2>
                <p className="text-[1.05rem] leading-6 text-violet-100/80">Seu trabalho, suas prioridades e os<br className="hidden sm:block" /> próximos passos em um só lugar.</p>
              </div>
            </div>
          </LoginForm>
        </div>
        </section>
      </main>
    </div>
  )
}
