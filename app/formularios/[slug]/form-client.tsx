'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { submeterFormulario } from '@/app/(app)/kanban/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CheckCircle2, Loader2 } from 'lucide-react'

type Campo = {
  id: string
  rotulo: string
  tipo: string
  placeholder: string
  obrigatorio: boolean
  opcoes: string[]
}

export function FormClient({
  slug,
  campos,
  mensagemSucesso,
  mostrarMarca,
}: {
  slug: string
  campos: Campo[]
  mensagemSucesso: string
  mostrarMarca: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [respostas, setRespostas] = useState<Record<string, string>>({})
  const [enviado, setEnviado] = useState(false)

  function setResposta(campoId: string, valor: string) {
    setRespostas((prev) => ({ ...prev, [campoId]: valor }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await submeterFormulario(slug, respostas)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setEnviado(true)
    })
  }

  if (enviado) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center text-success">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <p className="text-sm text-foreground">{mensagemSucesso}</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {campos.map((campo) => (
        <div key={campo.id} className="space-y-2">
          <Label htmlFor={`campo-${campo.id}`}>
            {campo.rotulo} {campo.obrigatorio && <span className="text-destructive">*</span>}
          </Label>

          {campo.tipo === 'texto_longo' ? (
            <Textarea
              id={`campo-${campo.id}`}
              value={respostas[campo.id] ?? ''}
              onChange={(e) => setResposta(campo.id, e.target.value)}
              placeholder={campo.placeholder}
              required={campo.obrigatorio}
              rows={4}
            />
          ) : campo.tipo === 'selecao' ? (
            <Select value={respostas[campo.id] ?? ''} onValueChange={(v) => setResposta(campo.id, v ?? '')}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {campo.opcoes.map((opcao) => (
                  <SelectItem key={opcao} value={opcao}>{opcao}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : campo.tipo === 'prioridade' ? (
            <Select value={respostas[campo.id] ?? ''} onValueChange={(v) => setResposta(campo.id, v ?? '')}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="baixa">Baixa</SelectItem>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
              </SelectContent>
            </Select>
          ) : campo.tipo === 'data' ? (
            <Input
              id={`campo-${campo.id}`}
              type="date"
              value={respostas[campo.id] ?? ''}
              onChange={(e) => setResposta(campo.id, e.target.value)}
              required={campo.obrigatorio}
            />
          ) : (
            <Input
              id={`campo-${campo.id}`}
              value={respostas[campo.id] ?? ''}
              onChange={(e) => setResposta(campo.id, e.target.value)}
              placeholder={campo.placeholder}
              required={campo.obrigatorio}
            />
          )}
        </div>
      ))}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar'}
      </Button>

      {mostrarMarca && (
        <p className="text-center text-[11px] text-muted-foreground pt-2">
          Powered by Vértice
        </p>
      )}
    </form>
  )
}
