'use client'

import type { CSSProperties } from 'react'
import { Toaster as SonnerToaster } from 'sonner'

/**
 * Ícone de vértice: traços retos que se encontram num ponto, no ângulo da
 * marca (design.md — "convergência"), com canto vivo em vez de curva.
 * Substitui o check/x genérico do `richColors` do sonner por algo que lê
 * como Tera. `currentColor` acompanha a cor do texto do toast, então um só
 * SVG serve para os três estados.
 */
function IconeVertice({ variante }: { variante: 'sucesso' | 'erro' | 'alerta' }) {
  const pontos = variante === 'erro'
    ? 'M6 6 12 12 6 18 M18 6 12 12 18 18' // dois traços cruzando — ruptura
    : variante === 'alerta'
      ? 'M12 4 4 20 20 20 Z M12 10 V15 M12 17.5 V18' // ângulo com ponto de atenção
      : 'M4 13 10 19 20 6' // check com vértice único (canto vivo, não curva)

  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
      <path d={pontos} stroke="currentColor" strokeWidth="2.25" strokeLinecap="square" strokeLinejoin="miter" />
    </svg>
  )
}

/**
 * Toaster do produto. O `richColors` padrão do sonner usa verde/vermelho
 * genéricos e ignora os tokens semânticos do Vértice (--success-*,
 * --danger-*, --warning-*) — por isso as cores são repassadas via as
 * variáveis CSS que o próprio sonner lê (--normal-bg, --success-bg etc.),
 * em vez de `richColors`.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      icons={{
        success: <IconeVertice variante="sucesso" />,
        error: <IconeVertice variante="erro" />,
        warning: <IconeVertice variante="alerta" />,
      }}
      toastOptions={{
        classNames: {
          toast: 'font-sans rounded-[8px]! shadow-lg!',
          title: 'font-medium!',
          actionButton: 'rounded-[8px]!',
          cancelButton: 'rounded-[8px]!',
        },
        style: {
          '--normal-bg': 'var(--popover)',
          '--normal-border': 'var(--border)',
          '--normal-text': 'var(--popover-foreground)',
          '--success-bg': 'var(--success-superficie)',
          '--success-border': 'var(--success-borda)',
          '--success-text': 'var(--success-texto)',
          '--error-bg': 'var(--danger-superficie)',
          '--error-border': 'var(--danger-borda)',
          '--error-text': 'var(--danger-texto)',
          '--warning-bg': 'var(--warning-superficie)',
          '--warning-border': 'var(--warning-borda)',
          '--warning-text': 'var(--warning-texto)',
        } as CSSProperties,
      }}
    />
  )
}
