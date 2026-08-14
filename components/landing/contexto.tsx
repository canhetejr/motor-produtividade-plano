'use client'

import { useEffect, useRef } from 'react'
import { useMotionValue } from 'framer-motion'

import { motorRolagem } from '@/lib/landing/rolagem'

/**
 * A ponte entre os capítulos do DOM e o relógio da rolagem.
 *
 * Nada de estado do React aqui: o progresso viaja por `MotionValue`, que
 * atualiza o estilo direto no nó do DOM. Sessenta re-renders por segundo numa
 * árvore desta altura é exatamente o custo que a experiência não pode pagar.
 */

/**
 * Registra um capítulo e devolve os dois relógios dele.
 *
 * `visivel` é o que quase todo componente de conteúdo quer: vai de 0 quando o
 * bloco entra pela base da tela a 1 quando ele sai pelo topo. É o relógio que
 * acompanha a leitura.
 *
 * `bruto` só começa a andar quando o topo da seção cruza o topo da tela, e
 * existe para ficar sincronizado com a cena 3D — o conteúdo é `sticky`, então
 * ele fica legível uma tela inteira antes de `bruto` sair de zero. Use `bruto`
 * apenas para o que precisa estar em fase com a geometria (a saída em
 * profundidade, por exemplo); use `visivel` para revelar dado.
 */
export function useCapitulo(indice: number, abrange = 1) {
  const ref = useRef<HTMLElement>(null)
  const bruto = useMotionValue(0)
  const visivel = useMotionValue(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    return motorRolagem.registrar(indice, el, abrange, (e) => {
      bruto.set(e.local)
      visivel.set(e.visivel)
    })
  }, [indice, abrange, bruto, visivel])

  return { ref, bruto, visivel }
}
