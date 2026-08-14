'use client'

import { useEffect, useRef } from 'react'
import { animate, motion, useInView, useMotionValue, useTransform } from 'framer-motion'

import { useMovimentoReduzido } from '@/lib/landing/movimento-reduzido'
import { CURVA_ENTRADA, DURACAO_REVELACAO } from '@/lib/landing/movimento'
import { cn } from '@/lib/utils'
import { useCapituloAtual } from './ato'

/** Onde a máscara começa (tudo escondido) e onde termina (tudo revelado).
 *  Fora de 0–100 de propósito: parando nas bordas, as extremidades do bloco
 *  ficariam meio reveladas nos extremos da varredura. */
const ESCONDIDO = -20
const REVELADO = 120

/**
 * Revelação por máscara.
 *
 * Não é fade-up. Um gradiente diagonal atravessa o bloco e revela o texto por
 * trás dele, na mesma direção em que o campo 3D converge — o texto entra pelo
 * vocabulário de movimento da cena em vez de ter o seu próprio. A máscara
 * também evita reflow: o texto nunca sai do lugar, então nada salta durante a
 * leitura.
 *
 * Dispara uma vez, na entrada em tela, e não é presa ao scrub da rolagem.
 * Entrada é um evento, não um estado: amarrada ao progresso do capítulo, a
 * frase ficaria invisível durante a tela inteira que a seção leva para chegar
 * ao topo, e reverteria ao rolar para trás.
 *
 * ── Por que o movimento reduzido NÃO troca o elemento renderizado ────────────
 *
 * A versão anterior devolvia uma tag simples, sem `motion` e sem máscara,
 * quando a preferência estava ligada. Isso quebrava a hidratação: o servidor
 * não tem como saber a preferência do usuário, então o HTML entregue já vinha
 * com a máscara no estado escondido; no cliente o componente passava a
 * renderizar um elemento sem `style` nenhum, e o React mantinha o atributo que
 * veio do servidor em vez de removê-lo. Resultado: com "reduzir movimento"
 * ligado, a página inteira ficava sem texto — o conteúdo estava no DOM,
 * mascarado para sempre.
 *
 * A regra que evita isso, aqui e em qualquer lugar: nunca variar a FORMA do que
 * é renderizado em função de algo que só o cliente conhece. Varia-se o VALOR.
 * Com movimento reduzido a máscara continua existindo e simplesmente vai
 * direto para o estado revelado.
 */
export function Revelar({
  children,
  className,
  atraso = 0,
  duracao = DURACAO_REVELACAO,
  angulo = 100,
  as: Tag = 'div',
}: {
  children: React.ReactNode
  className?: string
  atraso?: number
  duracao?: number
  angulo?: number
  as?: 'div' | 'h1' | 'h2' | 'h3' | 'p' | 'span' | 'li' | 'ul'
}) {
  const ref = useRef<HTMLDivElement>(null)
  const reduzir = useMovimentoReduzido()
  const varredura = useMotionValue(ESCONDIDO)
  const emVista = useInView(ref, { once: true, margin: '-8% 0px -12% 0px' })

  useEffect(() => {
    if (reduzir) {
      varredura.set(REVELADO)
      return
    }
    if (!emVista) {
      // Rede de segurança: se o IntersectionObserver não disparar por qualquer
      // motivo, o texto aparece sozinho em vez de ficar escondido para sempre.
      // Texto invisível é uma falha grave demais para depender de uma única API.
      const id = window.setTimeout(() => varredura.set(REVELADO), 2500)
      return () => window.clearTimeout(id)
    }
    const controle = animate(varredura, REVELADO, { duration: duracao, delay: atraso, ease: CURVA_ENTRADA })
    return () => controle.stop()
  }, [emVista, reduzir, varredura, duracao, atraso])

  const Componente = motion[Tag] as typeof motion.div

  return (
    <Componente
      ref={ref}
      className={className}
      style={
        {
          '--v': varredura,
          // A faixa de 26% entre opaco e transparente é a suavidade da
          // varredura: estreita demais vira um corte duro atravessando a frase;
          // larga demais e o texto passa metade do tempo ilegível.
          maskImage: `linear-gradient(${angulo}deg, #000 calc(var(--v) * 1% - 14%), transparent calc(var(--v) * 1% + 12%))`,
          WebkitMaskImage: `linear-gradient(${angulo}deg, #000 calc(var(--v) * 1% - 14%), transparent calc(var(--v) * 1% + 12%))`,
        } as React.CSSProperties
      }
    >
      {children}
    </Componente>
  )
}

/**
 * Saída em profundidade, ligada ao progresso do capítulo.
 *
 * Substitui o par `opacity`/`translateY` que aparece em toda landing: em vez de
 * subir, o bloco recua no eixo Z e sai de foco, como se a câmera avançasse
 * através dele — que é literalmente o que a câmera da cena faz atrás. Aqui o
 * scrub é o certo: a saída não é um evento, é um estado contínuo que precisa
 * acompanhar a rolagem nos dois sentidos.
 *
 * Mesma regra do componente acima: com movimento reduzido o elemento continua
 * sendo o mesmo, só que as transformações ficam paradas na identidade.
 */
export function Profundidade({
  children,
  className,
  de = 0.42,
  ate = 1,
  recuo = -380,
}: {
  children: React.ReactNode
  className?: string
  de?: number
  ate?: number
  recuo?: number
}) {
  const { bruto } = useCapituloAtual()
  const reduzir = useMovimentoReduzido()

  const avanco = useTransform(bruto, [de, ate], [0, 1], { clamp: true })
  const z = useTransform(avanco, (v) => (reduzir ? 0 : v * recuo))
  // A opacidade zera na metade do recuo, e não no fim dele.
  //
  // Um capítulo de 1,7 viewport desgruda por volta de 40% do progresso e leva
  // o resto do caminho subindo enquanto o próximo já entra por baixo — os dois
  // dividem a tela nesse intervalo. Com a opacidade caindo ao longo de todo o
  // recuo, o texto que sai ainda estava perto de 50% quando a manchete
  // seguinte já era legível, e dava para ler dois títulos ao mesmo tempo. Sair
  // no dobro da velocidade do deslocamento resolve sem encurtar o movimento.
  const opacidade = useTransform(avanco, (v) => (reduzir ? 1 : 1 - Math.min(v * 2, 1)))
  // Desfoque só na segunda metade do recuo: repintar com blur durante toda a
  // leitura custaria quadro sem nenhum ganho.
  const filtro = useTransform(avanco, (v) => {
    const desfoque = reduzir ? 0 : Math.max(v - 0.2, 0) * 10
    return desfoque < 0.15 ? 'none' : `blur(${desfoque.toFixed(2)}px)`
  })

  return (
    <motion.div
      className={cn('[transform-style:preserve-3d]', className)}
      style={{ translateZ: z, opacity: opacidade, filter: filtro }}
    >
      {children}
    </motion.div>
  )
}
