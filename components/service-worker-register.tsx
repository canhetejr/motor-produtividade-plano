'use client'

import { useEffect } from 'react'

// Registro mínimo, sem next-pwa/serwist (não estavam no projeto e adicionar
// dependência nova só pra isso é desproporcional pro escopo — ver
// public/sw.js pra estratégia de cache).
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('Falha ao registrar service worker:', err)
      })
    }
  }, [])

  return null
}
