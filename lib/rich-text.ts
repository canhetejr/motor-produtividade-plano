// Núcleo do texto rico: o schema do editor, o sanitizador e as conversões
// entre HTML e texto puro.
//
// A ideia central: **o sanitizador é o próprio schema do editor**. Em vez de
// manter um allowlist paralelo (que envelheceria em separado da barra de
// ferramentas), o HTML entra e sai por `generateJSON`/`generateHTML` do
// ProseMirror usando EXTENSOES. Tudo que o schema não sabe representar some no
// caminho: tag desconhecida, atributo não declarado (`onerror`), `<script>`.
// Não há como divergirem, porque são a mesma definição.
//
// Roda nos dois lados: `@tiptap/html` resolve para uma implementação de DOM
// própria no Node e usa o DOM real no browser. Isso importa porque comentários
// são gravados direto do browser (RLS permite), então a sanitização de leitura
// precisa funcionar no cliente.

import { generateHTML, generateJSON } from '@tiptap/html'
import { StarterKit } from '@tiptap/starter-kit'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import type { Extensions } from '@tiptap/core'
import { htmlParaTexto } from './rich-text-texto'

/** Protocolos aceitos em href. Fora daqui — `javascript:`, `data:` — cai fora. */
const PROTOCOLOS_LINK = ['http', 'https', 'mailto']

/**
 * O schema único, compartilhado por editor, viewer e sanitizador. Acrescentar
 * um botão na barra é acrescentar a extensão aqui; o sanitizador acompanha
 * sozinho.
 */
export const EXTENSOES: Extensions = [
  StarterKit.configure({
    link: {
      openOnClick: false,
      autolink: true,
      protocols: PROTOCOLOS_LINK,
      HTMLAttributes: {
        // Link em conteúdo escrito por outra pessoa: abre fora e não entrega
        // window.opener nem o referer.
        rel: 'noopener noreferrer nofollow',
        target: '_blank',
      },
    },
  }),
  TaskList,
  TaskItem.configure({ nested: true }),
]

// htmlVazio vive em rich-text-texto.ts: nao precisa do TipTap, e importa-lo
// daqui arrastava ProseMirror para todo chunk que so queria checar campo vazio.
// Reexportado para nao quebrar quem ja importava deste modulo.
export { htmlVazio } from './rich-text-texto'

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Texto puro → HTML, escapando tudo.
 *
 * É o conversor de toda origem que não passou pelo editor: descrição gravada
 * antes desta feature e — o caso que mais importa — as respostas do formulário
 * público, que vêm de visitante **deslogado** e nunca podem ser interpretadas
 * como marcação.
 */
export function textoParaHtml(texto: string | null | undefined): string {
  if (!texto || !texto.trim()) return ''
  return texto
    // Normalizar CRLF antes de dividir: descrição enviada de navegador Windows
    // chega com \r\n, e sem isto "\r\n\r\n" não casava como quebra de parágrafo
    // — virava um parágrafo só, com \r soltos no meio do texto. Há cards assim
    // no banco, vindos do formulário público.
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((paragrafo) => {
      const linhas = paragrafo.split('\n').map(escaparHtml).join('<br>')
      return `<p>${linhas}</p>`
    })
    .join('')
}

/**
 * HTML → texto puro.
 *
 * Existe por causa da busca do quadro (`kanban-board.tsx`), que faz
 * `includes(termo)` no conteúdo: sem tirar as tags, procurar por "p" casaria
 * com todo parágrafo do quadro.
 */
// Movida pra `./rich-text-texto` (zero deps) e re-exportada aqui, pra quem
// só precisa de texto puro não arrastar o ProseMirror pro bundle.
export { htmlParaTexto }

/** Heurística de leitura do legado: conteúdo gravado antes do editor é texto puro. */
export function ehHtml(valor: string | null | undefined): boolean {
  if (!valor) return false
  return /^\s*<(p|h[1-6]|ul|ol|blockquote|pre|div)\b/i.test(valor)
}

/**
 * Normaliza qualquer origem para HTML seguro de renderizar.
 *
 * Passa pelo schema do editor, então o resultado é sempre um subconjunto do
 * que a barra de ferramentas consegue produzir. Conteúdo inválido a ponto de
 * o parser falhar vira texto escapado em vez de derrubar a tela — uma
 * descrição estranha não pode quebrar o card.
 */
export function sanitizarHtml(valor: string | null | undefined): string {
  if (!valor || !valor.trim()) return ''
  if (!ehHtml(valor)) return textoParaHtml(valor)

  try {
    return generateHTML(generateJSON(valor, EXTENSOES), EXTENSOES)
  } catch (err) {
    console.error('Falha ao sanitizar HTML — caindo para texto puro:', err)
    return textoParaHtml(htmlParaTexto(valor))
  }
}
