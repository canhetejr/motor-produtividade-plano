'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    if (process.env.NODE_ENV !== 'production') {
      // Em desenvolvimento (dev HMR), desregistra os service workers ativos para
      // evitar retenção de chunks JS antigos no cache do navegador.
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) registration.unregister()
      })
      return
    }

    let recarregando = false
    const aoTrocarControlador = () => {
      // Guarda contra loop: controllerchange dispara também na primeira
      // instalação, e um reload lá reiniciaria o ciclo.
      if (recarregando) return
      recarregando = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', aoTrocarControlador)

    // O ?v= muda a cada deploy, então o browser busca o sw.js de novo (ele
    // compara byte a byte) e o CACHE_NAME acompanha.
    navigator.serviceWorker
      .register(`/sw.js?v=${process.env.NEXT_PUBLIC_SW_VERSION ?? 'dev'}`)
      .then((registration) => {
        const avisar = (esperando: ServiceWorker) => {
          toast('Nova versão disponível', {
            description: 'Atualize para carregar as últimas mudanças.',
            duration: Infinity,
            action: {
              label: 'Atualizar',
              onClick: () => esperando.postMessage({ type: 'SKIP_WAITING' }),
            },
          })
        }

        // Já havia uma versão esperando quando esta aba abriu.
        if (registration.waiting && navigator.serviceWorker.controller) {
          avisar(registration.waiting)
        }

        registration.addEventListener('updatefound', () => {
          const instalando = registration.installing
          if (!instalando) return
          instalando.addEventListener('statechange', () => {
            // `controller` só existe se já havia um SW no comando — sem ele isto
            // é a primeira instalação, e não há "nova versão" a anunciar.
            if (instalando.state === 'installed' && navigator.serviceWorker.controller) {
              avisar(instalando)
            }
          })
        })
      })
      .catch((err) => {
        console.error('Falha ao registrar service worker:', err)
      })

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', aoTrocarControlador)
    }
  }, [])

  return null
}
