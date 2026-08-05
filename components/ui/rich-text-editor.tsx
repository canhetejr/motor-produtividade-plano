'use client'

import { useEffect, useState } from 'react'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import { Placeholder } from '@tiptap/extensions'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Code,
  Link as LinkIcon,
  Unlink,
  Undo2,
  Redo2,
} from 'lucide-react'
import { EXTENSOES, ehHtml, textoParaHtml } from '@/lib/rich-text'
import { cn } from '@/lib/utils'

function BotaoBarra({
  ativo,
  onClick,
  titulo,
  children,
  desabilitado,
}: {
  ativo?: boolean
  onClick: () => void
  titulo: string
  children: React.ReactNode
  desabilitado?: boolean
}) {
  return (
    <button
      type="button"
      // Sem isto o clique tira o foco do editor e a seleção some antes do
      // comando rodar — o formato seria aplicado "no nada".
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={desabilitado}
      aria-pressed={ativo}
      aria-label={titulo}
      title={titulo}
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors disabled:opacity-40 disabled:pointer-events-none',
        ativo
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      {children}
    </button>
  )
}

function Separador() {
  return <span className="mx-0.5 h-5 w-px bg-border" aria-hidden="true" />
}

function Barra({ editor }: { editor: Editor }) {
  const definirLink = () => {
    const atual = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('Endereço do link:', atual ?? 'https://')
    if (url === null) return
    if (url.trim() === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    // `protocols` em EXTENSOES já recusa javascript:/data:; o setLink apenas
    // não aplica quando a URL não passa na validação do schema.
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-secondary/40 px-2 py-1.5">
      <BotaoBarra
        titulo="Desfazer"
        onClick={() => editor.chain().focus().undo().run()}
        desabilitado={!editor.can().undo()}
      >
        <Undo2 className="h-3.5 w-3.5" />
      </BotaoBarra>
      <BotaoBarra
        titulo="Refazer"
        onClick={() => editor.chain().focus().redo().run()}
        desabilitado={!editor.can().redo()}
      >
        <Redo2 className="h-3.5 w-3.5" />
      </BotaoBarra>

      <Separador />

      <BotaoBarra
        titulo="Título grande"
        ativo={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading1 className="h-3.5 w-3.5" />
      </BotaoBarra>
      <BotaoBarra
        titulo="Título pequeno"
        ativo={editor.isActive('heading', { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading2 className="h-3.5 w-3.5" />
      </BotaoBarra>

      <Separador />

      <BotaoBarra
        titulo="Negrito"
        ativo={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-3.5 w-3.5" />
      </BotaoBarra>
      <BotaoBarra
        titulo="Itálico"
        ativo={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-3.5 w-3.5" />
      </BotaoBarra>
      <BotaoBarra
        titulo="Sublinhado"
        ativo={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon className="h-3.5 w-3.5" />
      </BotaoBarra>
      <BotaoBarra
        titulo="Riscado"
        ativo={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="h-3.5 w-3.5" />
      </BotaoBarra>

      <Separador />

      <BotaoBarra
        titulo="Lista com marcadores"
        ativo={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-3.5 w-3.5" />
      </BotaoBarra>
      <BotaoBarra
        titulo="Lista numerada"
        ativo={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </BotaoBarra>
      <BotaoBarra
        titulo="Checklist"
        ativo={editor.isActive('taskList')}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
      >
        <ListChecks className="h-3.5 w-3.5" />
      </BotaoBarra>

      <Separador />

      <BotaoBarra
        titulo="Citação"
        ativo={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="h-3.5 w-3.5" />
      </BotaoBarra>
      <BotaoBarra
        titulo="Código"
        ativo={editor.isActive('codeBlock')}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <Code className="h-3.5 w-3.5" />
      </BotaoBarra>

      <Separador />

      <BotaoBarra titulo="Inserir link" ativo={editor.isActive('link')} onClick={definirLink}>
        <LinkIcon className="h-3.5 w-3.5" />
      </BotaoBarra>
      <BotaoBarra
        titulo="Remover link"
        onClick={() => editor.chain().focus().unsetLink().run()}
        desabilitado={!editor.isActive('link')}
      >
        <Unlink className="h-3.5 w-3.5" />
      </BotaoBarra>
    </div>
  )
}

/**
 * Editor de texto rico.
 *
 * Controlado por callback (`onChange`), não por prop `value`: reescrever o
 * documento a cada tecla faria o ProseMirror perder a posição do cursor.
 * `conteudoInicial` só é lido na montagem e quando muda de card (`key`).
 *
 * Para formulários que usam `FormData`, passe `name` — o componente mantém um
 * `<input type="hidden">` sincronizado, já que um editor não é campo nativo.
 */
export function RichTextEditor({
  conteudoInicial,
  onChange,
  name,
  placeholder,
  minHeight = 'min-h-40',
  editavel = true,
  className,
}: {
  conteudoInicial?: string | null
  onChange?: (html: string) => void
  name?: string
  placeholder?: string
  minHeight?: string
  editavel?: boolean
  className?: string
}) {
  // Conteúdo antigo é texto puro com \n; jogá-lo direto no editor viraria um
  // parágrafo só, com as quebras perdidas.
  const inicial = ehHtml(conteudoInicial) ? conteudoInicial! : textoParaHtml(conteudoInicial)
  const [html, setHtml] = useState(inicial)

  const editor = useEditor({
    // Placeholder fica fora de EXTENSOES de propósito: é só apresentação e não
    // pode participar do schema que sanitiza conteúdo gravado.
    extensions: placeholder ? [...EXTENSOES, Placeholder.configure({ placeholder })] : EXTENSOES,
    content: inicial,
    editable: editavel,
    // O editor monta no cliente; sem isto o React acusa hidratação divergente.
    immediatelyRender: false,
    editorProps: {
      attributes: { class: cn('prosa focus:outline-none px-3 py-2.5', minHeight) },
    },
    onUpdate: ({ editor }) => {
      const novo = editor.getHTML()
      setHtml(novo)
      onChange?.(novo)
    },
  })

  useEffect(() => {
    if (editor && editor.isEditable !== editavel) editor.setEditable(editavel)
  }, [editor, editavel])

  if (!editor) {
    return (
      <div
        className={cn('rounded-md border border-border bg-secondary/30 animate-pulse', minHeight, className)}
        aria-hidden="true"
      />
    )
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-md border border-border bg-secondary/30 focus-within:border-primary transition-colors',
        className
      )}
    >
      {editavel && <Barra editor={editor} />}
      <EditorContent editor={editor} />
      {name && <input type="hidden" name={name} value={html} />}
    </div>
  )
}
