'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { criarFormulario, atualizarFormulario, type CampoFormularioInput } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import type { Coluna, Formulario } from './types'
import type { TipoCampoFormulario, MapeamentoCampoFormulario } from '@/lib/database.types'

const TIPO_LABEL: Record<TipoCampoFormulario, string> = {
  texto: 'Texto curto',
  texto_longo: 'Texto longo',
  selecao: 'Seleção',
  data: 'Data',
  prioridade: 'Prioridade',
}

const MAPEAMENTO_LABEL: Record<MapeamentoCampoFormulario, string> = {
  titulo: 'Título do card',
  descricao: 'Descrição do card',
  prazo: 'Prazo do card',
  prioridade: 'Prioridade do card',
  personalizado: 'Só aparece na descrição',
}

type CampoLocal = CampoFormularioInput & { localId: string }

function novoCampoLocal(): CampoLocal {
  return {
    localId: crypto.randomUUID(),
    rotulo: '',
    tipo: 'texto',
    placeholder: '',
    obrigatorio: false,
    opcoes: [],
    mapeado_para: 'personalizado',
  }
}

export function FormularioBuilderDialog({
  open,
  onOpenChange,
  quadroId,
  colunas,
  formulario,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  quadroId: string
  colunas: Coluna[]
  formulario: Formulario | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{formulario ? 'Editar Formulário' : 'Novo Formulário'}</DialogTitle>
        </DialogHeader>
        <FormularioBuilderForm
          key={formulario?.id ?? 'novo'}
          quadroId={quadroId}
          colunas={colunas}
          formulario={formulario}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function FormularioBuilderForm({
  quadroId,
  colunas,
  formulario,
  onClose,
}: {
  quadroId: string
  colunas: Coluna[]
  formulario: Formulario | null
  onClose: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [titulo, setTitulo] = useState(formulario?.titulo ?? '')
  const [descricao, setDescricao] = useState(formulario?.descricao ?? '')
  const [slug, setSlug] = useState(formulario?.slug ?? '')
  const [colunaId, setColunaId] = useState(formulario?.coluna_id ?? colunas[0]?.id ?? '')
  const [mensagemSucesso, setMensagemSucesso] = useState(
    formulario?.mensagem_sucesso ?? 'Recebemos sua solicitação — um card já foi criado no nosso quadro.'
  )
  const [campos, setCampos] = useState<CampoLocal[]>(
    formulario ? formulario.campos.map((c) => ({ ...c, localId: c.id })) : [novoCampoLocal()]
  )

  function atualizarCampo(localId: string, patch: Partial<CampoLocal>) {
    setCampos((prev) => prev.map((c) => (c.localId === localId ? { ...c, ...patch } : c)))
  }

  function removerCampo(localId: string) {
    setCampos((prev) => prev.filter((c) => c.localId !== localId))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!colunaId) {
      toast.error('Selecione a coluna de destino.')
      return
    }
    if (campos.length === 0) {
      toast.error('Adicione pelo menos um campo.')
      return
    }

    const dados = {
      coluna_id: colunaId,
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      slug: slug.trim(),
      cor_tema: '#006652',
      mensagem_sucesso: mensagemSucesso.trim(),
      mostrar_marca: true,
      campos: campos.map(({ localId, ...campo }) => { void localId; return campo }),
    }

    startTransition(async () => {
      const result = formulario ? await atualizarFormulario(formulario.id, quadroId, dados) : await criarFormulario(quadroId, dados)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(formulario ? 'Formulário atualizado!' : 'Formulário criado!')
      onClose()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="formulario-titulo">Título</Label>
          <Input id="formulario-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} required placeholder="Ex: Solicitar suporte" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="formulario-slug">Link (parte final da URL)</Label>
          <Input
            id="formulario-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
            required
            placeholder="suporte-ti"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="formulario-descricao">Descrição (opcional, aparece pro visitante)</Label>
        <Textarea id="formulario-descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Coluna de destino do card</Label>
          <Select value={colunaId} onValueChange={(v) => setColunaId(v ?? '')}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {colunas.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="formulario-mensagem">Mensagem de sucesso</Label>
          <Input id="formulario-mensagem" value={mensagemSucesso} onChange={(e) => setMensagemSucesso(e.target.value)} required />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Campos do formulário</Label>
          <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => setCampos((prev) => [...prev, novoCampoLocal()])}>
            <Plus className="h-3.5 w-3.5" /> Adicionar campo
          </Button>
        </div>

        <div className="space-y-3">
          {campos.map((campo, index) => (
            <div key={campo.localId} className="rounded-lg border border-border p-3 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-muted-foreground w-5 shrink-0">{index + 1}.</span>
                <Input
                  value={campo.rotulo}
                  onChange={(e) => atualizarCampo(campo.localId, { rotulo: e.target.value })}
                  placeholder="Rótulo do campo"
                  required
                  className="flex-1"
                />
                <Button type="button" size="icon-sm" variant="ghost" className="text-muted-foreground hover:text-destructive shrink-0" onClick={() => removerCampo(campo.localId)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pl-7">
                <Select value={campo.tipo} onValueChange={(v) => atualizarCampo(campo.localId, { tipo: (v as TipoCampoFormulario) ?? 'texto' })}>
                  <SelectTrigger className="h-8 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TIPO_LABEL) as TipoCampoFormulario[]).map((t) => (
                      <SelectItem key={t} value={t}>{TIPO_LABEL[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={campo.mapeado_para} onValueChange={(v) => atualizarCampo(campo.localId, { mapeado_para: (v as MapeamentoCampoFormulario) ?? 'personalizado' })}>
                  <SelectTrigger className="h-8 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(MAPEAMENTO_LABEL) as MapeamentoCampoFormulario[]).map((m) => (
                      <SelectItem key={m} value={m}>{MAPEAMENTO_LABEL[m]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <label className="flex items-center gap-2 text-xs px-1">
                  <Checkbox checked={campo.obrigatorio} onCheckedChange={(checked) => atualizarCampo(campo.localId, { obrigatorio: !!checked })} />
                  Obrigatório
                </label>
              </div>

              {campo.tipo === 'texto' || campo.tipo === 'texto_longo' ? (
                <div className="pl-7">
                  <Input
                    value={campo.placeholder}
                    onChange={(e) => atualizarCampo(campo.localId, { placeholder: e.target.value })}
                    placeholder="Placeholder (opcional)"
                    className="h-8"
                  />
                </div>
              ) : campo.tipo === 'selecao' ? (
                <div className="pl-7">
                  <Input
                    value={campo.opcoes.join(', ')}
                    onChange={(e) => atualizarCampo(campo.localId, { opcoes: e.target.value.split(',').map((o) => o.trim()).filter(Boolean) })}
                    placeholder="Opções separadas por vírgula"
                    className="h-8"
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : formulario ? 'Salvar Alterações' : 'Criar Formulário'}
      </Button>
    </form>
  )
}
