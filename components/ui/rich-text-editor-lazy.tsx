'use client'

import dynamic from 'next/dynamic'

/**
 * O editor, carregado sob demanda e num chunk só.
 *
 * O `RichTextEditor` puxa ProseMirror e TipTap (~400 KB). Ele era importado
 * estaticamente por três telas, duas das quais já são `next/dynamic` — e o
 * empacotador colocava uma cópia inteira do editor em CADA um desses chunks.
 * Medido: dois chunks de 400 KB carregando o mesmo ProseMirror.
 *
 * Envolvendo o editor no próprio `dynamic`, ele vira um chunk compartilhado:
 * baixado uma vez, na primeira tela que precisar dele.
 *
 * `ssr: false` porque o editor monta contra o DOM. O placeholder tem a mesma
 * altura mínima do editor real para a caixa não pular quando ele chega.
 */
export const RichTextEditorLazy = dynamic(
  () => import('./rich-text-editor').then((m) => m.RichTextEditor),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-24 animate-pulse rounded-md border border-border bg-secondary/30" />
    ),
  }
)
