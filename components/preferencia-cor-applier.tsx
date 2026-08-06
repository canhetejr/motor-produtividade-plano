'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { CHAVE_COR, corDeContraste, lerPreferenciaCor } from '@/lib/preferencia-cor'

const EVENTO = 'vertice:cor-primaria'
function assinar(callback: () => void) {
  window.addEventListener(EVENTO, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(EVENTO, callback)
    window.removeEventListener('storage', callback)
  }
}

/** Aplica a cor escolhida antes de qualquer tela, inclusive login e PWA. */
export function PreferenciaCorApplier() {
  const bruto = useSyncExternalStore(assinar, () => localStorage.getItem(CHAVE_COR), () => null)
  const cor = lerPreferenciaCor(bruto)

  useEffect(() => {
    // Sobrescreve só o token de marca — --ring e --accent-foreground divergem
    // de propósito entre claro/escuro (design.md) e não devem seguir a escolha.
    const raiz = document.documentElement.style
    const contraste = corDeContraste(cor)
    raiz.setProperty('--primary', cor)
    raiz.setProperty('--primary-foreground', contraste)
    raiz.setProperty('--sidebar-primary', cor)
    raiz.setProperty('--sidebar-primary-foreground', contraste)
  }, [cor])

  return null
}
