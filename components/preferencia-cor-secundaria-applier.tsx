'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { escurecer } from '@/lib/cor-utils'
import { CHAVE_COR_SECUNDARIA, lerPreferenciaCorSecundaria } from '@/lib/preferencia-cor-secundaria'

const EVENTO = 'vertice:cor-secundaria'
function assinar(callback: () => void) {
  window.addEventListener(EVENTO, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(EVENTO, callback)
    window.removeEventListener('storage', callback)
  }
}

/** Aplica a cor secundária escolhida antes de qualquer tela — calendário de
 * ritmo, metas atingidas e o fundo de partículas leem `--v-secundaria`. */
export function PreferenciaCorSecundariaApplier() {
  const bruto = useSyncExternalStore(assinar, () => localStorage.getItem(CHAVE_COR_SECUNDARIA), () => null)
  const cor = lerPreferenciaCorSecundaria(bruto)

  useEffect(() => {
    const raiz = document.documentElement.style
    raiz.setProperty('--v-secundaria', cor)
    raiz.setProperty('--v-secundaria-forte', escurecer(cor))
  }, [cor])

  return null
}
