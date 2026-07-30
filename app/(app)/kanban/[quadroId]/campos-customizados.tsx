'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ExternalLink } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { listarValoresCampos, salvarValorCampo } from '../actions-campos'
import type { CampoCustomizado, MembroQuadro } from './types'

// Renderiza os campos customizados do quadro na sidebar do card. A definição
// (nome/tipo/opções) vem do quadro; o valor é por card.
//
// Cada campo salva sozinho ao perder o foco ou ao mudar, em vez de entrar no
// formulário principal do card: os campos são dinâmicos, e amarrá-los ao
// `FormData` do form exigiria nomes gerados e um parse genérico do outro lado.

export function CamposCustomizados({
  cartaoId,
  quadroId,
  campos,
  membros,
  rotuloClasse,
}: {
  cartaoId: string
  quadroId: string
  campos: CampoCustomizado[]
  membros: MembroQuadro[]
  rotuloClasse: string
}) {
  const [valores, setValores] = useState<Record<string, unknown>>({})
  const [carregado, setCarregado] = useState(false)
  const [, startTransition] = useTransition()

  useEffect(() => {
    listarValoresCampos(cartaoId).then((r) => {
      if (r.ok) setValores(r.data ?? {})
      setCarregado(true)
    })
  }, [cartaoId])

  function salvar(campo: CampoCustomizado, valor: unknown) {
    const anterior = valores[campo.id]
    setValores((prev) => ({ ...prev, [campo.id]: valor }))

    startTransition(async () => {
      const result = await salvarValorCampo(cartaoId, campo.id, quadroId, valor)
      if (!result.ok) {
        toast.error(result.error)
        // Devolve o valor antigo: deixar na tela um valor que o servidor
        // recusou é pior do que reverter.
        setValores((prev) => ({ ...prev, [campo.id]: anterior }))
      }
    })
  }

  if (!carregado || campos.length === 0) return null

  return (
    <>
      {campos.map((campo) => (
        <div key={campo.id} className="space-y-1.5">
          <span className={rotuloClasse}>
            {campo.nome}
            {campo.obrigatorio && <span className="ml-0.5 text-destructive">*</span>}
          </span>
          <ControleCampo campo={campo} valor={valores[campo.id]} membros={membros} onSalvar={(v) => salvar(campo, v)} />
        </div>
      ))}
    </>
  )
}

function ControleCampo({
  campo,
  valor,
  membros,
  onSalvar,
}: {
  campo: CampoCustomizado
  valor: unknown
  membros: MembroQuadro[]
  onSalvar: (valor: unknown) => void
}) {
  const classeInput = 'h-9 bg-secondary/50 border-border rounded-lg text-xs'

  switch (campo.tipo) {
    case 'selecao':
      return (
        <Select value={typeof valor === 'string' ? valor : ''} onValueChange={(v) => onSalvar(v ?? '')}>
          <SelectTrigger className={`w-full ${classeInput}`}>
            <SelectValue placeholder="—">{(v: string) => v || '—'}</SelectValue>
          </SelectTrigger>
          <SelectContent className="rounded-lg border border-border">
            {campo.opcoes.map((opcao) => (
              <SelectItem key={opcao} value={opcao} className="text-xs cursor-pointer">
                {opcao}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )

    case 'pessoa':
      return (
        <Select value={typeof valor === 'string' ? valor : ''} onValueChange={(v) => onSalvar(v ?? '')}>
          <SelectTrigger className={`w-full ${classeInput}`}>
            <SelectValue placeholder="—">
              {(v: string) => membros.find((m) => m.id === v)?.nome ?? '—'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="rounded-lg border border-border">
            {membros.map((m) => (
              <SelectItem key={m.id} value={m.id} className="text-xs cursor-pointer">
                {m.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )

    case 'checkbox':
      return (
        <label className="flex h-9 items-center gap-2 rounded-lg border border-border bg-secondary/30 px-2.5 text-xs cursor-pointer">
          <Checkbox checked={valor === true} onCheckedChange={(v) => onSalvar(!!v)} />
          {valor === true ? 'Sim' : 'Não'}
        </label>
      )

    case 'url':
      return (
        <div className="flex items-center gap-1.5">
          <CampoTexto tipo="url" valor={valor} classe={classeInput} placeholder="https://…" onSalvar={onSalvar} />
          {typeof valor === 'string' && valor && (
            <a
              href={valor}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-muted-foreground hover:text-primary"
              title="Abrir link"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      )

    case 'numero':
      return <CampoTexto tipo="number" valor={valor} classe={classeInput} onSalvar={(v) => onSalvar(v === '' ? null : Number(v))} />

    case 'data':
      return <CampoTexto tipo="date" valor={valor} classe={classeInput} onSalvar={onSalvar} />

    default:
      return <CampoTexto tipo="text" valor={valor} classe={classeInput} onSalvar={onSalvar} />
  }
}

/**
 * Input controlado localmente que só avisa o pai no blur/Enter — salvar a cada
 * tecla dispararia uma Server Action por caractere.
 */
function CampoTexto({
  tipo,
  valor,
  classe,
  placeholder,
  onSalvar,
}: {
  tipo: string
  valor: unknown
  classe: string
  placeholder?: string
  onSalvar: (valor: string) => void
}) {
  const valorExterno = valor === null || valor === undefined ? '' : String(valor)
  const [rascunho, setRascunho] = useState(valorExterno)
  const [ultimoExterno, setUltimoExterno] = useState(valorExterno)

  // Ajuste durante o render (padrão do React) em vez de useEffect: quando o
  // pai reverte por erro do servidor, o input precisa acompanhar.
  if (valorExterno !== ultimoExterno) {
    setUltimoExterno(valorExterno)
    setRascunho(valorExterno)
  }

  return (
    <Input
      type={tipo}
      value={rascunho}
      placeholder={placeholder}
      onChange={(e) => setRascunho(e.target.value)}
      onBlur={() => {
        if (rascunho !== valorExterno) onSalvar(rascunho)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          e.currentTarget.blur()
        }
        if (e.key === 'Escape') setRascunho(valorExterno)
      }}
      className={`flex-1 ${classe}`}
    />
  )
}
