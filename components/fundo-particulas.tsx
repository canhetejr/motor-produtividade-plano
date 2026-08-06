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
import { CHAVE_COR, lerPreferenciaCor } from '@/lib/preferencia-cor'
import { CHAVE_COR_SECUNDARIA, COR_SECUNDARIA_PADRAO, lerPreferenciaCorSecundaria } from '@/lib/preferencia-cor-secundaria'
import { hexParaRgbCss } from '@/lib/cor-utils'

const EVENTO = 'vertice:animacoes'

function assinar(callback: () => void) {
  window.addEventListener(EVENTO, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(EVENTO, callback)
    window.removeEventListener('storage', callback)
  }
}

const EVENTO_COR = 'vertice:cor-primaria'
function assinarCor(callback: () => void) {
  window.addEventListener(EVENTO_COR, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(EVENTO_COR, callback)
    window.removeEventListener('storage', callback)
  }
}

const EVENTO_COR_SECUNDARIA = 'vertice:cor-secundaria'
function assinarCorSecundaria(callback: () => void) {
  window.addEventListener(EVENTO_COR_SECUNDARIA, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(EVENTO_COR_SECUNDARIA, callback)
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
 * `pointer-events: none` e a camada base do layout: o fundo nunca intercepta
 * clique nem entra na ordem de leitura. `aria-hidden` porque não há o que
 * anunciar.
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

  const corPrimariaBruta = useSyncExternalStore(assinarCor, () => localStorage.getItem(CHAVE_COR), () => null)
  const corPrimaria = lerPreferenciaCor(corPrimariaBruta)
  const corSecundariaBruta = useSyncExternalStore(
    assinarCorSecundaria,
    () => localStorage.getItem(CHAVE_COR_SECUNDARIA),
    () => null
  )
  const corSecundaria = lerPreferenciaCorSecundaria(corSecundariaBruta)

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

    // Arestas seguem a cor principal e nós a cor secundária — as mesmas
    // escolhas de Aparência, não mais uma cor de marca fixa. Sem
    // personalização (secundária ainda no padrão mint), preserva o
    // comportamento original no tema claro: mint some contra papel, então o
    // roxo desenha os nós também. A opacidade continua variando por tema
    // porque o requisito de contraste contra o fundo muda, não a cor em si.
    const escuro = resolvedTheme === 'dark'
    const secundariaPersonalizada = corSecundaria.toLowerCase() !== COR_SECUNDARIA_PADRAO.toLowerCase()
    const corNo = hexParaRgbCss(escuro || secundariaPersonalizada ? corSecundaria : corPrimaria)
    const corAresta = hexParaRgbCss(corPrimaria)
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
  }, [animar, resolvedTheme, corPrimaria, corSecundaria])

  if (!animar) return null

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 opacity-70"
    />
  )
}
