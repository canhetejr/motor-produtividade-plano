'use client'

import { useMemo, useRef, useState } from 'react'
import { Braces, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  agruparVariaveis,
  inserirVariavel,
  segmentar,
  type DefinicaoVariavel,
} from '@/lib/variaveis'

// Campo de texto que aceita variáveis ({{titulo}}, {{alocados}}, …), com o
// menu "Inserir variável" e os tokens realçados como chips.
//
// COMO O REALCE FUNCIONA: o campo real (input/textarea) fica com o texto
// transparente e o cursor visível; atrás dele, um div desenha o MESMO texto
// com os tokens pintados. É a técnica clássica de "highlight overlay" — o
// navegador continua cuidando de seleção, undo, IME e rolagem, coisas que um
// contenteditable com nós customizados quebraria.
//
// A consequência prática: as duas camadas precisam medir igual. Fonte,
// tamanho, padding, borda e quebra de linha vêm das MESMAS classes
// (CLASSES_CAIXA + o par de classes de cada modo), e o chip não pode ter
// padding nem peso de fonte próprios — qualquer pixel a mais empurraria o
// texto seguinte e o realce sairia do lugar.

const CLASSES_CAIXA = 'w-full rounded-sm px-2.5 text-base leading-5 md:text-sm'
const CLASSES_LINHA_UNICA = 'h-8 py-1.5'
// scrollbar-gutter reserva o espaço da barra nas DUAS camadas: sem isso, o
// texto quebra em colunas de largura diferente assim que o textarea passa a
// rolar, e o realce descola exatamente quando o texto fica longo.
const CLASSES_MULTILINHA = 'min-h-16 py-2 [scrollbar-gutter:stable]'

export function CampoComVariaveis({
  valor,
  onChange,
  variaveis,
  multiline = false,
  rows,
  placeholder,
  id,
  className,
  type = 'text',
  disabled,
  rotuloBotao = 'Inserir variável',
  'aria-label': ariaLabel,
}: {
  valor: string
  onChange: (valor: string) => void
  variaveis: DefinicaoVariavel[]
  multiline?: boolean
  rows?: number
  placeholder?: string
  id?: string
  className?: string
  type?: string
  disabled?: boolean
  rotuloBotao?: string
  'aria-label'?: string
}) {
  // Um ref só para os dois modos: a união cobre tudo que é usado aqui
  // (focus, setSelectionRange, selectionStart, scrollTop).
  const campoRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null)
  const fundoRef = useRef<HTMLDivElement>(null)
  // Onde inserir quando o usuário escolhe a variável no menu: ao abrir o
  // popover o campo perde o foco, e com ele o selectionStart. `null` = o campo
  // nunca foi tocado nesta sessão — aí a variável vai para o FIM, e não para o
  // começo, que é o que faz sentido ao abrir uma automação já preenchida.
  const selecaoRef = useRef<{ inicio: number; fim: number } | null>(null)
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')

  const segmentos = useMemo(() => segmentar(valor ?? '', variaveis), [valor, variaveis])
  const desconhecidas = useMemo(
    () => [...new Set(segmentos.filter((s) => s.tipo === 'variavel' && !s.rotulo).map((s) => s.texto))],
    [segmentos]
  )

  const grupos = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const filtradas = termo
      ? variaveis.filter(
          (v) => v.rotulo.toLowerCase().includes(termo) || v.chave.includes(termo.replace(/\s+/g, '_'))
        )
      : variaveis
    return agruparVariaveis(filtradas)
  }, [variaveis, busca])

  function guardarSelecao() {
    const campo = campoRef.current
    if (!campo) return
    selecaoRef.current = {
      inicio: campo.selectionStart ?? valor.length,
      fim: campo.selectionEnd ?? valor.length,
    }
  }

  function escolher(chave: string) {
    const texto = valor ?? ''
    const { inicio, fim } = selecaoRef.current ?? { inicio: texto.length, fim: texto.length }
    const resultado = inserirVariavel(texto, inicio, fim, chave)
    onChange(resultado.texto)
    selecaoRef.current = { inicio: resultado.cursor, fim: resultado.cursor }
    setAberto(false)
    setBusca('')
    // Depois do fechamento: o popover devolve o foco ao gatilho, e só então
    // adianta pedir o foco de volta pro campo.
    setTimeout(() => {
      const campo = campoRef.current
      if (!campo) return
      campo.focus()
      campo.setSelectionRange(resultado.cursor, resultado.cursor)
    }, 0)
  }

  // Rolagem: o fundo não rola sozinho (não tem barra), então acompanha o campo.
  function sincronizarRolagem() {
    const campo = campoRef.current
    const fundo = fundoRef.current
    if (!campo || !fundo) return
    fundo.scrollTop = campo.scrollTop
    fundo.scrollLeft = campo.scrollLeft
  }

  const classesCampo = cn(
    CLASSES_CAIXA,
    multiline ? CLASSES_MULTILINHA : CLASSES_LINHA_UNICA,
    // Fundo transparente: quem pinta o fundo é a camada de baixo. Com
    // `dark:bg-input/30` aqui, o texto realçado ficaria atrás de um véu.
    'relative border border-input bg-transparent text-transparent caret-foreground transition-colors outline-none',
    'placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
    // Seleção translúcida de propósito: o texto selecionado mora na camada de
    // baixo, e um realce opaco o esconderia enquanto o usuário arrasta.
    'selection:bg-primary/25 disabled:cursor-not-allowed',
    multiline && 'resize-y',
    className
  )

  const classesFundo = cn(
    CLASSES_CAIXA,
    multiline ? CLASSES_MULTILINHA : CLASSES_LINHA_UNICA,
    'pointer-events-none absolute inset-0 overflow-hidden border border-transparent text-foreground dark:bg-input/30',
    multiline ? 'whitespace-pre-wrap break-words' : 'flex items-center whitespace-pre',
    className
  )

  return (
    <div className={cn('space-y-1', disabled && 'opacity-50')}>
      <div className="relative">
        <div ref={fundoRef} aria-hidden className={classesFundo}>
          {/* O <br> final mantém a última linha vazia com altura, igual ao
              textarea — sem ele o fundo encolhe e o chip da linha anterior
              some ao rolar. */}
          {segmentos.map((segmento, i) =>
            segmento.tipo === 'texto' ? (
              <span key={i}>{segmento.texto}</span>
            ) : (
              <span
                key={i}
                className={cn(
                  'rounded-[3px]',
                  segmento.rotulo ? 'bg-primary/20 text-primary' : 'bg-destructive/20 text-destructive'
                )}
                title={segmento.rotulo ?? 'Variável desconhecida'}
              >
                {segmento.texto}
              </span>
            )
          )}
          {multiline && <br />}
        </div>

        {multiline ? (
          <textarea
            ref={(el) => {
              campoRef.current = el
            }}
            id={id}
            aria-label={ariaLabel}
            value={valor}
            rows={rows}
            placeholder={placeholder}
            disabled={disabled}
            className={classesCampo}
            onChange={(e) => onChange(e.target.value)}
            onScroll={sincronizarRolagem}
            onSelect={guardarSelecao}
            onKeyUp={guardarSelecao}
            onClick={guardarSelecao}
            onBlur={guardarSelecao}
          />
        ) : (
          <input
            ref={(el) => {
              campoRef.current = el
            }}
            id={id}
            type={type}
            aria-label={ariaLabel}
            value={valor}
            placeholder={placeholder}
            disabled={disabled}
            className={classesCampo}
            onChange={(e) => onChange(e.target.value)}
            onScroll={sincronizarRolagem}
            onSelect={guardarSelecao}
            onKeyUp={guardarSelecao}
            onClick={guardarSelecao}
            onBlur={guardarSelecao}
          />
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <Popover open={aberto} onOpenChange={setAberto}>
          <PopoverTrigger
            // Explícito porque este campo também vive dentro de um <form> (o
            // builder de formulários): botão sem type dentro de form é submit,
            // e abrir o menu salvaria o formulário.
            type="button"
            disabled={disabled}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary/40 px-1.5 py-0.5 text-2xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
          >
            <Braces className="h-3 w-3" /> {rotuloBotao}
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 gap-0 p-0">
            <div className="flex items-center gap-1.5 border-b border-border px-2 py-1.5">
              <Search className="h-3 w-3 shrink-0 text-muted-foreground" />
              <input
                autoFocus
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar"
                className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div className="max-h-64 overflow-y-auto py-1 custom-scrollbar">
              {grupos.length === 0 && (
                <p className="px-2.5 py-3 text-center text-2xs text-muted-foreground">
                  Nenhuma variável com esse nome.
                </p>
              )}
              {grupos.map(({ grupo, itens }) => (
                <div key={grupo}>
                  <p className="px-2.5 pt-1.5 pb-0.5 text-3xs font-bold uppercase tracking-wider text-muted-foreground">
                    {grupo}
                  </p>
                  {itens.map((item) => (
                    <button
                      key={item.chave}
                      type="button"
                      onClick={() => escolher(item.chave)}
                      className="flex w-full flex-col items-start px-2.5 py-1 text-left hover:bg-secondary"
                    >
                      <span className="text-xs text-foreground">{item.rotulo}</span>
                      <span className="font-mono text-3xs text-muted-foreground">
                        {`{{${item.chave}}}`}
                        {item.nota ? ` — ${item.nota}` : ''}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {desconhecidas.length > 0 && (
          <span className="truncate text-2xs text-destructive" title={desconhecidas.join(' ')}>
            Não reconhecida: {desconhecidas.join(' ')}
          </span>
        )}
      </div>
    </div>
  )
}
