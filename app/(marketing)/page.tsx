import Link from 'next/link'
import { ArrowRight, ArrowDown } from 'lucide-react'

import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { ATO } from '@/lib/landing/atos'
import { Experiencia } from '@/components/landing/experiencia'
import { Ato } from '@/components/landing/ato'
import { Revelar, Profundidade } from '@/components/landing/revelar'
import { BotaoMagnetico } from '@/components/landing/botao-magnetico'
import { Rotulo } from '@/components/landing/dados-tecnicos'
import { SemVertice, ComVertice } from '@/components/landing/contraste'
import { QuadroVivo } from '@/components/landing/quadro-vivo'
import { PainelCapacidade } from '@/components/landing/painel-capacidade'
import { FluxoAutomacao } from '@/components/landing/fluxo-automacao'
import { CelulasIsolamento } from '@/components/landing/celulas-isolamento'

// Server Component. A página inteira é HTML no primeiro byte — o canvas e as
// animações entram depois, por cima. `utils/supabase/middleware.ts` já deixa
// `/` passar deslogado e o redirect de quem já tem sessão fica no proxy, então
// esta rota continua estática.
export const metadata = {
  title: 'Vértice — Clareza para o trabalho avançar',
  description:
    'Apontamento diário, Kanban com automações e dashboards de produtividade no mesmo lugar. 14 dias grátis, sem cartão de crédito.',
}

/**
 * A landing é uma narrativa só: do caos à convergência.
 *
 * Cada `<Ato>` é um capítulo do DOM e, ao mesmo tempo, uma formação da cena 3D
 * que atravessa a página inteira atrás do texto. Os dois compartilham o mesmo
 * relógio (`lib/landing/rolagem.ts`), então o que se lê e o que se vê nunca
 * contam coisas diferentes.
 *
 * A ordem existe para ter ritmo, e não só para acumular seções:
 *   calma → curiosidade → movimento → convergência → silêncio →
 *   produto → dados → movimento → controle → conclusão
 *
 * Os capítulos 3 (Vértice) e 8 (Isolamento) são curtos e quase estáticos de
 * propósito. Sem esses respiros, a densidade dos outros deixa de ser sentida
 * como densidade e vira apenas ruído constante.
 *
 * `Revelar` *é* o elemento semântico (`as`), nunca um invólucro em volta de
 * outro igual: envolver um `<h1>` em outro `<h1>` para animá-lo produziria HTML
 * inválido e dois títulos de nível 1 na mesma página.
 */
export default function LandingPage() {
  return (
    <Experiencia>
      {/* ── 00 · Abertura ──────────────────────────────────────────────────
          Tela quase limpa, muita área negativa. O campo de fragmentos é gerado
          num anel elíptico com o miolo vazio justamente para que o H1 caia em
          espaço livre — a composição foi construída em volta do texto. */}
      <Ato ordem={0} atos={[ATO.DISPERSO]} rotulo="Abertura">
        <Profundidade de={0.35}>
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-7 text-center">
            <Revelar
              as="span"
              duracao={0.8}
              className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 font-mono text-3xs text-white/65"
            >
              <span className="size-1.5 rounded-full bg-primary" aria-hidden />
              Gestão de trabalho, de ponta a ponta
            </Revelar>

            <Revelar
              as="h1"
              atraso={0.08}
              duracao={1.25}
              className="text-balance font-heading text-5xl font-light leading-[1.05] sm:text-7xl"
            >
              Clareza para o<br />
              <span className="text-primary">trabalho avançar.</span>
            </Revelar>

            <Revelar as="p" atraso={0.22} className="max-w-xl text-lg leading-7 text-white/70">
              Apontamento, Kanban e dashboards no mesmo lugar. Substitua a planilha de
              produtividade por um sistema que mede, avisa e organiza sozinho.
            </Revelar>

            <Revelar atraso={0.34} className="flex flex-col items-center gap-3">
              <BotaoMagnetico>
                <Link href="/cadastro" className={cn(buttonVariants({ size: 'lg' }), 'h-12 px-8 text-base')}>
                  Começar grátis <ArrowRight className="size-4" />
                </Link>
              </BotaoMagnetico>
              <p className="text-sm text-white/45">
                14 dias grátis, sem cartão de crédito ·{' '}
                <Link href="/precos" className="text-primary hover:underline">
                  ver planos
                </Link>
              </p>
            </Revelar>

            <Revelar
              atraso={0.6}
              className="mt-6 inline-flex flex-col items-center gap-2 font-mono text-4xs uppercase text-white/25"
            >
              Role para ver convergir
              <ArrowDown className="size-3 animate-bounce" aria-hidden />
            </Revelar>
          </div>
        </Profundidade>
      </Ato>

      {/* ── 01 · O problema ────────────────────────────────────────────────
          O campo começa a ser atraído para o centro enquanto o texto ainda fala
          de dispersão. As peças do DOM andam no sentido contrário: a desordem
          aumenta de leve, porque resolvê-la aqui queimaria a virada seguinte. */}
      <Ato ordem={1} atos={[ATO.ATRACAO]} rotulo="Sem o Vértice" scrim="esquerda">
        <Profundidade>
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
            <div className="flex flex-col gap-5">
              <Revelar as="span">
                <Rotulo numero="01">Sem o Vértice</Rotulo>
              </Revelar>
              <Revelar
                as="h2"
                atraso={0.08}
                duracao={1.15}
                className="text-balance font-heading text-3xl font-light leading-tight sm:text-5xl"
              >
                Todo o trabalho já existe.
                <br />
                Só não existe <span className="text-white/40">junto</span>.
              </Revelar>
              <Revelar as="p" atraso={0.2} className="max-w-md text-base leading-7 text-white/60">
                A informação está lá — em planilha, no chat, na memória de alguém. O que
                falta é um lugar onde ela se encontre.
              </Revelar>
            </div>
            <SemVertice />
          </div>
        </Profundidade>
      </Ato>

      {/* ── 02 · A virada ──────────────────────────────────────────────────
          A casca de Fibonacci fecha atrás: o caos vira sistema. No DOM, as
          mesmas três promessas chegam alinhadas a uma grade exata. */}
      <Ato ordem={2} atos={[ATO.CONVERGENCIA]} rotulo="Com o Vértice" scrim="esquerda">
        <Profundidade>
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
            <div className="flex flex-col gap-5">
              <Revelar as="span">
                <Rotulo numero="02" acento>
                  Com o Vértice
                </Rotulo>
              </Revelar>
              <Revelar
                as="h2"
                atraso={0.08}
                duracao={1.15}
                className="text-balance font-heading text-3xl font-light leading-tight sm:text-5xl"
              >
                Até que tudo passa a apontar
                <br />
                para o <span className="text-primary">mesmo lugar</span>.
              </Revelar>
              <Revelar as="p" atraso={0.2} className="max-w-md text-base leading-7 text-white/60">
                Nada de reunião para saber onde as coisas estão. O sistema mede, avisa e
                organiza — e a equipe só precisa trabalhar.
              </Revelar>
            </div>
            <ComVertice />
          </div>
        </Profundidade>
      </Ato>

      {/* ── 03 · Respiro ───────────────────────────────────────────────────
          Quase nada se move. Uma frase, muito espaço e a estrutura fechando
          atrás no ângulo de construção da marca. É o frame que precisa ser
          lembrado, então nada compete com ele — nem um segundo CTA, nem um
          bloco de apoio. */}
      <Ato ordem={3} atos={[ATO.VERTICE]} rotulo="O vértice" scrim="coluna">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-8 text-center">
          <Revelar
            as="p"
            duracao={1.5}
            angulo={62}
            className="text-balance font-heading text-2xl font-light leading-[1.35] text-white/90 sm:text-4xl"
          >
            Um vértice é onde duas arestas se encontram.
            <br />
            <span className="text-primary">E onde uma decisão acontece.</span>
          </Revelar>
          <Revelar as="span" atraso={0.8}>
            <Rotulo numero="62°">Ângulo de construção</Rotulo>
          </Revelar>
        </div>
      </Ato>

      {/* ── 04 · Organizar ─────────────────────────────────────────────────
          Dois atos numa seção só: a estrutura vira quadro e o quadro passa a
          operar. Ficam juntos porque o painel precisa continuar grudado na tela
          durante a cena inteira — separá-los faria o produto sair e voltar
          exatamente no momento em que ele deveria estar sendo lido. */}
      <Ato ordem={4} atos={[ATO.QUADRO, ATO.OPERACAO]} rotulo="Organizar" id="produto">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <Revelar as="span">
              <Rotulo numero="03" acento>
                Organizar
              </Rotulo>
            </Revelar>
            <Revelar
              as="h2"
              atraso={0.08}
              duracao={1.15}
              className="max-w-2xl text-balance font-heading text-3xl font-light leading-tight sm:text-4xl"
            >
              Um Kanban que trabalha junto, não mais um lugar para atualizar.
            </Revelar>
          </div>
          <Revelar atraso={0.18}>
            <QuadroVivo />
          </Revelar>
        </div>
      </Ato>

      {/* ── 05 · Dados ─────────────────────────────────────────────────────
          O quadro se desfaz e as peças caem num histograma com eixo. A relação
          é a mensagem: o gráfico não aparece ao lado da operação, ele nasce
          dela. */}
      <Ato ordem={5} atos={[ATO.DADOS]} rotulo="Da tarefa ao dado">
        <Profundidade>
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
            <Revelar as="span">
              <Rotulo numero="04">Tarefa → dado → decisão</Rotulo>
            </Revelar>
            <Revelar
              as="h2"
              atraso={0.08}
              duracao={1.2}
              className="text-balance font-heading text-3xl font-light leading-tight sm:text-5xl"
            >
              Cada coisa que acontece no quadro
              <br />
              vira um <span className="text-primary">número que dá para usar</span>.
            </Revelar>
            <Revelar as="p" atraso={0.2} className="max-w-lg text-base leading-7 text-white/60">
              Ninguém preenche relatório. O apontamento do dia é o dado — e o dado é o que
              aparece no painel de quem precisa decidir.
            </Revelar>
          </div>
        </Profundidade>
      </Ato>

      {/* ── 06 · Medir ─────────────────────────────────────────────────────
          Os mesmos cinco números que a cena desenhou como barras no ato
          anterior, agora legíveis. A repetição é intencional: "o abstrato virou
          concreto", e não "apareceu outro gráfico". */}
      <Ato ordem={6} atos={[ATO.CAPACIDADE]} rotulo="Medir" scrim="esquerda">
        <div className="grid items-center gap-12 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="flex flex-col gap-5">
            <Revelar as="span">
              <Rotulo numero="05" acento>
                Medir
              </Rotulo>
            </Revelar>
            <Revelar
              as="h2"
              atraso={0.08}
              duracao={1.15}
              className="text-balance font-heading text-3xl font-light leading-tight sm:text-4xl"
            >
              O número que a planilha nunca deu no tempo certo.
            </Revelar>
            <Revelar as="p" atraso={0.2} className="max-w-md text-base leading-7 text-white/60">
              Cada pessoa aponta o dia em minutos. O índice de produtividade sai sozinho,
              comparado com a meta de cada um — e a capacidade da equipe fica visível antes
              de alguém estourar.
            </Revelar>
            <Revelar as="ul" atraso={0.3} className="flex flex-col gap-2.5">
              {[
                'Meta individual, não régua única para todo mundo',
                'Quem está sobrecarregado e quem tem folga, hoje',
                'Histórico semanal sem exportar nada',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm leading-6 text-white/60">
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-primary" aria-hidden />
                  {item}
                </li>
              ))}
            </Revelar>
          </div>
          <Revelar atraso={0.16}>
            <PainelCapacidade />
          </Revelar>
        </div>
      </Ato>

      {/* ── 07 · Automatizar ───────────────────────────────────────────────
          Seis núcleos em anel no espaço, com pulsos percorrendo as conexões. As
          seis etapas do DOM são as seis funcionalidades que a landing sempre
          anunciou — em cadeia, na ordem em que o sistema as executa. */}
      <Ato ordem={7} atos={[ATO.FLUXO]} rotulo="Automatizar">
        <div className="flex flex-col gap-8">
          <div className="flex max-w-2xl flex-col gap-4">
            <Revelar as="span">
              <Rotulo numero="06" acento>
                Automatizar
              </Rotulo>
            </Revelar>
            <Revelar
              as="h2"
              atraso={0.08}
              duracao={1.15}
              className="text-balance font-heading text-3xl font-light leading-tight sm:text-4xl"
            >
              O sistema trabalha junto com a equipe.
            </Revelar>
            <Revelar as="p" atraso={0.18} className="text-base leading-7 text-white/60">
              Uma demanda entra por um link e sai como relatório na segunda de manhã, sem
              ninguém empurrar cada etapa.
            </Revelar>
          </div>
          <Revelar atraso={0.24}>
            <FluxoAutomacao />
          </Revelar>
        </div>
      </Ato>

      {/* ── 08 · Isolamento ────────────────────────────────────────────────
          Respiro de novo. Três células, três organizações, nenhuma aresta
          cruzando fronteira — as conexões da cena são geradas por célula, então
          atravessar não é algo que foi bloqueado, é algo que não existe. */}
      <Ato ordem={8} atos={[ATO.ISOLAMENTO]} rotulo="Isolamento">
        <div className="flex flex-col gap-8">
          <div className="flex max-w-2xl flex-col gap-4">
            <Revelar as="span">
              <Rotulo numero="07">Isolamento</Rotulo>
            </Revelar>
            <Revelar
              as="h2"
              atraso={0.08}
              duracao={1.15}
              className="text-balance font-heading text-3xl font-light leading-tight sm:text-4xl"
            >
              O dado da sua empresa não encosta no de ninguém.
            </Revelar>
            <Revelar as="p" atraso={0.18} className="text-base leading-7 text-white/60">
              Cada organização é isolada no próprio banco de dados, com a barreira aplicada
              na camada mais baixa — não por um filtro que alguém pode esquecer de escrever.
              Segundo fator por e-mail e trilha de auditoria das ações vêm junto.
            </Revelar>
          </div>
          <Revelar atraso={0.24}>
            <CelulasIsolamento />
          </Revelar>
        </div>
      </Ato>

      {/* ── 09 · Conclusão ─────────────────────────────────────────────────
          Tudo o que apareceu volta e converge — desta vez maior, e desta vez o
          usuário já sabe o que a estrutura significa. Um CTA só, sem nada
          competindo: design.md §1 é explícito sobre nunca ter dois CTAs de
          mesmo peso, e este é o momento em que a regra mais importa. */}
      <Ato ordem={9} atos={[ATO.FINAL]} rotulo="Criar conta" scrim="coluna">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-7 text-center">
          <Revelar
            as="h2"
            duracao={1.3}
            angulo={62}
            className="text-balance font-heading text-4xl font-light leading-tight sm:text-6xl"
          >
            Pronto para ver a equipe <span className="text-primary">convergir</span>?
          </Revelar>
          <Revelar as="p" atraso={0.18} className="max-w-md text-base leading-7 text-white/60">
            Crie a conta e leve a equipe inteira por 14 dias. Sem cartão de crédito, sem
            versão reduzida.
          </Revelar>
          <Revelar atraso={0.3}>
            <BotaoMagnetico>
              <Link href="/cadastro" className={cn(buttonVariants({ size: 'lg' }), 'h-12 px-8 text-base')}>
                Criar minha conta <ArrowRight className="size-4" />
              </Link>
            </BotaoMagnetico>
          </Revelar>
          <Revelar atraso={0.42}>
            <a
              href="mailto:vendas@teralabs.cloud?subject=Quero%20conhecer%20o%20V%C3%A9rtice"
              className="rounded-sm text-sm text-white/45 transition-colors hover:text-white/80"
            >
              Prefere conversar antes? Fale com a gente
            </a>
          </Revelar>
        </div>
      </Ato>
    </Experiencia>
  )
}
