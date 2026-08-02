'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Check, AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { createApontamento } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MOTIVOS_OUTROS } from '@/lib/motivos-outros'
import { cn } from '@/lib/utils'

type Demanda = {
  id: string
  nome: string
  variavel: boolean
  tempo_padrao_min: number | null
  blocos_totais: number
}

type Situacao = 'rascunho' | 'enviando' | 'enviado' | 'erro'

type Linha = {
  id: string
  demandaId: string
  quantidade: string
  tempoManual: string
  motivo: string
  observacoes: string
  situacao: Situacao
  erro?: string
}

function novaLinha(): Linha {
  return {
    id: crypto.randomUUID(),
    demandaId: '',
    quantidade: '1',
    tempoManual: '',
    motivo: '',
    observacoes: '',
    situacao: 'rascunho',
  }
}

export function LoteForm({ demandas }: { demandas: Demanda[]; usuarioId: string }) {
  const router = useRouter()
  const [linhas, setLinhas] = useState<Linha[]>([novaLinha()])
  const [enviando, setEnviando] = useState(false)

  function alterar(id: string, mudanca: Partial<Linha>) {
    setLinhas((prev) =>
      prev.map((l) =>
        // Editar depois de um erro devolve a linha para rascunho: manter o
        // vermelho depois da correção sugere que o problema continua.
        l.id === id ? { ...l, ...mudanca, situacao: l.situacao === 'erro' ? 'rascunho' : l.situacao } : l
      )
    )
  }

  const pendentes = linhas.filter((l) => l.situacao !== 'enviado')
  const prontas = pendentes.filter((l) => l.demandaId && Number(l.quantidade) > 0)

  async function enviar() {
    if (prontas.length === 0) return
    setEnviando(true)

    // Em série: a RPC valida teto de blocos acumulado por demanda, e paralelo
    // deixaria duas linhas da mesma demanda passarem juntas pelo limite.
    for (const linha of prontas) {
      setLinhas((prev) => prev.map((l) => (l.id === linha.id ? { ...l, situacao: 'enviando' } : l)))

      const formData = new FormData()
      formData.set('demanda_id', linha.demandaId)
      formData.set('quantidade', linha.quantidade)
      if (linha.tempoManual) formData.set('tempo_manual_min', linha.tempoManual)
      if (linha.motivo) formData.set('motivo', linha.motivo)
      if (linha.observacoes) formData.set('observacoes', linha.observacoes)

      try {
        const resultado = await createApontamento(formData)
        setLinhas((prev) =>
          prev.map((l) =>
            l.id === linha.id
              ? resultado.ok
                ? { ...l, situacao: 'enviado' as Situacao, erro: undefined }
                : { ...l, situacao: 'erro' as Situacao, erro: resultado.error }
              : l
          )
        )
      } catch {
        setLinhas((prev) =>
          prev.map((l) =>
            l.id === linha.id
              ? { ...l, situacao: 'erro' as Situacao, erro: 'Sem conexão. Tente de novo.' }
              : l
          )
        )
      }
    }

    setEnviando(false)
  }

  // Recalculado após o envio: o estado das linhas já mudou.
  const enviados = linhas.filter((l) => l.situacao === 'enviado').length
  const comErro = linhas.filter((l) => l.situacao === 'erro').length

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {linhas.map((linha, i) => {
          const demanda = demandas.find((d) => d.id === linha.demandaId)
          const enviado = linha.situacao === 'enviado'
          return (
            <li
              key={linha.id}
              className={cn(
                'rounded-xl border p-3 transition-colors',
                enviado && 'border-emerald-500/40 bg-emerald-500/5',
                linha.situacao === 'erro' && 'border-danger/40 bg-danger/5',
                linha.situacao === 'rascunho' && 'border-border bg-card'
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-2xs font-bold uppercase tracking-wide text-muted-foreground">
                  Linha {i + 1}
                </span>
                <span className="flex items-center gap-2">
                  {linha.situacao === 'enviando' && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  )}
                  {enviado && (
                    <span className="flex items-center gap-1 text-2xs font-bold text-emerald-600 dark:text-emerald-400">
                      <Check className="h-3.5 w-3.5" /> Registrado
                    </span>
                  )}
                  {linhas.length > 1 && !enviado && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Remover linha ${i + 1}`}
                      onClick={() => setLinhas((prev) => prev.filter((l) => l.id !== linha.id))}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </span>
              </div>

              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <div className="grid gap-1.5">
                  <Label htmlFor={`demanda-${linha.id}`} className="text-xs">
                    Demanda
                  </Label>
                  <select
                    id={`demanda-${linha.id}`}
                    value={linha.demandaId}
                    disabled={enviado}
                    onChange={(e) => alterar(linha.id, { demandaId: e.target.value })}
                    className="h-10 w-full rounded-md border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 dark:bg-input/30"
                  >
                    <option value="">Selecione…</option>
                    {demandas.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-1.5 sm:w-28">
                  <Label htmlFor={`qtd-${linha.id}`} className="text-xs">
                    Quantidade
                  </Label>
                  <Input
                    id={`qtd-${linha.id}`}
                    type="number"
                    min={1}
                    value={linha.quantidade}
                    disabled={enviado}
                    onChange={(e) => alterar(linha.id, { quantidade: e.target.value })}
                    className="h-10 text-base md:text-sm"
                  />
                </div>
              </div>

              {/* Demanda variável exige tempo e motivo — as mesmas regras da
                  tela avulsa, checadas de novo pela RPC no servidor. */}
              {demanda?.variavel && !enviado && (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor={`tempo-${linha.id}`} className="text-xs">
                      Tempo (min)
                    </Label>
                    <Input
                      id={`tempo-${linha.id}`}
                      type="number"
                      min={1}
                      value={linha.tempoManual}
                      onChange={(e) => alterar(linha.id, { tempoManual: e.target.value })}
                      className="h-10 text-base md:text-sm"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor={`motivo-${linha.id}`} className="text-xs">
                      Motivo
                    </Label>
                    <select
                      id={`motivo-${linha.id}`}
                      value={linha.motivo}
                      onChange={(e) => alterar(linha.id, { motivo: e.target.value })}
                      className="h-10 w-full rounded-md border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring dark:bg-input/30"
                    >
                      <option value="">Selecione…</option>
                      {MOTIVOS_OUTROS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  {linha.motivo === 'Outro' && (
                    <div className="grid gap-1.5 sm:col-span-2">
                      <Label htmlFor={`obs-${linha.id}`} className="text-xs">
                        Observações
                      </Label>
                      <Input
                        id={`obs-${linha.id}`}
                        value={linha.observacoes}
                        onChange={(e) => alterar(linha.id, { observacoes: e.target.value })}
                        className="h-10 text-base md:text-sm"
                      />
                    </div>
                  )}
                </div>
              )}

              {linha.erro && (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-danger">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {linha.erro}
                </p>
              )}
            </li>
          )
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          onClick={() => setLinhas((prev) => [...prev, novaLinha()])}
          disabled={enviando}
          className="h-10 gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Nova linha
        </Button>

        <Button onClick={enviar} disabled={enviando || prontas.length === 0} className="h-10">
          {enviando
            ? 'Enviando…'
            : `Registrar ${prontas.length} lançamento${prontas.length === 1 ? '' : 's'}`}
        </Button>

        {enviados > 0 && !enviando && (
          <Button
            variant="ghost"
            className="h-10"
            onClick={() => {
              toast.success(`${enviados} lançamento${enviados > 1 ? 's' : ''} registrado${enviados > 1 ? 's' : ''}.`)
              router.push('/apontamento/historico')
            }}
          >
            Concluir
          </Button>
        )}
      </div>

      {(enviados > 0 || comErro > 0) && (
        <p className="text-sm text-muted-foreground">
          {enviados} registrado{enviados === 1 ? '' : 's'}
          {comErro > 0 && `, ${comErro} com erro — corrija a linha e envie de novo`}.
        </p>
      )}
    </div>
  )
}
