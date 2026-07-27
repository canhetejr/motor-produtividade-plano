'use client'

import { useState } from 'react'
import { ACAO_LABELS } from '@/lib/auditoria-constants'
import { formatarDataCompletaBR } from '@/lib/dates'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Eye, Filter, ShieldCheck, ScrollText } from 'lucide-react'

export type EventoAuditoria = {
  id: string
  acao: string
  entidade: string
  entidade_id: string | null
  dados_antes: unknown
  dados_depois: unknown
  criado_em: string
  colaboradores: { nome: string } | null
}

interface AuditoriaTableProps {
  eventos: EventoAuditoria[]
}

function formatarHora(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const CATEGORIAS = ['Todas', 'Autenticação', 'Colaboradores', 'Catálogo', 'Apontamentos', 'Kanban', 'Perfil']

export function AuditoriaTable({ eventos }: AuditoriaTableProps) {
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('Todas')
  const [eventoSelecionado, setEventoSelecionado] = useState<EventoAuditoria | null>(null)

  const eventosFiltrados = eventos.filter((ev) => {
    const config = ACAO_LABELS[ev.acao]
    const labelAcao = config?.label ?? ev.acao
    const categoriaAcao = config?.categoria ?? 'Outros'
    const nomeAtor = ev.colaboradores?.nome ?? 'Sistema / Externo'

    const matchBusca =
      busca.trim() === '' ||
      nomeAtor.toLowerCase().includes(busca.toLowerCase()) ||
      labelAcao.toLowerCase().includes(busca.toLowerCase()) ||
      ev.entidade.toLowerCase().includes(busca.toLowerCase()) ||
      (ev.entidade_id && ev.entidade_id.toLowerCase().includes(busca.toLowerCase()))

    const matchCategoria = categoria === 'Todas' || categoriaAcao === categoria

    return matchBusca && matchCategoria
  })

  return (
    <div className="space-y-4">
      {/* Barra de Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-card p-4 rounded-lg border shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por quem, ação ou entidade..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-muted-foreground hidden sm:block" />
          <Select value={categoria} onValueChange={(val) => val && setCategoria(val)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIAS.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Contagem de Resultados */}
      <div className="text-xs text-muted-foreground flex justify-between items-center px-1">
        <span>
          Exibindo {eventosFiltrados.length} de {eventos.length} eventos de auditoria
        </span>
      </div>

      {/* Tabela de Eventos */}
      <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[180px]">Data & Hora</TableHead>
              <TableHead>Ator / Usuário</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Ação Realizada</TableHead>
              <TableHead>Entidade Afetada</TableHead>
              <TableHead className="text-right">Detalhes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {eventosFiltrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  <ScrollText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  Nenhum evento de auditoria encontrado com os filtros atuais.
                </TableCell>
              </TableRow>
            ) : (
              eventosFiltrados.map((ev) => {
                const config = ACAO_LABELS[ev.acao]
                const labelAcao = config?.label ?? ev.acao
                const catAcao = config?.categoria ?? 'Geral'
                const variante = config?.variante ?? 'outline'
                const possuiDiff = ev.dados_antes !== null || ev.dados_depois !== null

                return (
                  <TableRow key={ev.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="whitespace-nowrap text-xs font-mono text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        {formatarDataCompletaBR(ev.criado_em.slice(0, 10))}
                      </span>
                      <span className="block text-[11px] opacity-75">{formatarHora(ev.criado_em)}</span>
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>{ev.colaboradores?.nome ?? 'Sistema / Externo'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[11px] font-normal">
                        {catAcao}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      <Badge variant={variante} className="font-medium">
                        {labelAcao}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      <span className="font-semibold text-foreground">{ev.entidade}</span>
                      {ev.entidade_id && <span className="block text-[10px] truncate max-w-[120px]">{ev.entidade_id}</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!possuiDiff}
                        onClick={() => setEventoSelecionado(ev)}
                        className="h-8 px-2 text-xs gap-1"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Ver Diffs</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modal Inspector de Alterações (Diff JSON) */}
      <Dialog open={!!eventoSelecionado} onOpenChange={(open) => !open && setEventoSelecionado(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <ScrollText className="h-5 w-5 text-emerald-600" />
              Detalhes do Evento de Auditoria
            </DialogTitle>
            <DialogDescription className="text-xs">
              {eventoSelecionado && (
                <>
                  Ação <strong>{ACAO_LABELS[eventoSelecionado.acao]?.label ?? eventoSelecionado.acao}</strong> realizada por{' '}
                  <strong>{eventoSelecionado.colaboradores?.nome ?? 'Sistema'}</strong> em{' '}
                  {formatarDataCompletaBR(eventoSelecionado.criado_em.slice(0, 10))} às {formatarHora(eventoSelecionado.criado_em)}.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {eventoSelecionado && (
            <div className="space-y-4 text-xs pt-2">
              <div className="grid grid-cols-2 gap-2 bg-muted/40 p-3 rounded-lg border text-muted-foreground">
                <div>
                  <span className="font-semibold text-foreground block">ID do Registro:</span>
                  <code className="text-[11px] font-mono">{eventoSelecionado.id}</code>
                </div>
                <div>
                  <span className="font-semibold text-foreground block">Entidade / ID Afetado:</span>
                  <code className="text-[11px] font-mono">
                    {eventoSelecionado.entidade} ({eventoSelecionado.entidade_id ?? 'N/A'})
                  </code>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Dados Antes */}
                <div className="space-y-1">
                  <h4 className="font-semibold text-slate-600 dark:text-slate-400 flex items-center justify-between">
                    <span>Estado Anterior (Antes)</span>
                  </h4>
                  <div className="bg-slate-950 text-slate-100 p-3 rounded-md font-mono text-[11px] overflow-x-auto max-h-60 border border-slate-800">
                    {eventoSelecionado.dados_antes ? (
                      <pre>{JSON.stringify(eventoSelecionado.dados_antes, null, 2)}</pre>
                    ) : (
                      <span className="text-slate-500 italic">Nenhum estado prévio (Criação/Novo).</span>
                    )}
                  </div>
                </div>

                {/* Dados Depois */}
                <div className="space-y-1">
                  <h4 className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
                    <span>Novo Estado (Depois)</span>
                  </h4>
                  <div className="bg-slate-950 text-slate-100 p-3 rounded-md font-mono text-[11px] overflow-x-auto max-h-60 border border-slate-800">
                    {eventoSelecionado.dados_depois ? (
                      <pre>{JSON.stringify(eventoSelecionado.dados_depois, null, 2)}</pre>
                    ) : (
                      <span className="text-slate-500 italic">Nenhum novo estado (Exclusão).</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
