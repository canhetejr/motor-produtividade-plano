import { LoginForm } from './login-form'
import { ArrowUpRight, CheckCircle2 } from 'lucide-react'
import { VerticeSymbol } from '@/components/vertice-symbol'

export default async function LoginPage(props: { searchParams: Promise<{ message?: string }> }) {
  const searchParams = await props.searchParams

  return (
    <div className="relative isolate min-h-dvh overflow-hidden bg-[#09090e] p-4 sm:p-6">
      {/* Malha viva: vértices + as duas tramas de arestas nos ±62° da marca,
          cada uma derivando numa velocidade. Só decoração — aria-hidden e fora
          da ordem de leitura. */}
      <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-28 top-[-12rem] size-[34rem] rounded-full bg-primary/25 blur-[130px]" />
        <div className="absolute -bottom-44 right-[-8rem] size-[35rem] rounded-full bg-[#00ffce]/10 blur-[150px]" />
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(130,10,209,.11),transparent_42%,rgba(0,255,206,.04))]" />
      </div>

      <main className="mx-auto grid min-h-[calc(100dvh-2rem)] max-w-6xl items-center gap-10 lg:grid-cols-[1fr_420px] lg:gap-20">
        <section className="hidden max-w-xl lg:block">
          <div className="mb-12 flex items-center gap-3 text-sm font-medium text-white/80"><VerticeSymbol className="size-9" /><span>Vértice</span></div>
          <p className="mb-5 font-mono text-xs uppercase tracking-[.2em] text-[#00ffce]">Motor de produtividade</p>
          <h1 className="max-w-lg font-heading text-5xl font-light leading-[1.05] tracking-[-.045em] text-white">Direção clara para o trabalho que importa.</h1>
          <p className="mt-6 max-w-md text-base leading-7 text-white/65">Centralize demandas, acompanhe prazos e transforme o esforço da equipe em decisões melhores.</p>
          <div className="mt-10 grid gap-3 text-sm text-white/70">
            {['Planejamento conectado ao dia a dia', 'Visão compartilhada do que vem a seguir'].map((item) => <p key={item} className="flex items-center gap-3"><CheckCircle2 className="size-4 text-[#00ffce]" />{item}</p>)}
          </div>
        </section>

        <div className="w-full max-w-[420px] justify-self-center lg:justify-self-end">
          <LoginForm mensagem={searchParams?.message}>
            <div className="grid justify-items-center gap-4 text-center">
              <div className="grid size-14 place-items-center rounded-2xl border border-white/10 bg-white/[.04] shadow-inner"><VerticeSymbol className="size-8" /></div>
              <div className="grid gap-2">
                <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#00ffce]">Acesso seguro</p>
                <h2 className="font-heading text-3xl font-light tracking-[-.035em]">Boas-vindas de volta</h2>
                <p className="text-sm leading-6 text-muted-foreground">Entre para continuar de onde parou.</p>
              </div>
            </div>
          </LoginForm>
          <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-white/45">Vértice · Motor de Produtividade <ArrowUpRight className="size-3" /></p>
        </div>
      </main>
    </div>
  )
}
