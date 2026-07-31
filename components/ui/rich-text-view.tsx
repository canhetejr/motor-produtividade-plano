'use client'

import { useMemo } from 'react'
import { sanitizarHtml } from '@/lib/rich-text'
import { cn } from '@/lib/utils'

/**
 * Renderiza conteúdo rico já gravado.
 *
 * **Sanitiza por dentro, sempre.** A RLS deste projeto permite INSERT direto em
 * `comentarios_cartao` pelo browser, e o formulário público grava descrição a
 * partir de visitante deslogado — confiar no que está no banco não é opção.
 * Deixar a sanitização aqui, e não em cada chamador, torna impossível um call
 * site novo esquecer dela.
 *
 * Aceita texto puro também: conteúdo gravado antes do editor vira parágrafos
 * escapados (ver `sanitizarHtml`).
 */
export function RichTextView({
  html,
  className,
}: {
  html: string | null | undefined
  className?: string
}) {
  // Memo porque um card pode listar dezenas de comentários, e cada sanitização
  // é um parse de ProseMirror.
  const seguro = useMemo(() => sanitizarHtml(html), [html])

  if (!seguro) return null

  return (
    <div
      className={cn('prosa', className)}
      // Seguro por construção: `seguro` é sempre saída do schema do editor.
      dangerouslySetInnerHTML={{ __html: seguro }}
    />
  )
}
