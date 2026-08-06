'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { CHAVE_RAIO, lerPreferenciaRaio } from '@/lib/preferencia-raio'

const EVENTO = 'vertice:bordas'
function assinar(callback: () => void) {
  window.addEventListener(EVENTO, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(EVENTO, callback)
    window.removeEventListener('storage', callback)
  }
}

/** Aplica a escolha antes de qualquer tela, inclusive login e PWA. */
export function PreferenciaRaioApplier() {
  const bruto = useSyncExternalStore(assinar, () => localStorage.getItem(CHAVE_RAIO), () => null)
  const valor = lerPreferenciaRaio(bruto)
  useEffect(() => {
    const raiz = document.documentElement.classList
    raiz.toggle('vertice-cantos-retos', valor === 'reto')
    raiz.toggle('vertice-cantos-maximos', valor === 'maximo')
  }, [valor])
  return null
}
