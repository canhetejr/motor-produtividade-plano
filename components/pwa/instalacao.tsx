'use client'

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

import { Button } from '@/components/ui/button'

// O evento não está no lib.dom padrão — é específico dos browsers Chromium.
type PromptDeInstalacao = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const CHAVE_DISPENSADO = 'vertice:instalacao-dispensada'

/**
 * Convite de instalação próprio.
 *
 * O Chrome só mostra o banner nativo quando quer, e no iOS ele não existe —
 * lá a instalação é um item escondido no menu de compartilhar. Capturar o
 * `beforeinstallprompt` deixa o convite aparecer num momento que faz sentido,
 * e uma vez só: quem dispensa não vê de novo.
 *
 * Não renderiza nada quando o app já está instalado (`display-mode: standalone`).
 */
export function ConviteDeInstalacao() {
  const [evento, setEvento] = useState<PromptDeInstalacao | null>(null)
  const [visivel, setVisivel] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(CHAVE_DISPENSADO)) return
    if (window.matchMedia('(display-mode: standalone)').matches) return

    const capturar = (e: Event) => {
      // Sem preventDefault o Chrome mostra o próprio banner e este some.
      e.preventDefault()
      setEvento(e as PromptDeInstalacao)
      setVisivel(true)
    }
    window.addEventListener('beforeinstallprompt', capturar)

    const instalado = () => setVisivel(false)
    window.addEventListener('appinstalled', instalado)

    return () => {
      window.removeEventListener('beforeinstallprompt', capturar)
      window.removeEventListener('appinstalled', instalado)
    }
  }, [])

  function dispensar() {
    localStorage.setItem(CHAVE_DISPENSADO, '1')
    setVisivel(false)
  }

  async function instalar() {
    if (!evento) return
    await evento.prompt()
    const { outcome } = await evento.userChoice
    // O evento é de uso único: depois de consumido não dá para chamar de novo.
    setEvento(null)
    setVisivel(false)
    if (outcome === 'dismissed') localStorage.setItem(CHAVE_DISPENSADO, '1')
  }

  if (!visivel) return null

  return (
    <div
      role="dialog"
      aria-label="Instalar o Vértice"
      className="fixed inset-x-3 bottom-[calc(4rem+env(safe-area-inset-bottom)+0.75rem)] z-30 mx-auto max-w-sm rounded-xl border border-border bg-card p-3 shadow-2xl md:bottom-4 md:left-auto md:right-4 md:mx-0"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary">
          <Download className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Instalar o Vértice</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Abre direto da tela inicial, sem barra do navegador.
          </p>
          <div className="mt-2.5 flex gap-2">
            <Button size="sm" onClick={instalar}>
              Instalar
            </Button>
            <Button size="sm" variant="ghost" onClick={dispensar}>
              Agora não
            </Button>
          </div>
        </div>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={dispensar}
          aria-label="Dispensar convite de instalação"
          className="-mr-1 -mt-1 shrink-0 text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
