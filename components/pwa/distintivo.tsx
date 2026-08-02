'use client'

import { useEffect } from 'react'

// Badging API não está no lib.dom padrão.
type NavigatorComDistintivo = Navigator & {
  setAppBadge?: (contador?: number) => Promise<void>
  clearAppBadge?: () => Promise<void>
}

/**
 * Contador de não lidas no ícone do app instalado (Badging API).
 *
 * Só tem efeito quando o app está instalado — no navegador comum o método não
 * existe e o hook não faz nada. Falha silenciosa é o comportamento certo: é
 * enfeite de launcher, e um erro aqui não pode borbulhar para a árvore React
 * nem aparecer no console a cada notificação.
 */
export function useDistintivoDoApp(naoLidas: number) {
  useEffect(() => {
    const nav = navigator as NavigatorComDistintivo
    if (!nav.setAppBadge || !nav.clearAppBadge) return

    const acao = naoLidas > 0 ? nav.setAppBadge(naoLidas) : nav.clearAppBadge()
    acao.catch(() => {})
  }, [naoLidas])
}
