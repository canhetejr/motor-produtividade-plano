'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, useScroll, useSpring } from 'framer-motion'

import { VerticeLockup } from '@/components/vertice-symbol'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { BotaoMagnetico } from './botao-magnetico'

/**
 * Cabeçalho da landing.
 *
 * Começa quase ausente — sem superfície, sem borda, deixando a hero respirar —
 * e ganha corpo assim que a narrativa sai da abertura: altura menor, fundo com
 * desfoque e uma borda de um pixel. Nunca compete com a cena; a única coisa que
 * não muda de peso é o CTA, porque é para ele que a página inteira aponta.
 *
 * A linha de progresso é a única pista de "quanto falta" numa página longa.
 * Fina o bastante para ser subconsciente, e alimentada por `useScroll` do
 * documento inteiro — inclusive o rodapé, que é onde ela precisa fechar em 100%.
 */
export function CabecalhoLanding() {
  const [compacto, setCompacto] = useState(false)
  const { scrollYProgress } = useScroll()
  // A mola tira o "degrau" que a rolagem por roda produz na barra.
  const progresso = useSpring(scrollYProgress, { stiffness: 120, damping: 28, restDelta: 0.001 })

  useEffect(() => {
    // Limiar em 70% da altura da tela: o cabeçalho só ganha peso depois que a
    // hero deixou de ser o assunto.
    const avaliar = () => setCompacto(window.scrollY > window.innerHeight * 0.7)
    avaliar()
    window.addEventListener('scroll', avaliar, { passive: true })
    return () => window.removeEventListener('scroll', avaliar)
  }, [])

  return (
    <header
      data-compacto={compacto}
      className={cn(
        // `group` para que a marca possa reagir ao estado do cabeçalho.
        'group fixed inset-x-0 top-0 z-50 transition-[height,background-color,border-color,backdrop-filter] duration-500 ease-[cubic-bezier(.16,1,.3,1)]',
        'h-20 border-b border-transparent',
        // Superfície mais fechada do que a transparência que costuma bastar em
        // cabeçalhos: aqui atrás dele passa um campo de fragmentos em
        // movimento, e a 72% a marca ficava sendo lida por cima de retângulos
        // que andam. Marca precisa de fundo estável.
        'data-[compacto=true]:h-14 data-[compacto=true]:border-white/10 data-[compacto=true]:bg-[#05050b]'
      )}
    >
      <div className="mx-auto flex h-full w-full max-w-6xl items-center justify-between px-6">
        <Link href="/" aria-label="Vértice, um produto Tera" className="rounded-sm">
          <VerticeLockup
            priority
            alt=""
            className="h-8 w-auto transition-[height] duration-500 group-data-[compacto=true]:h-7"
          />
        </Link>
        <nav className="flex items-center gap-5" aria-label="Principal">
          <Link
            href="/precos"
            className="hidden rounded-sm text-sm text-white/65 transition-colors hover:text-white sm:inline"
          >
            Preços
          </Link>
          <Link href="/login" className="rounded-sm text-sm text-white/65 transition-colors hover:text-white">
            Entrar
          </Link>
          <BotaoMagnetico>
            <Link href="/cadastro" className={buttonVariants({ size: 'sm' })}>
              Começar grátis
            </Link>
          </BotaoMagnetico>
        </nav>
      </div>
      <motion.span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-px origin-left bg-primary/70"
        style={{ scaleX: progresso }}
      />
    </header>
  )
}
