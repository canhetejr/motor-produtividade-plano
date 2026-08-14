'use client'

import { useEffect, useRef, useState } from 'react'

import { detectar, type Capacidade } from '@/lib/landing/dispositivo'
import type { CenaConvergencia } from '@/lib/landing/cena/cena'
import { motorRolagem } from '@/lib/landing/rolagem'

/**
 * A cena persistente: um único canvas, fixo, atrás de toda a narrativa.
 *
 * "Persistente" é o ponto. Não existe um canvas por seção — existe uma cena que
 * atravessa a página inteira, e é isso que faz o usuário perceber que os
 * fragmentos do caos são os *mesmos* que viram cartão do quadro e depois barra
 * de capacidade. Vários canvas independentes contariam dez histórias curtas.
 *
 * Carregamento: o three só é buscado depois que o navegador fica ocioso. A
 * página é útil e completa antes disso — o canvas entra por cima, com fade, sem
 * mover nada de lugar. A experiência melhora depois do load; nunca depende dele.
 */
export function CenaPersistente({
  aoMudarCapacidade,
  aoPronta,
}: {
  aoMudarCapacidade?: (c: Capacidade) => void
  /** Entrega a instância montada — só o painel de depuração usa. */
  aoPronta?: (cena: CenaConvergencia | null) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const envelopeRef = useRef<HTMLDivElement>(null)
  const [pronto, setPronto] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const envelope = envelopeRef.current
    if (!canvas || !envelope) return

    const capacidade = detectar()
    aoMudarCapacidade?.(capacidade)
    if (!capacidade.webgl) return

    let cena: CenaConvergencia | null = null
    let cancelado = false
    const limpezas: (() => void)[] = []

    const montar = async () => {
      const { CenaConvergencia } = await import('@/lib/landing/cena/cena')
      if (cancelado) return

      cena = new CenaConvergencia({
        canvas,
        capacidade,
        aoRebaixar: aoMudarCapacidade,
        aoPulsar: (v) => {
          // Vai para o DOM como custom property, e não como estado: o fundo
          // ambiente reage ao mesmo pulso da cena sem um re-render por quadro.
          envelope.style.setProperty('--pulso', v.toFixed(3))
        },
      })

      const medir = () => {
        const r = envelope.getBoundingClientRect()
        cena?.redimensionar(Math.round(r.width), Math.round(r.height))
      }
      medir()

      // ResizeObserver, e não `window.resize`: pega mudança de barra de
      // ferramentas no iOS, rotação e entrada do teclado virtual — casos em que
      // a janela não dispara resize mas a área pintada muda de tamanho.
      const observador = new ResizeObserver(medir)
      observador.observe(envelope)
      limpezas.push(() => observador.disconnect())

      limpezas.push(motorRolagem.assinar((e) => cena?.definirAto(e.ato)))

      if (capacidade.ponteiro) {
        const aoMover = (e: PointerEvent) => {
          cena?.definirPonteiro((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1))
        }
        // Ponteiro que sai da janela precisa voltar ao centro, senão o campo
        // fica torto até o mouse reaparecer.
        const aoSair = () => cena?.definirPonteiro(0, 0)
        window.addEventListener('pointermove', aoMover, { passive: true })
        window.addEventListener('pointerleave', aoSair)
        limpezas.push(() => {
          window.removeEventListener('pointermove', aoMover)
          window.removeEventListener('pointerleave', aoSair)
        })
      }

      // Nada roda com a aba escondida nem com a narrativa fora de tela: a
      // landing não pode gastar bateria desenhando o que ninguém está vendo.
      let visivelNaTela = true
      const reavaliar = () => {
        if (visivelNaTela && document.visibilityState === 'visible') cena?.iniciar()
        else cena?.parar()
      }
      const io = new IntersectionObserver(
        ([entrada]) => {
          visivelNaTela = entrada.isIntersecting
          reavaliar()
        },
        { rootMargin: '10% 0px' }
      )
      io.observe(envelope)
      document.addEventListener('visibilitychange', reavaliar)
      limpezas.push(() => {
        io.disconnect()
        document.removeEventListener('visibilitychange', reavaliar)
      })

      reavaliar()
      aoPronta?.(cena)
      setPronto(true)
    }

    // `requestIdleCallback` não existe no Safari antigo; o timeout cobre o caso
    // sem atrasar quem tem a API.
    const ocioso = window.requestIdleCallback ?? ((fn: () => void) => window.setTimeout(fn, 220))
    const cancelaOcioso = window.cancelIdleCallback ?? window.clearTimeout
    // A falha ao carregar o pedaço do three não pode virar rejeição sem dono:
    // a cena é enriquecimento, e a página já está completa e utilizável sem
    // ela. Rede instável, conexão que cai no meio do download ou aba fechada
    // durante o import — em qualquer um desses casos o certo é a composição
    // estática permanecer, silenciosamente, em vez de a página acusar erro.
    const id = ocioso(() => {
      montar().catch(() => {
        // Sem `setPronto(true)`, o canvas continua transparente e a malha
        // ambiente segue sendo a composição de fundo.
      })
    }, { timeout: 1400 })

    return () => {
      cancelado = true
      cancelaOcioso(id as number)
      for (const fn of limpezas) fn()
      aoPronta?.(null)
      cena?.destruir()
    }
  }, [aoMudarCapacidade, aoPronta])

  return (
    <div
      ref={envelopeRef}
      // `fixed` e não `sticky`: a cena precisa sobreviver às fronteiras de
      // seção. Um canvas por seção grudada reiniciaria a cada capítulo, que é
      // exatamente a continuidade espacial que a experiência não pode perder.
      className="pointer-events-none fixed inset-0 z-0 [--pulso:0]"
      aria-hidden
    >
      {/* Atmosfera, não "fundo animado": a malha de vértices do sistema
          gráfico (design.md §9) em 10% de presença, reagindo ao mesmo pulso de
          convergência da cena. Ela também é o que sustenta a composição
          enquanto o WebGL ainda não chegou — ou nunca chega. */}
      <div
        className="absolute inset-0 opacity-[0.55] transition-opacity duration-700"
        style={{
          backgroundImage:
            'radial-gradient(circle, color-mix(in oklch, var(--tera-acid), transparent calc(88% - var(--pulso) * 22%)) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          maskImage: 'radial-gradient(ellipse 78% 62% at 50% 45%, #000 20%, transparent 78%)',
          WebkitMaskImage: 'radial-gradient(ellipse 78% 62% at 50% 45%, #000 20%, transparent 78%)',
        }}
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 size-full transition-opacity duration-1000 ease-out"
        style={{ opacity: pronto ? 1 : 0 }}
      />
      {/* Vinheta quase imperceptível: fecha os cantos sem nenhum passe de
          post-processing.

          Fraca e começando tarde de propósito. A formação de abertura é um
          anel com o miolo vazio — os fragmentos vivem justamente na periferia,
          que é onde uma vinheta forte os apaga. O contraste do texto é
          responsabilidade do scrim de cada capítulo, que escurece só a área
          sob as letras; a vinheta aqui só fecha o quadro. */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 96% 86% at 50% 45%, transparent 58%, rgba(3,3,8,.38) 100%)' }}
      />
    </div>
  )
}
