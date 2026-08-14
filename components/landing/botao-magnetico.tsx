'use client'

import { useEffect, useRef } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'

import { useMovimentoReduzido } from '@/lib/landing/movimento-reduzido'
import { PONTEIRO } from '@/lib/landing/movimento'
import { cn } from '@/lib/utils'

/**
 * Botão magnético: o alvo se inclina na direção do cursor quando ele se
 * aproxima.
 *
 * Três coisas que este efeito não pode fazer, e que a maioria das
 * implementações faz:
 *
 *  - roubar o clique. O deslocamento vive num wrapper que não intercepta
 *    ponteiro; quem recebe o evento continua sendo o link de verdade lá dentro.
 *  - quebrar o teclado. Nada aqui depende de hover — foco, Enter e o anel de
 *    foco seguem intactos, e o wrapper não entra na ordem de tabulação.
 *  - fugir do dedo. Em aparelho sem ponteiro fino o efeito simplesmente não
 *    liga, porque num toque ele viraria um alvo que se move na hora de acertar.
 *
 * O deslocamento é pequeno de propósito (28% da distância): o suficiente para o
 * botão parecer vivo, longe do bastante de sair de baixo do cursor.
 */
export function BotaoMagnetico({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const reduzir = useMovimentoReduzido()
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  // Mola em vez de transição: a volta ao repouso precisa ter peso, senão o
  // botão "desliza" de volta e denuncia que é um efeito.
  const mx = useSpring(x, { stiffness: 260, damping: 22, mass: 0.6 })
  const my = useSpring(y, { stiffness: 260, damping: 22, mass: 0.6 })

  useEffect(() => {
    if (reduzir) return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    const el = ref.current
    if (!el) return

    let quadro = 0
    let ultimo: PointerEvent | null = null

    const avaliar = () => {
      quadro = 0
      if (!ultimo) return
      // Leitura de layout uma vez por quadro, dentro do rAF: consultar
      // getBoundingClientRect a cada pointermove intercalaria leitura e escrita
      // de estilo e forçaria reflow síncrono várias vezes por quadro.
      const r = el.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      const dx = ultimo.clientX - cx
      const dy = ultimo.clientY - cy
      const dist = Math.hypot(dx, dy)
      if (dist > PONTEIRO.raioMagnetico) {
        x.set(0)
        y.set(0)
        return
      }
      // A atração enfraquece na borda do raio, então o botão não "salta" ao
      // cruzar a fronteira.
      const forca = (1 - dist / PONTEIRO.raioMagnetico) * PONTEIRO.forcaMagnetica
      x.set(dx * forca)
      y.set(dy * forca)
    }

    const aoMover = (e: PointerEvent) => {
      ultimo = e
      if (!quadro) quadro = requestAnimationFrame(avaliar)
    }
    const soltar = () => {
      ultimo = null
      x.set(0)
      y.set(0)
    }

    window.addEventListener('pointermove', aoMover, { passive: true })
    window.addEventListener('pointerleave', soltar)
    window.addEventListener('blur', soltar)
    return () => {
      if (quadro) cancelAnimationFrame(quadro)
      window.removeEventListener('pointermove', aoMover)
      window.removeEventListener('pointerleave', soltar)
      window.removeEventListener('blur', soltar)
    }
  }, [reduzir, x, y])

  return (
    <span ref={ref} className={cn('inline-block', className)}>
      {/* O `style` é o mesmo com ou sem movimento reduzido; o que muda é que
          as molas nunca saem de zero, porque o efeito nem chega a ser ligado.
          Trocar a forma do elemento aqui deixaria um transform do servidor
          preso no DOM. */}
      <motion.span className="inline-block" style={{ x: mx, y: my }}>
        {children}
      </motion.span>
    </span>
  )
}
