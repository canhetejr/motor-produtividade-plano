'use client'

import { useEffect, useRef, useSyncExternalStore } from 'react'
import { useTheme } from 'next-themes'

import {
  arestasVisiveis,
  avancar,
  criarParticulas,
  type Particula,
  type Ponteiro,
} from '@/lib/particulas'
import { CHAVE_ANIMACOES, deveAnimar } from '@/lib/preferencia-animacoes'

const EVENTO = 'vertice:animacoes'

function assinar(callback: () => void) {
  window.addEventListener(EVENTO, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(EVENTO, callback)
    window.removeEventListener('storage', callback)
  }
}

const SEM_MUDANCA = () => () => {}
function lerReduzirMovimento(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Malha de vértices reativa, atrás de toda a interface.
 *
 * Canvas, e não DOM: 90 nós e até 4.005 arestas por quadro como elementos
 * seriam recálculo de layout sessenta vezes por segundo. Aqui o navegador
 * desenha num bitmap e não recalcula nada da página.
 *
 * `pointer-events: none` e `-z-10`: o fundo nunca intercepta clique nem entra na
 * ordem de leitura. `aria-hidden` porque não há o que anunciar.
 */
export function FundoParticulas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { resolvedTheme } = useTheme()

  const preferencia = useSyncExternalStore(
    assinar,
    () => localStorage.getItem(CHAVE_ANIMACOES),
    () => null
  )
  const reduzir = useSyncExternalStore(SEM_MUDANCA, lerReduzirMovimento, () => true)
  const animar = deveAnimar(preferencia, reduzir)

  useEffect(() => {
    if (!animar) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let particulas: Particula[] = []
    let ponteiro: Ponteiro = null
    let quadro = 0
    let anterior = performance.now()
    let largura = 0
    let altura = 0

    // Teto de 2 no devicePixelRatio: num celular com DPR 3 a área de pintura
    // triplica sem ganho visível numa malha de linhas finas.
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    function redimensionar() {
      largura = window.innerWidth
      altura = window.innerHeight
      canvas!.width = largura * dpr
      canvas!.height = altura * dpr
      canvas!.style.width = `${largura}px`
      canvas!.style.height = `${altura}px`
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      particulas = criarParticulas(largura, altura)
    }

    redimensionar()

    // Cores da marca. O tema escuro aguenta mint; no claro ele some, então o
    // roxo desenha.
    const escuro = resolvedTheme === 'dark'
    const corNo = escuro ? '0, 255, 206' : '130, 10, 209'
    const corAresta = escuro ? '169, 75, 240' : '130, 10, 209'
    const alfaNo = escuro ? 0.5 : 0.35
    const alfaAresta = escuro ? 0.22 : 0.16

    function desenhar(agora: number) {
      const delta = (agora - anterior) / 1000
      anterior = agora

      avancar(particulas, largura, altura, delta, ponteiro)
      ctx!.clearRect(0, 0, largura, altura)

      for (const { a, b, forca } of arestasVisiveis(particulas)) {
        ctx!.strokeStyle = `rgba(${corAresta}, ${forca * alfaAresta})`
        ctx!.lineWidth = 1
        ctx!.beginPath()
        ctx!.moveTo(a.x, a.y)
        ctx!.lineTo(b.x, b.y)
        ctx!.stroke()
      }

      ctx!.fillStyle = `rgba(${corNo}, ${alfaNo})`
      for (const p of particulas) {
        ctx!.beginPath()
        ctx!.arc(p.x, p.y, 1.5, 0, Math.PI * 2)
        ctx!.fill()
      }

      quadro = requestAnimationFrame(desenhar)
    }

    quadro = requestAnimationFrame(desenhar)

    const aoMover = (e: PointerEvent) => {
      ponteiro = { x: e.clientX, y: e.clientY }
    }
    // Sem isto o ponteiro fica "preso" na última posição e continua empurrando
    // as partículas depois que o mouse saiu da janela.
    const aoSair = () => {
      ponteiro = null
    }

    const aoTrocarVisibilidade = () => {
      if (document.visibilityState === 'hidden') {
        cancelAnimationFrame(quadro)
      } else {
        // Sem reancorar, o primeiro delta seria o tempo inteiro em segundo
        // plano — o teto em `avancar` protege, mas reancorar é o certo.
        anterior = performance.now()
        quadro = requestAnimationFrame(desenhar)
      }
    }

    window.addEventListener('pointermove', aoMover, { passive: true })
    window.addEventListener('pointerleave', aoSair)
    window.addEventListener('resize', redimensionar)
    document.addEventListener('visibilitychange', aoTrocarVisibilidade)

    return () => {
      cancelAnimationFrame(quadro)
      window.removeEventListener('pointermove', aoMover)
      window.removeEventListener('pointerleave', aoSair)
      window.removeEventListener('resize', redimensionar)
      document.removeEventListener('visibilitychange', aoTrocarVisibilidade)
    }
  }, [animar, resolvedTheme])

  if (!animar) return null

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10"
    />
  )
}
