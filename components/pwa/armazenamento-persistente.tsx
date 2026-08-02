'use client'

import { useEffect } from 'react'

/**
 * Pede ao navegador que não descarte o armazenamento do app sob pressão de
 * memória.
 *
 * Sem isso o sistema pode limpar IndexedDB e caches quando o aparelho aperta —
 * o que hoje custaria a página offline, e passará a custar a fila de
 * apontamentos feitos sem rede quando ela existir. O pedido só é concedido se o
 * navegador já considerar o site "engajado" (instalado, com notificação
 * autorizada ou muito usado); negado, o app segue funcionando igual.
 */
export function ArmazenamentoPersistente() {
  useEffect(() => {
    if (!navigator.storage?.persist || !navigator.storage.persisted) return

    navigator.storage
      .persisted()
      .then((jaEPersistente) => {
        if (jaEPersistente) return
        return navigator.storage.persist().then(() => undefined)
      })
      .catch(() => {})
  }, [])

  return null
}
