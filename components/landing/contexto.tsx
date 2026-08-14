'use client'

import { createContext, useContext, useEffect, useRef } from 'react'
import { useMotionValue, type MotionValue } from 'framer-motion'

import { CAPACIDADE_INICIAL, type Capacidade } from '@/lib/landing/dispositivo'
import { motorRolagem } from '@/lib/landing/rolagem'

/**
 * O contexto que liga os capítulos do DOM ao mesmo relógio da cena 3D.
 *
 * Só o que não muda por quadro passa pelo React (a capacidade do aparelho).
 * O progresso da rolagem viaja por `MotionValue`, que atualiza estilo direto no
 * nó do DOM sem re-render — sessenta re-renders por segundo em uma árvore desta
 * altura seria exatamente o custo que a experiência não pode pagar.
 */

type Valor = {
  capacidade: Capacidade
}

const Contexto = createContext<Valor>({ capacidade: CAPACIDADE_INICIAL })

export const ProvedorExperiencia = Contexto.Provider
export const useExperiencia = () => useContext(Contexto)

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

/** Progresso global (0–1) da narrativa inteira. */
export function useProgressoGlobal(): MotionValue<number> {
  const valor = useMotionValue(0)
  useEffect(() => motorRolagem.assinar((e) => valor.set(e.global)), [valor])
  return valor
}
