'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { listarCamposQuadro, criarCampoQuadro, excluirCampoQuadro } from '../actions-campos'
import type { CampoCustomizado } from './types'
import type { TipoCampoCustomizado } from '@/lib/database.types'

const TIPOS: { valor: TipoCampoCustomizado; rotulo: string }[] = [
  { valor: 'texto', rotulo: 'Texto' },
  { valor: 'numero', rotulo: 'Número' },
  { valor: 'data', rotulo: 'Data' },
  { valor: 'selecao', rotulo: 'Seleção' },
  { valor: 'pessoa', rotulo: 'Pessoa' },
  { valor: 'checkbox', rotulo: 'Sim/Não' },
  { valor: 'url', rotulo: 'Link' },
]

export function CamposManager({
  aberto,
  quadroId,
  onClose,
  onAlterado,
}: {
  aberto: boolean
  quadroId: string
  onClose: () => void
  onAlterado: () => void
}) {
  const [campos, setCampos] = useState<CampoCustomizado[]>([])
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<TipoCampoCustomizado>('texto')
  const [opcoesTexto, setOpcoesTexto] = useState('')
  const [obrigatorio, setObrigatorio] = useState(false)
  const [campoParaExcluir, setCampoParaExcluir] = useState<CampoCustomizado | null>(null)
  const [isPending, startTransition] = useTransition()

  function recarregar() {
    listarCamposQuadro(quadroId).then((r) => {
      if (r.ok) setCampos(r.data ?? [])
    })
  }

  useEffect(() => {
    if (aberto) recarregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, quadroId])

  function handleCriar() {
    if (!nome.trim()) return
    // Uma opção por linha: mais fácil de colar de uma planilha do que CSV.
    const opcoes = opcoesTexto.split('\n').map((o) => o.trim()).filter(Boolean)

    startTransition(async () => {
      const result = await criarCampoQuadro(quadroId, { nome: nome.trim(), tipo, opcoes, obrigatorio })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setNome('')
      setOpcoesTexto('')
      setObrigatorio(false)
      recarregar()
      onAlterado()
      toast.success('Campo criado.')
    })
  }

  function handleExcluir(campo: CampoCustomizado) {
    // Confirmação já aconteceu no AlertDialog controlado por
    // campoParaExcluir — este handler executa a decisão tomada.
    setCampos((prev) => prev.filter((c) => c.id !== campo.id))
    startTransition(async () => {
      const result = await excluirCampoQuadro(campo.id, quadroId)
      if (!result.ok) {
        toast.error(result.error)
        recarregar()
        return
      }
      onAlterado()
    })
  }

  return (
    <>
    <Dialog open={aberto} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85dvh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-primary" /> Campos do quadro
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Campos extras que aparecem em todo card deste quadro. As automações podem lê-los e alterá-los.
        </p>

        <div className="flex-1 space-y-2 overflow-y-auto custom-scrollbar">
          {campos.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border py-6 text-center text-xs italic text-muted-foreground">
              Nenhum campo customizado ainda.
            </p>
          ) : (
            campos.map((campo) => (
              <div key={campo.id} className="group flex items-center justify-between gap-2 rounded-lg border border-border bg-secondary/20 px-3 py-2 text-xs">
                <div className="min-w-0">
                  <span className="font-semibold text-foreground">{campo.nome}</span>
                  {campo.obrigatorio && <span className="ml-1 text-destructive">*</span>}
                  <span className="ml-2 text-muted-foreground">
                    {TIPOS.find((t) => t.valor === campo.tipo)?.rotulo ?? campo.tipo}
                    {campo.tipo === 'selecao' && campo.opcoes.length > 0 && ` · ${campo.opcoes.length} opções`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setCampoParaExcluir(campo)}
                  className="shrink-0 text-muted-foreground max-md:opacity-100 focus-within:opacity-100 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  aria-label={`Excluir campo ${campo.nome}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="space-y-2 rounded-md border border-border bg-secondary/20 p-3">
          <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">Novo campo</span>
          <div className="flex gap-2">
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Período de Oferta"
              className="h-8 flex-1 text-xs"
            />
            <Select value={tipo} onValueChange={(v) => setTipo((v as TipoCampoCustomizado) ?? 'texto')}>
              <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => (
                  <SelectItem key={t.valor} value={t.valor} className="cursor-pointer text-xs">{t.rotulo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {tipo === 'selecao' && (
            <div className="space-y-1">
              <Label htmlFor="campo-opcoes" className="text-2xs">Opções (uma por linha)</Label>
              <textarea
                id="campo-opcoes"
                value={opcoesTexto}
                onChange={(e) => setOpcoesTexto(e.target.value)}
                rows={3}
                placeholder={'26.1\n26.2'}
                className="w-full rounded-lg border border-border bg-card p-2 text-xs outline-none focus:border-primary"
              />
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-2xs cursor-pointer">
              <Checkbox checked={obrigatorio} onCheckedChange={(v) => setObrigatorio(!!v)} />
              Obrigatório
            </label>
            <Button size="sm" onClick={handleCriar} disabled={isPending || !nome.trim()} className="h-8 text-xs">
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </Button>
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            <X className="h-3.5 w-3.5" /> Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <AlertDialog open={!!campoParaExcluir} onOpenChange={(v) => !v && setCampoParaExcluir(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir o campo &ldquo;{campoParaExcluir?.nome}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            O que já foi preenchido nele em todos os cards será apagado. Essa ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button variant="outline">Cancelar</Button>} />
          <AlertDialogClose
            render={
              <Button variant="destructive" onClick={() => campoParaExcluir && handleExcluir(campoParaExcluir)}>
                Excluir campo
              </Button>
            }
          />
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
