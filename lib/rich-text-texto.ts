// Extração de texto puro a partir de HTML — sem nenhuma dependência.
//
// Vive num módulo separado de `lib/rich-text.ts` de propósito: aquele importa
// `@tiptap/html` + StarterKit no topo (o schema é o sanitizador), então
// qualquer client component que só precisasse desta função arrastava o
// ProseMirror inteiro pro bundle. O filtro de busca do Kanban é exatamente
// esse caso.
//
// `lib/rich-text.ts` re-exporta daqui, então nada que já importava de lá muda.

export function htmlParaTexto(html: string | null | undefined): string {
  if (!html) return ''
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|blockquote|tr)>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // `&amp;` por último: desfazer antes recriaria entidades a partir de texto
    // que era literal ("&amp;lt;" viraria "<").
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}
