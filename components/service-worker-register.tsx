'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      if (process.env.NODE_ENV === 'production') {
        navigator.serviceWorker.register('/sw.js').catch((err) => {
          console.error('Falha ao registrar service worker:', err)
        })
      } else {
        // Em ambiente de desenvolvimento (dev HMR), desregistra os service workers
        // ativos para evitar retenção de chunks JS antigos no cache do navegador.
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister()
          }
        })
      }
    }
  }, [])

  return null
}
