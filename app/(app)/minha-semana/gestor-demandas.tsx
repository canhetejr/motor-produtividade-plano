'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarSync, Loader2, Plus, Rows3, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { criarDemandasDaSemana } from './actions'

export type QuadroSemana = {
  id: string
  nome: string
  colunas: { id: string; nome: string; posicao: number; etapaFinal: boolean }[]
  membros: { id: string; nome: string; areaId: string | null; googleConectado: boolean }[]
}

export type DemandaCatalogoSemana = { id: string; nome: string; areaId: string }

type Linha = {
  id: string
  titulo: string
  descricao: string
  prazo: string
  prioridade: 'baixa' | 'media' | 'alta'
  demandaId: string
  responsavelId: string
}

function hojeLocal() {
  const agora = new Date()
  const ano = agora.getFullYear()
  const mes = String(agora.getMonth() + 1).padStart(2, '0')
  const dia = String(agora.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

function novaLinha(): Linha {
  return { id: crypto.randomUUID(), titulo: '', descricao: '', prazo: hojeLocal(), prioridade: 'media', demandaId: '', responsavelId: '' }
}

const selectClass = 'h-8 w-full rounded-sm border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'

export function GestorDemandas({ quadros, demandas }: { quadros: QuadroSemana[]; demandas: DemandaCatalogoSemana[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [modo, setModo] = useState<'unica' | 'lote' | null>(null)
  const [quadroId, setQuadroId] = useState(quadros[0]?.id ?? '')
  const quadro = useMemo(() => quadros.find((item) => item.id === quadroId) ?? quadros[0] ?? null, [quadroId, quadros])
  const demandasPorArea = useMemo(() => {
    const grupos = new Map<string, DemandaCatalogoSemana[]>()
    for (const demanda of demandas) {
      const grupo = grupos.get(demanda.areaId)
      if (grupo) grupo.push(demanda)
      else grupos.set(demanda.areaId, [demanda])
    }
    return grupos
  }, [demandas])
  const areaDaDemanda = useMemo(() => new Map(demandas.map((demanda) => [demanda.id, demanda.areaId])), [demandas])
  const membroPorId = useMemo(() => new Map((quadro?.membros ?? []).map((membro) => [membro.id, membro])), [quadro])
  const [colunaId, setColunaId] = useState(quadros[0]?.colunas[0]?.id ?? '')
  const [linhas, setLinhas] = useState<Linha[]>(() => [novaLinha()])

  function abrir(novoModo: 'unica' | 'lote') {
    const primeiroQuadro = quadros[0]
    setModo(novoModo)
    setQuadroId(primeiroQuadro?.id ?? '')
    setColunaId(primeiroQuadro?.colunas[0]?.id ?? '')
    setLinhas([novaLinha()])
  }

  function trocarQuadro(id: string) {
    const novo = quadros.find((item) => item.id === id)
    setQuadroId(id)
    setColunaId(novo?.colunas[0]?.id ?? '')
    setLinhas((atuais) => atuais.map((linha) => ({ ...linha, responsavelId: '', demandaId: '' })))
  }

  function atualizarLinha(id: string, campo: keyof Omit<Linha, 'id'>, valor: string) {
    setLinhas((atuais) => atuais.map((linha) => linha.id === id ? { ...linha, [campo]: valor } : linha))
  }

  function atualizarResponsavel(id: string, responsavelId: string) {
    const areaId = membroPorId.get(responsavelId)?.areaId ?? null
    setLinhas((atuais) => atuais.map((linha) => {
      if (linha.id !== id) return linha
      const demandaContinuaValida = areaDaDemanda.get(linha.demandaId) === areaId
      return { ...linha, responsavelId, demandaId: demandaContinuaValida ? linha.demandaId : '' }
    }))
  }

  function salvar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!quadroId || !colunaId) return toast.error('Selecione o quadro e a etapa.')
    if (linhas.some((linha) => !linha.titulo.trim() || !linha.prazo || !linha.responsavelId || !linha.demandaId)) {
      return toast.error('Preencha título, demanda do catálogo, prazo e responsável em todas as linhas.')
    }

    startTransition(async () => {
      const resultado = await criarDemandasDaSemana({
        quadroId,
        colunaId,
        demandas: linhas.map((linha) => ({
          titulo: linha.titulo,
          descricao: linha.descricao,
          prazo: linha.prazo,
          prioridade: linha.prioridade,
          demandaId: linha.demandaId,
          responsavelIds: [linha.responsavelId],
        })),
      })
      if (!resultado.ok) {
        toast.error(resultado.error)
        return
      }
      if (!resultado.data) return

      const { criados, sincronizacoesAgendadas } = resultado.data
      toast.success(`${criados} ${criados === 1 ? 'demanda criada' : 'demandas criadas'} com sucesso.`)
      if (sincronizacoesAgendadas > 0) toast.success('A sincronização com o Google Calendar foi iniciada automaticamente.')
      setModo(null)
      router.refresh()
    })
  }

  if (quadros.length === 0) {
    return <p className="text-xs text-muted-foreground">Crie um quadro com uma etapa antes de cadastrar demandas por aqui.</p>
  }
  if (demandas.length === 0) {
    return <p className="text-xs text-muted-foreground">Cadastre uma demanda ativa no catálogo antes de criar cards por aqui.</p>
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="lg" onClick={() => abrir('unica')}>
          <Plus /> Nova demanda
        </Button>
        <Button type="button" size="lg" variant="outline" onClick={() => abrir('lote')}>
          <Rows3 /> Adicionar em lote
        </Button>
      </div>

      <Dialog open={modo !== null} onOpenChange={(aberto) => !aberto && setModo(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{modo === 'lote' ? 'Adicionar demandas em lote' : 'Nova demanda'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={salvar} className="space-y-5 pt-2">
            <div className="grid gap-4 rounded-xl border border-border bg-muted/20 p-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="semana-quadro">Quadro</Label>
                <select id="semana-quadro" className={selectClass} value={quadroId} onChange={(event) => trocarQuadro(event.target.value)} required>
                  {quadros.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="semana-etapa">Etapa</Label>
                <select id="semana-etapa" className={selectClass} value={colunaId} onChange={(event) => setColunaId(event.target.value)} required>
                  {(quadro?.colunas ?? []).map((coluna) => (
                    <option key={coluna.id} value={coluna.id}>{coluna.nome}{coluna.etapaFinal ? ' · etapa final' : ''}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-primary/25 bg-primary/5 p-3 text-xs text-muted-foreground">
              <CalendarSync className="mt-0.5 size-4 shrink-0 text-primary" />
              <p>Ao salvar, os eventos são criados automaticamente nos calendários dos responsáveis conectados. Alterações posteriores de título, descrição, prazo, etapa, prioridade e checklist também serão atualizadas.</p>
            </div>

            <div className="space-y-3">
              {linhas.map((linha, indice) => {
                const responsavel = membroPorId.get(linha.responsavelId)
                const demandasDisponiveis = responsavel?.areaId ? (demandasPorArea.get(responsavel.areaId) ?? []) : []

                return (
                  <section key={linha.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold">{modo === 'lote' ? `Demanda ${indice + 1}` : 'Dados da demanda'}</h3>
                      {modo === 'lote' && linhas.length > 1 && (
                        <Button type="button" size="icon-sm" variant="ghost" aria-label={`Remover demanda ${indice + 1}`} onClick={() => setLinhas((atuais) => atuais.filter((item) => item.id !== linha.id))}>
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                    <div className="grid gap-4 md:grid-cols-12">
                      <div className="space-y-2 md:col-span-7">
                        <Label htmlFor={`titulo-${linha.id}`}>Título</Label>
                        <Input id={`titulo-${linha.id}`} value={linha.titulo} onChange={(event) => atualizarLinha(linha.id, 'titulo', event.target.value)} placeholder="Ex: Revisar material da disciplina" required />
                      </div>
                      <div className="space-y-2 md:col-span-5">
                        <Label htmlFor={`responsavel-${linha.id}`}>Responsável</Label>
                        <select id={`responsavel-${linha.id}`} className={selectClass} value={linha.responsavelId} onChange={(event) => atualizarResponsavel(linha.id, event.target.value)} required>
                          <option value="">Selecione</option>
                          {(quadro?.membros ?? []).map((membro) => (
                            <option key={membro.id} value={membro.id}>{membro.nome}{membro.googleConectado ? ' · Google conectado' : ''}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2 md:col-span-5">
                        <Label htmlFor={`demanda-${linha.id}`}>Demanda do catálogo</Label>
                        <select id={`demanda-${linha.id}`} className={selectClass} value={linha.demandaId} onChange={(event) => atualizarLinha(linha.id, 'demandaId', event.target.value)} disabled={!linha.responsavelId || demandasDisponiveis.length === 0} required>
                          <option value="">
                            {!linha.responsavelId
                              ? 'Selecione primeiro o responsável'
                              : demandasDisponiveis.length === 0
                                ? 'Nenhuma demanda cadastrada para este colaborador'
                                : 'Selecione a demanda'}
                          </option>
                          {demandasDisponiveis.map((demanda) => (
                            <option key={demanda.id} value={demanda.id}>{demanda.nome}</option>
                          ))}
                        </select>
                        {responsavel && !responsavel.areaId && <p className="text-xs text-destructive">Este colaborador ainda não possui uma área cadastrada.</p>}
                      </div>
                      <div className="space-y-2 md:col-span-3">
                        <Label htmlFor={`prazo-${linha.id}`}>Prazo</Label>
                        <Input id={`prazo-${linha.id}`} type="date" value={linha.prazo} onChange={(event) => atualizarLinha(linha.id, 'prazo', event.target.value)} required />
                      </div>
                      <div className="space-y-2 md:col-span-4">
                        <Label htmlFor={`prioridade-${linha.id}`}>Prioridade</Label>
                        <select id={`prioridade-${linha.id}`} className={selectClass} value={linha.prioridade} onChange={(event) => atualizarLinha(linha.id, 'prioridade', event.target.value)}>
                          <option value="baixa">Baixa</option>
                          <option value="media">Média</option>
                          <option value="alta">Alta</option>
                        </select>
                      </div>
                      <div className="space-y-2 md:col-span-12">
                        <Label htmlFor={`descricao-${linha.id}`}>Descrição</Label>
                        <Textarea id={`descricao-${linha.id}`} value={linha.descricao} onChange={(event) => atualizarLinha(linha.id, 'descricao', event.target.value)} placeholder="Contexto, entregável e orientações..." className="min-h-20" />
                      </div>
                    </div>
                  </section>
                )
              })}
            </div>

            <div className="flex flex-col-reverse justify-between gap-3 sm:flex-row">
              {modo === 'lote' ? (
                <Button type="button" variant="outline" onClick={() => setLinhas((atuais) => [...atuais, novaLinha()])} disabled={linhas.length >= 50}>
                  <Plus /> Adicionar outra demanda
                </Button>
              ) : <span />}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setModo(null)}>Cancelar</Button>
                <Button type="submit" disabled={isPending || !quadro?.colunas.length || !quadro?.membros.length}>
                  {isPending ? <Loader2 className="animate-spin" /> : <CalendarSync />}
                  {isPending ? 'Criando...' : modo === 'lote' ? `Criar ${linhas.length} demandas` : 'Criar e sincronizar'}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
