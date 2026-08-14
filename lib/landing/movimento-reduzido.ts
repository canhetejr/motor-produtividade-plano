'use client'

import { useSyncExternalStore } from 'react'

/**
 * Preferência de movimento reduzido, sem quebrar a hidratação.
 *
 * Por que não `useReducedMotion()` do Motion: aquele hook lê a media query num
 * `useState` inicial. Como o servidor não tem media query nenhuma, o HTML sai
 * sempre como "movimento normal" e o cliente já hidrata como "reduzido" — os
 * dois renders divergem, e o React acusa erro de hidratação em todo número e
 * toda barra cujo texto depende da preferência. (Ele também nunca reage a uma
 * mudança da preferência depois do primeiro render; o próprio código dele traz
 * um TODO sobre isso.)
 *
 * `useSyncExternalStore` existe exatamente para este caso: o terceiro argumento
 * é o retrato do servidor. O React hidrata com ele, percebe que o valor do
 * cliente é outro e re-renderiza — sem divergência e sem `setState` dentro de
 * efeito. É o mesmo padrão que `components/fundo-particulas.tsx` já usa para
 * esta mesma preferência.
 */

const CONSULTA = '(prefers-reduced-motion: reduce)'

function assinar(callback: () => void) {
  const mq = window.matchMedia(CONSULTA)
  mq.addEventListener('change', callback)
  return () => mq.removeEventListener('change', callback)
}

function ler() {
  return window.matchMedia(CONSULTA).matches
}

/** No servidor assume movimento normal — é o único palpite possível, e é o que
 *  mantém o HTML entregue igual para todo mundo (e cacheável). */
const NO_SERVIDOR = () => false

export function useMovimentoReduzido(): boolean {
  return useSyncExternalStore(assinar, ler, NO_SERVIDOR)
}
