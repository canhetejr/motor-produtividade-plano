'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, Paperclip, Download, Mail, Send, GitBranch, ListTree, ArrowRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { listarRequisitosDaEtapa, marcarRequisitoConcluido } from '../actions-requisitos'
import { listarSubtarefas, criarSubtarefa } from '../actions-subtarefas'
import {
  listarPredecessores,
  listarSubsequentes,
  vincularPredecessor,
  desvincularPredecessor,
  listarSequenciaResponsaveis,
  definirSequenciaResponsaveis,
  avancarSequencia,
  buscarCartaoPorCodigo,
} from '../actions-regras'
import { listarAnexos, enviarAnexo, excluirAnexo, obterUrlAnexo } from '../actions-anexos'
import { listarEmailsCartao, enviarEmailCartao, type EmailCartao } from '../actions-emails'
import type { Requisito, Subtarefa, Predecessor, SequenciaResponsavel, Anexo, MembroQuadro, Cartao } from './types'

function formatarBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// --- Requisitos da etapa ---------------------------------------------------

export function RequisitosTab({ cartaoId, colunaId, quadroId }: { cartaoId: string; colunaId: string; quadroId: string }) {
  const [requisitos, setRequisitos] = useState<Requisito[]>([])
  const [carregado, setCarregado] = useState(false)

  useEffect(() => {
    listarRequisitosDaEtapa(cartaoId, colunaId).then((r) => {
      if (r.ok) setRequisitos(r.data ?? [])
      setCarregado(true)
    })
  }, [cartaoId, colunaId])

  function handleToggle(requisitoId: string, concluido: boolean) {
    setRequisitos((prev) => prev.map((r) => (r.id === requisitoId ? { ...r, concluido } : r)))
    marcarRequisitoConcluido(cartaoId, requisitoId, quadroId, concluido)
  }

  if (!carregado) return null
  if (requisitos.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Esta etapa não tem requisitos configurados.</p>
  }

  return (
    <div className="space-y-2">
      {requisitos.map((r) => (
        <label key={r.id} className="flex items-start gap-2 rounded-sm border border-border p-2.5 text-sm cursor-pointer">
          <Checkbox checked={r.concluido} onCheckedChange={(v) => handleToggle(r.id, !!v)} className="mt-0.5" />
          <span className={r.concluido ? 'text-muted-foreground line-through' : ''}>
            {r.descricao} {r.obrigatorio && <span className="text-[10px] text-destructive align-super">*</span>}
          </span>
        </label>
      ))}
    </div>
  )
}

// --- Subtarefas -------------------------------------------------------------

export function SubtarefasTab({ cartao, quadroId, onSelect }: { cartao: Cartao; quadroId: string; onSelect: (id: string) => void }) {
  const [subtarefas, setSubtarefas] = useState<Subtarefa[]>([])
  const [novoTitulo, setNovoTitulo] = useState('')
  const [isPending, startTransition] = useTransition()

  function recarregar() {
    listarSubtarefas(cartao.id).then((r) => {
      if (r.ok) setSubtarefas(r.data ?? [])
    })
  }

  useEffect(recarregar, [cartao.id])

  function handleAdd() {
    if (!novoTitulo.trim()) return
    const titulo = novoTitulo.trim()
    setNovoTitulo('')
    startTransition(async () => {
      const result = await criarSubtarefa(cartao.id, quadroId, titulo)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      recarregar()
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input 
          value={novoTitulo} 
          onChange={(e) => setNovoTitulo(e.target.value)} 
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleAdd()
            }
          }}
          placeholder="Nova subtarefa..." 
          className="h-9 bg-secondary/30 border-border rounded-lg text-xs" 
        />
        <Button type="button" size="sm" onClick={handleAdd} disabled={isPending || !novoTitulo.trim()} className="h-9 rounded-lg px-3 bg-primary text-primary-foreground font-bold">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {subtarefas.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6 italic bg-secondary/20 rounded-lg border border-border/50">Nenhuma subtarefa ainda.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-secondary/40 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 font-semibold">Título</th>
                <th className="px-3 py-2 font-semibold">Etapa</th>
                <th className="px-3 py-2 font-semibold">Tipo</th>
              </tr>
            </thead>
            <tbody>
              {subtarefas.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0 hover:bg-secondary/30 cursor-pointer transition-colors" onClick={() => onSelect(s.id)}>
                  <td className="px-3 py-2.5 font-bold text-foreground">{s.titulo}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{s.colunaNome}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{s.tipo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// --- Regras: pré-requisitos / subsequentes / sequência de responsáveis ----

function DependenciaPicker({ onAdd }: { onAdd: (codigo: string) => void }) {
  const [valor, setValor] = useState('')
  
  function handleSubmeter() {
    if (!valor.trim()) return
    onAdd(valor.trim())
    setValor('')
  }

  return (
    <div className="flex items-center gap-1.5">
      <Input 
        value={valor} 
        onChange={(e) => setValor(e.target.value)} 
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            handleSubmeter()
          }
        }}
        placeholder="Código do card (ex.: UX-12)" 
        className="h-8 text-xs bg-secondary/30 border-border rounded-lg" 
      />
      <Button type="button" size="icon-sm" variant="outline" onClick={handleSubmeter} className="h-8 w-8 rounded-lg">
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

export function RegrasTab({ cartao, quadroId, membros }: { cartao: Cartao; quadroId: string; membros: MembroQuadro[] }) {
  const [predecessores, setPredecessores] = useState<Predecessor[]>([])
  const [subsequentes, setSubsequentes] = useState<Predecessor[]>([])
  const [sequencia, setSequencia] = useState<SequenciaResponsavel[]>([])
  const [editandoSequencia, setEditandoSequencia] = useState(false)
  const [sequenciaSelecionada, setSequenciaSelecionada] = useState<string[]>([])

  function recarregar() {
    listarPredecessores(cartao.id).then((r) => {
      if (r.ok) setPredecessores(r.data ?? [])
    })
    listarSubsequentes(cartao.id).then((r) => {
      if (r.ok) setSubsequentes(r.data ?? [])
    })
    listarSequenciaResponsaveis(cartao.id).then((r) => {
      if (r.ok) {
        const dados = r.data ?? []
        setSequencia(dados)
        setSequenciaSelecionada(dados.map((s) => s.colaboradorId))
      }
    })
  }

  useEffect(recarregar, [cartao.id])

  async function handleAddPredecessor(codigo: string) {
    const encontrado = await buscarCartaoPorCodigo(quadroId, codigo)
    if (!encontrado.ok) {
      toast.error(encontrado.error)
      return
    }

    const result = await vincularPredecessor(cartao.id, encontrado.data!.id, quadroId)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    recarregar()
  }

  function handleAvancarSequencia() {
    avancarSequencia(cartao.id, quadroId).then((r) => {
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      recarregar()
      toast.success('Sequência avançada.')
    })
  }

  function handleSalvarSequencia() {
    definirSequenciaResponsaveis(cartao.id, quadroId, sequenciaSelecionada).then((r) => {
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      setEditandoSequencia(false)
      recarregar()
    })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2 text-sm font-semibold"><ListTree className="h-4 w-4 text-primary" /> Sequência de responsáveis</Label>
          {!editandoSequencia && (
            <button type="button" onClick={() => setEditandoSequencia(true)} className="text-xs font-bold text-primary hover:underline">
              Editar
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Crie uma sequência de responsáveis e organize a passagem de bastão da tarefa.</p>

        {editandoSequencia ? (
          <div className="space-y-2 rounded-lg border border-border bg-secondary/20 p-3 text-xs">
            {membros.map((m) => (
              <label key={m.id} className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-secondary/40">
                <Checkbox
                  checked={sequenciaSelecionada.includes(m.id)}
                  onCheckedChange={(v) =>
                    setSequenciaSelecionada((prev) => (v ? [...prev, m.id] : prev.filter((id) => id !== m.id)))
                  }
                />
                {m.nome}
              </label>
            ))}
            <div className="flex gap-1.5 pt-2">
              <Button type="button" size="sm" onClick={handleSalvarSequencia} className="h-8 text-xs font-bold bg-primary text-primary-foreground">Salvar</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setEditandoSequencia(false)} className="h-8 text-xs">Cancelar</Button>
            </div>
          </div>
        ) : sequencia.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Nenhuma sequência definida.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            {sequencia.map((s, i) => (
              <span key={s.id} className="flex items-center gap-1.5">
                <span
                  className={
                    'text-xs font-semibold px-2.5 py-1 rounded-full border ' +
                    (s.entregue ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500' : 'border-primary/40 bg-primary/10 text-primary')
                  }
                >
                  {s.colaboradorNome}
                </span>
                {i < sequencia.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
              </span>
            ))}
            {sequencia.some((s) => !s.entregue) && (
              <Button type="button" size="xs" variant="outline" className="ml-2 h-7 text-xs font-bold" onClick={handleAvancarSequencia}>
                Avançar
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm font-semibold"><GitBranch className="h-4 w-4 text-primary" /> Tarefas pré-requisito</Label>
          <p className="text-xs text-muted-foreground">Devem ser entregues antes do andamento desta tarefa.</p>
          <div className="space-y-1">
            {predecessores.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-border bg-secondary/20 px-3 py-1.5 text-xs">
                <span className="font-semibold text-foreground">{p.codigo} · {p.titulo}</span>
                <button
                  type="button"
                  onClick={() => desvincularPredecessor(cartao.id, p.id, quadroId).then(recarregar)}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <DependenciaPicker onAdd={handleAddPredecessor} />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-semibold">Tarefas subsequentes</Label>
          <p className="text-xs text-muted-foreground">Serão iniciadas após a entrega desta tarefa.</p>
          <div className="space-y-1">
            {subsequentes.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nenhuma.</p>
            ) : (
              subsequentes.map((p) => (
                <div key={p.id} className="rounded-lg border border-border bg-secondary/20 px-3 py-1.5 text-xs font-semibold text-foreground">
                  {p.codigo} · {p.titulo}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// --- Anexos ------------------------------------------------------------

export function AnexosTab({ cartaoId, quadroId }: { cartaoId: string; quadroId: string }) {
  const [anexos, setAnexos] = useState<Anexo[]>([])
  const [isPending, startTransition] = useTransition()

  function recarregar() {
    listarAnexos(cartaoId).then((r) => {
      if (r.ok) setAnexos(r.data ?? [])
    })
  }

  useEffect(recarregar, [cartaoId])

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const formData = new FormData()
    formData.set('arquivo', file)
    startTransition(async () => {
      const result = await enviarAnexo(cartaoId, quadroId, formData)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      recarregar()
    })
  }

  async function handleDownload(anexoId: string) {
    const result = await obterUrlAnexo(anexoId)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    window.open(result.data!.url, '_blank')
  }

  function handleDelete(anexoId: string) {
    startTransition(async () => {
      const result = await excluirAnexo(anexoId, quadroId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      recarregar()
    })
  }

  return (
    <div className="space-y-3">
      <label className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-secondary/20 p-4 text-xs font-bold text-muted-foreground cursor-pointer hover:border-primary/50 hover:text-foreground hover:bg-secondary/40 transition-all">
        <Paperclip className="h-4 w-4 text-primary" /> {isPending ? 'Enviando arquivo...' : 'Adicionar anexo'}
        <input type="file" className="hidden" onChange={handleUpload} disabled={isPending} />
      </label>

      {anexos.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6 italic bg-secondary/20 rounded-lg border border-border/50">Nenhum anexo ainda.</p>
      ) : (
        <div className="space-y-1.5">
          {anexos.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-secondary/20 p-3 text-xs">
              <button type="button" onClick={() => handleDownload(a.id)} className="flex items-center gap-2 min-w-0 text-left hover:text-primary transition-colors">
                <Download className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="truncate font-semibold">{a.nomeArquivo}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">{formatarBytes(a.tamanhoBytes)}</span>
              </button>
              <button type="button" onClick={() => handleDelete(a.id)} className="text-muted-foreground hover:text-destructive shrink-0 transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// --- Emails ------------------------------------------------------------

export function EmailsTab({ cartaoId, quadroId }: { cartaoId: string; quadroId: string }) {
  const [emails, setEmails] = useState<EmailCartao[]>([])
  const [aberto, setAberto] = useState(false)
  const [destinatario, setDestinatario] = useState('')
  const [assunto, setAssunto] = useState('')
  const [corpo, setCorpo] = useState('')
  const [isPending, startTransition] = useTransition()

  function recarregar() {
    listarEmailsCartao(cartaoId).then((r) => {
      if (r.ok) setEmails(r.data ?? [])
    })
  }

  useEffect(recarregar, [cartaoId])

  function handleSend() {
    if (!destinatario.trim() || !assunto.trim() || !corpo.trim()) {
      toast.error('Preencha destinatário, assunto e corpo do e-mail.')
      return
    }
    const formData = new FormData()
    formData.set('destinatario', destinatario.trim())
    formData.set('assunto', assunto.trim())
    formData.set('corpo', corpo.trim())

    startTransition(async () => {
      const result = await enviarEmailCartao(cartaoId, quadroId, formData)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('E-mail enviado.')
      setDestinatario('')
      setAssunto('')
      setCorpo('')
      setAberto(false)
      recarregar()
    })
  }

  return (
    <div className="space-y-3">
      {aberto ? (
        <div className="space-y-2 rounded-xl border border-border bg-secondary/20 p-4 text-xs">
          <Input 
            value={destinatario} 
            onChange={(e) => setDestinatario(e.target.value)} 
            type="email" 
            placeholder="destinatario@empresa.com" 
            className="h-9 bg-secondary/50 border-border rounded-lg text-xs" 
          />
          <Input 
            value={assunto} 
            onChange={(e) => setAssunto(e.target.value)} 
            placeholder="Assunto" 
            className="h-9 bg-secondary/50 border-border rounded-lg text-xs" 
          />
          <Textarea 
            value={corpo} 
            onChange={(e) => setCorpo(e.target.value)} 
            placeholder="Mensagem..." 
            rows={4} 
            className="bg-secondary/50 border-border rounded-lg text-xs" 
          />
          <div className="flex gap-2 pt-1">
            <Button type="button" size="sm" onClick={handleSend} disabled={isPending} className="h-8 font-bold bg-primary text-primary-foreground rounded-lg">
              <Send className="h-3.5 w-3.5" /> Enviar
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setAberto(false)} className="h-8 rounded-lg">
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={() => setAberto(true)} className="h-8 font-bold text-xs rounded-lg">
          <Mail className="h-3.5 w-3.5 text-primary" /> Novo e-mail
        </Button>
      )}

      {emails.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6 italic bg-secondary/20 rounded-lg border border-border/50">Nenhum e-mail enviado a partir deste card.</p>
      ) : (
        <div className="space-y-2">
          {emails.map((e) => (
            <div key={e.id} className="rounded-lg border border-border bg-secondary/20 p-3 text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-foreground">{e.assunto}</span>
                <span className="text-[10px] text-muted-foreground">{new Date(e.enviadoEm).toLocaleString('pt-BR')}</span>
              </div>
              <p className="text-xs text-muted-foreground">Para: {e.destinatario} · por {e.colaboradorNome ?? '—'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
