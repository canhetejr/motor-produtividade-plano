'use client'

import { useState, useTransition, useMemo } from 'react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { createDemanda, updateDemanda, criarSolicitacao, aprovarSolicitacao, rejeitarSolicitacao, cancelarSolicitacao, importarDemandasCSV } from './actions'
import type { ActionResult } from '@/lib/action-result'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/ui/empty-state'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ImportDialog } from '@/components/import-dialog'
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Loader2, PlusCircle, Search, Edit2, Layers, Briefcase, Clock, FileDiff, 
  CheckCircle2, XCircle, Clock4, FileText, Users, X, ArrowUpDown, ArrowUp, ArrowDown

} from 'lucide-react'
import { AreasManager } from '../areas/areas-manager'
import { ColaboradoresManager } from '../colaboradores/colaboradores-manager'
import { formatarTempo } from '@/lib/tempo'

const TABS = ['areas', 'demandas', 'colaboradores', 'solicitacoes'] as const
type TabValue = typeof TABS[number]

type Area = { id: string; nome: string; ativo: boolean; colaboradoresCount: number; demandasCount: number }
type Demanda = { id: string; area_id: string; nome: string; tempo_padrao_min: number | null; variavel: boolean; ativo: boolean; blocos_totais: number; finita: boolean }
type Colaborador = { id: string; nome: string; area_id: string | null; carga_horaria_min: number; role: string; ativo: boolean; admin?: boolean }
type Solicitacao = {
  id: string;
  tipo: 'NOVA' | 'ALTERACAO';
  demanda_id: string | null;
  nome: string; 
  tempo_padrao_min: number | null; 
  variavel: boolean;
  blocos_totais: number;
  finita: boolean;
  ativo: boolean | null;
  status: 'PENDENTE' | 'APROVADA' | 'REJEITADA';
  demandas: { nome: string } | null;
  colaboradores: { nome: string } | null;
  areas: { nome: string } | null;
}

function TabCount({ value, tone = 'muted' }: { value: number; tone?: 'muted' | 'alert' }) {
  return (
    <span
      className={`ml-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold ${
        tone === 'alert' ? 'bg-rose-500 text-white animate-pulse' : 'bg-muted-foreground/15 text-muted-foreground'
      }`}
    >
      {value}
    </span>
  )
}

function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" className="w-full relative overflow-hidden group" disabled={pending}>
      <div className="absolute inset-0 bg-primary-foreground/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
      <span className="relative flex items-center justify-center gap-2">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
      </span>
    </Button>
  )
}

export function CatalogoManager({
  areas,
  demandas,
  solicitacoes,
  colaboradores,
  role,
  isAdmin = false,
  userAreaId,
  defaultTab,
}: {
  areas: Area[],
  demandas: Demanda[],
  solicitacoes: Solicitacao[],
  colaboradores: Colaborador[],
  role: 'gestor' | 'colaborador',
  isAdmin?: boolean,
  userAreaId?: string | null,
  defaultTab?: string,
}) {
  const isGestor = role === 'gestor'
  const [tab, setTabState] = useState<TabValue>(
    defaultTab && (TABS as readonly string[]).includes(defaultTab) && (isGestor || defaultTab === 'demandas' || defaultTab === 'solicitacoes') ? (defaultTab as TabValue) : 'demandas'
  )
  const [selectedArea, setSelectedArea] = useState<string>(role === 'colaborador' && userAreaId ? userAreaId : (areas[0]?.id || ''))
  const [colaboradorAreaFilter, setColaboradorAreaFilter] = useState<string>('todas')
  const [searchTerm, setSearchTerm] = useState('')
  const [classificacaoFilter, setClassificacaoFilter] = useState<'todas' | 'fixo' | 'variavel'>('todas')
  const [statusFilter, setStatusFilter] = useState<'todas' | 'ativo' | 'inativo'>('todas')
  const [sortField, setSortField] = useState<'nome' | 'tempo' | 'blocos'>('nome')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [isPending, startTransition] = useTransition()

  function setTab(value: TabValue) {
    setTabState(value)
    const url = new URL(window.location.href)
    url.searchParams.set('tab', value)
    window.history.replaceState(null, '', url)
  }

  function handleViewDemandas(areaId: string) {
    setSelectedArea(areaId)
    setSearchTerm('')
    setTab('demandas')
  }

  function handleViewColaboradores(areaId: string) {
    setColaboradorAreaFilter(areaId)
    setTab('colaboradores')
  }

  function toggleSort(field: 'nome' | 'tempo' | 'blocos') {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const [createDemandaOpen, setCreateDemandaOpen] = useState(false)
  const [editDemandaId, setEditDemandaId] = useState<string | null>(null)
  const [filtroSolicitacoes, setFiltroSolicitacoes] = useState<'pendentes' | 'todas'>('pendentes')

  const currentAreaObj = areas.find(a => a.id === selectedArea)

  const demandasFiltradas = useMemo(() => {
    let filtradas = demandas.filter(d => d.area_id === selectedArea)
    
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase()
      filtradas = filtradas.filter(d => d.nome.toLowerCase().includes(lower))
    }

    if (classificacaoFilter === 'fixo') {
      filtradas = filtradas.filter(d => !d.variavel)
    } else if (classificacaoFilter === 'variavel') {
      filtradas = filtradas.filter(d => d.variavel)
    }

    if (statusFilter === 'ativo') {
      filtradas = filtradas.filter(d => d.ativo)
    } else if (statusFilter === 'inativo') {
      filtradas = filtradas.filter(d => !d.ativo)
    }

    // Ordenação
    return [...filtradas].sort((a, b) => {
      let result = 0
      if (sortField === 'nome') {
        result = a.nome.localeCompare(b.nome)
      } else if (sortField === 'tempo') {
        const tempoA = a.tempo_padrao_min ?? 0
        const tempoB = b.tempo_padrao_min ?? 0
        result = tempoA - tempoB
      } else if (sortField === 'blocos') {
        result = a.blocos_totais - b.blocos_totais
      }
      return sortDirection === 'asc' ? result : -result
    })
  }, [demandas, selectedArea, searchTerm, classificacaoFilter, statusFilter, sortField, sortDirection])

  const solicitacoesFiltradas = useMemo(() => {
    if (filtroSolicitacoes === 'todas') return solicitacoes
    return solicitacoes.filter(s => s.status === 'PENDENTE')
  }, [solicitacoes, filtroSolicitacoes])

  const colaboradoresCount = useMemo(() => {
    if (colaboradorAreaFilter === 'todas') return colaboradores.length
    return colaboradores.filter(c => c.area_id === colaboradorAreaFilter).length
  }, [colaboradores, colaboradorAreaFilter])

  const pendentesCount = solicitacoes.filter(s => s.status === 'PENDENTE').length
  const demandasNaAreaCount = demandas.filter(d => d.area_id === selectedArea).length

  function submit(
    e: React.FormEvent<HTMLFormElement>,
    action: (formData: FormData) => Promise<ActionResult>,
    successMsg: string,
    close: () => void
  ) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await action(formData)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(successMsg)
      close()
    })
  }

  function handleSolicitacaoAcao(id: string, action: typeof aprovarSolicitacao, successMsg: string) {
    startTransition(async () => {
      const result = await action(id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(successMsg)
    })
  }

  const createButtonLabel = isGestor ? 'Nova Demanda' : 'Sugerir Nova Demanda'
  const createDialogTitle = isGestor ? 'Cadastrar Demanda' : 'Sugerir Demanda'
  const createAction = isGestor ? createDemanda : (fd: FormData) => criarSolicitacao('NOVA', null, fd)
  const successCreateMsg = isGestor ? 'Demanda criada com sucesso!' : 'Sugestão enviada para o gestor!'

  return (
    <div className="space-y-6">
      {/* KPI Resumo Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div 
          onClick={() => setTab('demandas')} 
          className={`cursor-pointer p-4 rounded-xl border transition-all ${
            tab === 'demandas' 
              ? 'bg-primary/5 border-primary/40 shadow-sm ring-1 ring-primary/20' 
              : 'bg-card/70 hover:bg-card border-border/60 hover:border-border'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Demandas ({currentAreaObj?.nome || 'Área'})</span>
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Briefcase className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold">{demandasNaAreaCount}</span>
            <span className="text-xs text-muted-foreground">tarefas</span>
          </div>
        </div>

        {isGestor && (
          <div 
            onClick={() => setTab('areas')} 
            className={`cursor-pointer p-4 rounded-xl border transition-all ${
              tab === 'areas' 
                ? 'bg-primary/5 border-primary/40 shadow-sm ring-1 ring-primary/20' 
                : 'bg-card/70 hover:bg-card border-border/60 hover:border-border'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Áreas Ativas</span>
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                <Layers className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-bold">{areas.length}</span>
              <span className="text-xs text-muted-foreground">cadastradas</span>
            </div>
          </div>
        )}

        {isGestor && (
          <div 
            onClick={() => setTab('colaboradores')} 
            className={`cursor-pointer p-4 rounded-xl border transition-all ${
              tab === 'colaboradores' 
                ? 'bg-primary/5 border-primary/40 shadow-sm ring-1 ring-primary/20' 
                : 'bg-card/70 hover:bg-card border-border/60 hover:border-border'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Equipe</span>
              <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-bold">{colaboradores.length}</span>
              <span className="text-xs text-muted-foreground">membros</span>
            </div>
          </div>
        )}

        <div 
          onClick={() => setTab('solicitacoes')} 
          className={`cursor-pointer p-4 rounded-xl border transition-all ${
            tab === 'solicitacoes' 
              ? 'bg-primary/5 border-primary/40 shadow-sm ring-1 ring-primary/20' 
              : 'bg-card/70 hover:bg-card border-border/60 hover:border-border'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">{isGestor ? 'Aprovações' : 'Minhas Sugestões'}</span>
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
              pendentesCount > 0 ? 'bg-amber-500/10 text-amber-500' : 'bg-muted text-muted-foreground'
            }`}>
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className={`text-2xl font-bold ${pendentesCount > 0 ? 'text-amber-500' : ''}`}>
              {pendentesCount}
            </span>
            <span className="text-xs text-muted-foreground">pendentes</span>
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as TabValue)} className="w-full">
        <div className="flex justify-between items-center mb-4">
          <TabsList className="bg-card/70 backdrop-blur-lg border border-border/60 flex-wrap h-auto p-1">
            {isGestor && (
              <TabsTrigger value="areas" className="data-active:bg-primary data-active:text-primary-foreground gap-2">
                <Layers className="h-4 w-4" /> <span className="hidden sm:inline">Áreas</span>
                <TabCount value={areas.length} />
              </TabsTrigger>
            )}
            <TabsTrigger value="demandas" className="data-active:bg-primary data-active:text-primary-foreground gap-2">
              <Briefcase className="h-4 w-4" /> <span className="hidden sm:inline">Demandas</span>
              <TabCount value={demandasNaAreaCount} />
            </TabsTrigger>
            {isGestor && (
              <TabsTrigger value="colaboradores" className="data-active:bg-primary data-active:text-primary-foreground gap-2">
                <Users className="h-4 w-4" /> <span className="hidden sm:inline">Colaboradores</span>
                <TabCount value={colaboradoresCount} />
              </TabsTrigger>
            )}
            <TabsTrigger value="solicitacoes" className="data-active:bg-primary data-active:text-primary-foreground gap-2">
              <FileText className="h-4 w-4" /> <span className="hidden sm:inline">{isGestor ? 'Aprovações' : 'Minhas Sugestões'}</span>
              {pendentesCount > 0 && <TabCount value={pendentesCount} tone="alert" />}
            </TabsTrigger>
          </TabsList>
        </div>

        {isGestor && (
          <TabsContent value="areas" className="mt-0">
            <AreasManager areas={areas} onViewDemandas={handleViewDemandas} onViewColaboradores={handleViewColaboradores} />
          </TabsContent>
        )}

        <TabsContent value="demandas" className="space-y-4 mt-0">
          {/* BARRA DE FERRAMENTAS UNIFICADA */}
          <div className="bg-card/90 backdrop-blur-xl border border-border shadow-sm rounded-2xl p-4 space-y-4">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Seleção de Área */}
              <div className="flex items-center gap-3 flex-1 min-w-0 bg-muted/30 p-2 rounded-xl border border-border/40">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Layers className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">Área de Atuação</span>
                  <Select value={selectedArea} onValueChange={(val) => { setSelectedArea(val || ''); setSearchTerm('') }} disabled={!isGestor}>
                    <SelectTrigger className="h-7 border-none bg-transparent p-0 text-sm font-bold focus:ring-0 shadow-none hover:bg-muted/50 rounded px-1 transition-colors">
                      <SelectValue placeholder="Selecione a área">
                        <span className="truncate block">{currentAreaObj?.nome || "Selecione a área"}</span>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {areas.filter(a => a.ativo || a.id === selectedArea).map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {isGestor && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1 shrink-0"
                    onClick={() => setTab('areas')}
                  >
                    <Edit2 className="h-3.5 w-3.5" /> Gerenciar
                  </Button>
                )}
              </div>

              {/* Botões de Ação Principais */}
              <div className="flex items-center gap-2 shrink-0">
                {isGestor && (
                  <ImportDialog
                    label="Importar CSV"
                    title="Importar demandas em massa"
                    colunasEsperadas="area, nome, tempo_padrao_min, variavel, blocos_totais, finita"
                    action={importarDemandasCSV}
                  />
                )}
                <Dialog open={createDemandaOpen} onOpenChange={setCreateDemandaOpen}>
                  <DialogTrigger render={<Button className={`gap-2 shadow-md ${!isGestor ? 'bg-indigo-600 hover:bg-indigo-700' : ''}`} />}>
                    <PlusCircle className="h-4 w-4" /> {createButtonLabel}
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <div className="h-8 w-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                          <Briefcase className="h-5 w-5" />
                        </div>
                        {createDialogTitle}
                      </DialogTitle>
                    </DialogHeader>
                    <form
                      onSubmit={(e) => {
                        if (!selectedArea) {
                          e.preventDefault()
                          toast.error('Selecione uma área primeiro')
                          return
                        }
                        submit(
                          e,
                          (fd) => {
                            fd.set('area_id', selectedArea)
                            return createAction(fd)
                          },
                          successCreateMsg,
                          () => setCreateDemandaOpen(false)
                        )
                      }}
                      className="space-y-5 py-2"
                    >
                      <div className="space-y-2">
                        <Label htmlFor="nova-demanda-nome">Nome da Tarefa</Label>
                        <Input id="nova-demanda-nome" name="nome" required placeholder="Ex: Análise de Contrato" />
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="nova-demanda-tempo">Tempo Padrão (horas ou min)</Label>
                          <Input id="nova-demanda-tempo" name="tempo_padrao_min" type="text" placeholder="Ex: 01:30 ou 90" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="nova-demanda-blocos">Total de Blocos</Label>
                          <Input id="nova-demanda-blocos" name="blocos_totais" type="number" min="1" defaultValue={1} required />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground -mt-2">
                        Deixe blocos em <strong>1</strong> se a tarefa não é fatiada. Acima de 1, o tempo padrão é o da tarefa <strong>inteira</strong> (ex.: 240 min / 4 blocos = 60 min por bloco) e passa a ser obrigatório.
                      </p>
                      
                      <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                        <div className="space-y-0.5">
                          <Label className="text-base flex items-center gap-2">
                            <FileDiff className="h-4 w-4 text-muted-foreground" />
                            Tempo Variável
                          </Label>
                          <p className="text-xs text-muted-foreground">Demanda não tem tempo fixo</p>
                        </div>
                        <Switch name="variavel" />
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                        <div className="space-y-0.5">
                          <Label className="text-base flex items-center gap-2">
                            <Layers className="h-4 w-4 text-muted-foreground" />
                            Bloco Finito
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Os blocos se esgotam entre todos os colaboradores (ex.: projeto com total fixo), em vez de
                            recorrer todo dia. Precisa de mais de 1 bloco.
                          </p>
                        </div>
                        <Switch name="finita" />
                      </div>

                      <SubmitButton pending={isPending}>{isGestor ? 'Salvar Demanda' : 'Enviar Sugestão'}</SubmitButton>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Linha Inferior: Busca + Filtros Rápidos */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1 border-t border-border/40">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar demandas por nome..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-8 h-9 text-sm bg-muted/30 border-border/50 focus:bg-background transition-colors"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Select
                  value={classificacaoFilter}
                  // Estreitar em vez de `as any`: o Select devolve string|null,
                  // e o cast escondia isso — valor fora da lista viraria um
                  // filtro que não casa com nada.
                  onValueChange={(val) => setClassificacaoFilter(val === 'fixo' || val === 'variavel' ? val : 'todas')}
                >
                  <SelectTrigger className="h-9 w-full sm:w-40 text-xs bg-muted/30 border-border/50">
                    <SelectValue placeholder="Classificação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todos os tipos</SelectItem>
                    <SelectItem value="fixo">Tempo Fixo</SelectItem>
                    <SelectItem value="variavel">Tempo Variável</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={statusFilter}
                  onValueChange={(val) => setStatusFilter(val === 'ativo' || val === 'inativo' ? val : 'todas')}
                >
                  <SelectTrigger className="h-9 w-full sm:w-32 text-xs bg-muted/30 border-border/50">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todos os status</SelectItem>
                    <SelectItem value="ativo">Ativas</SelectItem>
                    <SelectItem value="inativo">Inativas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Barra de Status da Listagem & Ordenação */}
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <div>
              Exibindo <strong className="text-foreground font-semibold">{demandasFiltradas.length}</strong> {demandasFiltradas.length === 1 ? 'demanda' : 'demandas'}
              {currentAreaObj ? ` na área ${currentAreaObj.nome}` : ''}
            </div>
            {(searchTerm || classificacaoFilter !== 'todas' || statusFilter !== 'todas') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchTerm('')
                  setClassificacaoFilter('todas')
                  setStatusFilter('todas')
                }}
                className="h-6 text-xs text-primary hover:text-primary/80 p-0"
              >
                Limpar filtros
              </Button>
            )}
          </div>

          {/* TABELA DE DEMANDAS */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card/80 backdrop-blur-xl border border-border shadow-md rounded-2xl overflow-hidden"
          >
            <div className="overflow-x-auto">
              <Table stacked>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent">
                    <TableHead 
                      className="w-[320px] cursor-pointer select-none hover:text-foreground transition-colors"
                      onClick={() => toggleSort('nome')}
                    >
                      <div className="flex items-center gap-1.5">
                        Nome
                        {sortField === 'nome' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5 text-primary" /> : <ArrowDown className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer select-none hover:text-foreground transition-colors"
                      onClick={() => toggleSort('tempo')}
                    >
                      <div className="flex items-center gap-1.5">
                        Tempo Padrão
                        {sortField === 'tempo' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5 text-primary" /> : <ArrowDown className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer select-none hover:text-foreground transition-colors"
                      onClick={() => toggleSort('blocos')}
                    >
                      <div className="flex items-center gap-1.5">
                        Blocos
                        {sortField === 'blocos' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5 text-primary" /> : <ArrowDown className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead>Classificação</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence>
                    {demandasFiltradas.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-48 text-center">
                          <EmptyState
                            icone={Search}
                            titulo="Nenhuma demanda encontrada"
                            descricao={
                              searchTerm || classificacaoFilter !== 'todas' || statusFilter !== 'todas'
                                ? 'Nenhum resultado corresponde aos filtros aplicados. Tente ajustar sua busca ou limpar os filtros.'
                                : 'Esta área ainda não possui demandas cadastradas.'
                            }
                            acao={
                              searchTerm || classificacaoFilter !== 'todas' || statusFilter !== 'todas' ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSearchTerm('')
                                    setClassificacaoFilter('todas')
                                    setStatusFilter('todas')
                                  }}
                                  className="text-xs"
                                >
                                  Limpar Filtros
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => setCreateDemandaOpen(true)}
                                  className="gap-1.5 text-xs"
                                >
                                  <PlusCircle className="h-3.5 w-3.5" /> {createButtonLabel}
                                </Button>
                              )
                            }
                            className="border-none py-4"
                          />
                        </TableCell>
                      </TableRow>
                    ) : (
                      demandasFiltradas.map((d, i) => (
                        <motion.tr 
                          key={d.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ delay: Math.min(i * 0.04, 0.4) }}
                          className="border-b transition-colors hover:bg-muted/40"
                        >
                          <TableCell stack="header" className="font-medium md:max-w-[320px]">
                            <div className="truncate font-semibold text-foreground" title={d.nome}>
                              {d.nome}
                            </div>
                            {d.finita && (
                              <span className="text-[10px] text-amber-500 font-medium">Bloco Finito</span>
                            )}
                          </TableCell>
                          <TableCell label="Tempo padrão">
                            {d.tempo_padrao_min ? (
                              <div className="flex items-center gap-1.5 text-foreground font-medium text-sm">
                                <Clock className="h-3.5 w-3.5 text-primary" />
                                <span>{formatarTempo(d.tempo_padrao_min)}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic text-xs">— Variável</span>
                            )}
                          </TableCell>
                          <TableCell label="Blocos">
                            <span className="inline-flex items-center justify-center h-6 min-w-6 px-2 rounded-md bg-secondary text-secondary-foreground text-xs font-bold shadow-xs">
                              {d.blocos_totais}
                            </span>
                          </TableCell>
                          <TableCell label="Classificação">
                            {d.variavel ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                                Variável
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                Fixo
                              </span>
                            )}
                          </TableCell>
                          <TableCell label="Status">
                            {d.ativo ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Ativo
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Inativo
                              </span>
                            )}
                          </TableCell>
                          <TableCell label="Ação" className="text-right">
                            <Dialog
                              open={editDemandaId === d.id}
                              onOpenChange={(open) => setEditDemandaId(open ? d.id : null)}
                            >
                              <DialogTrigger render={<Button variant="ghost" size="sm" className="h-8 gap-1.5 hover:bg-primary/10 hover:text-primary font-medium" />}>
                                <Edit2 className="h-3.5 w-3.5" /> {isGestor ? 'Editar' : 'Sugerir Alteração'}
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-md">
                                <DialogHeader>
                                  <DialogTitle className="flex items-center gap-2">
                                    <div className="h-8 w-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                                      <Edit2 className="h-5 w-5" />
                                    </div>
                                    {isGestor ? 'Editar Demanda' : 'Sugerir Alteração na Demanda'}
                                  </DialogTitle>
                                </DialogHeader>
                                <form
                                  key={JSON.stringify(d)}
                                  onSubmit={(e) =>
                                    submit(
                                      e,
                                      (fd) => {
                                        if (isGestor) return updateDemanda(d.id, fd)
                                        fd.set('area_id', selectedArea)
                                        return criarSolicitacao('ALTERACAO', d.id, fd)
                                      },
                                      isGestor ? 'Demanda atualizada!' : 'Sugestão de alteração enviada!',
                                      () => setEditDemandaId(null)
                                    )
                                  }
                                  className="space-y-5 py-2"
                                >
                                  <div className="space-y-2">
                                    <Label htmlFor={`demanda-nome-${d.id}`}>Nome da Tarefa</Label>
                                    <Input id={`demanda-nome-${d.id}`} name="nome" defaultValue={d.nome} required />
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <Label htmlFor={`demanda-tempo-${d.id}`}>Tempo Padrão (horas ou min)</Label>
                                      <Input id={`demanda-tempo-${d.id}`} name="tempo_padrao_min" type="text" defaultValue={d.tempo_padrao_min ? formatarTempo(d.tempo_padrao_min) : ''} placeholder="Ex: 01:30 ou 90" />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor={`demanda-blocos-${d.id}`}>Total de Blocos</Label>
                                      <Input id={`demanda-blocos-${d.id}`} name="blocos_totais" type="number" min="1" defaultValue={d.blocos_totais} required />
                                    </div>
                                  </div>
                                  <p className="text-xs text-muted-foreground -mt-2">
                                    Blocos em <strong>1</strong> = tarefa não fatiada. Acima de 1, o tempo padrão é o da tarefa <strong>inteira</strong> e passa a ser obrigatório. Alterações valem só para apontamentos <strong>novos</strong>.
                                  </p>
                                  
                                  <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                                    <div className="space-y-0.5">
                                      <Label className="text-base flex items-center gap-2">
                                        <FileDiff className="h-4 w-4 text-muted-foreground" />
                                        Tempo Variável
                                      </Label>
                                      <p className="text-xs text-muted-foreground">Demanda não tem tempo fixo</p>
                                    </div>
                                    <Switch name="variavel" defaultChecked={d.variavel} />
                                  </div>

                                  <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                                    <div className="space-y-0.5">
                                      <Label className="text-base flex items-center gap-2">
                                        <Layers className="h-4 w-4 text-muted-foreground" />
                                        Bloco Finito
                                      </Label>
                                      <p className="text-xs text-muted-foreground">
                                        Blocos se esgotam entre todos os colaboradores. Precisa de mais de 1 bloco.
                                      </p>
                                    </div>
                                    <Switch name="finita" defaultChecked={d.finita} />
                                  </div>

                                  <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                                    <div className="space-y-0.5">
                                      <Label className="text-base">Demanda Ativa</Label>
                                      <p className="text-xs text-muted-foreground">Disponível para apontamento</p>
                                    </div>
                                    <Switch name="ativo" defaultChecked={d.ativo} />
                                  </div>

                                  <SubmitButton pending={isPending}>{isGestor ? 'Atualizar Demanda' : 'Enviar Sugestão'}</SubmitButton>
                                </form>
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </motion.tr>
                      ))
                    )}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </div>
          </motion.div>
        </TabsContent>

        {isGestor && (
          <TabsContent value="colaboradores" className="mt-0">
            <ColaboradoresManager
              areas={areas}
              colaboradores={colaboradores}
              isAdmin={isAdmin}
              areaFilter={colaboradorAreaFilter}
              onAreaFilterChange={setColaboradorAreaFilter}
            />
          </TabsContent>
        )}

        <TabsContent value="solicitacoes" className="space-y-6 mt-0">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card/80 backdrop-blur-xl border border-border shadow-md rounded-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-border/50 bg-muted/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  {isGestor ? 'Aprovações Pendentes' : 'Status das Minhas Sugestões'}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {isGestor
                    ? 'Revise e aprove as solicitações de novas demandas e alterações enviadas pela equipe.'
                    : 'Acompanhe o status das demandas que você sugeriu.'}
                </p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Button
                  size="sm"
                  variant={filtroSolicitacoes === 'pendentes' ? 'default' : 'outline'}
                  onClick={() => setFiltroSolicitacoes('pendentes')}
                >
                  Pendentes
                </Button>
                <Button
                  size="sm"
                  variant={filtroSolicitacoes === 'todas' ? 'default' : 'outline'}
                  onClick={() => setFiltroSolicitacoes('todas')}
                >
                  Histórico
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table stacked>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent">
                    {isGestor && <TableHead>Colaborador</TableHead>}
                    <TableHead>Tipo</TableHead>
                    <TableHead>Detalhes Propostos</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {solicitacoesFiltradas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isGestor ? 5 : 4} className="h-32 text-center text-muted-foreground">
                        {filtroSolicitacoes === 'pendentes' ? 'Nenhuma solicitação pendente.' : 'Nenhuma solicitação encontrada.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    solicitacoesFiltradas.map((s) => (
                      <TableRow key={s.id} className="border-b transition-colors hover:bg-muted/40">
                        {isGestor && (
                          <TableCell stack="header" className="font-medium">
                            <div className="font-semibold text-foreground">{s.colaboradores?.nome}</div>
                            <div className="text-xs text-muted-foreground">{s.areas?.nome}</div>
                          </TableCell>
                        )}
                        <TableCell label="Tipo">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                            s.tipo === 'NOVA' ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                          }`}>
                            {s.tipo === 'NOVA' ? 'NOVA DEMANDA' : 'ALTERAÇÃO'}
                          </span>
                        </TableCell>
                        <TableCell stack="full" label="Detalhes">
                          <div className="font-semibold text-foreground">{s.nome}</div>
                          <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-2 items-center">
                            <span><strong className="text-foreground/80">Tempo:</strong> {s.tempo_padrao_min ? `${s.tempo_padrao_min}m` : 'Variável'}</span>
                            <span>•</span>
                            <span><strong className="text-foreground/80">Blocos:</strong> {s.blocos_totais}</span>
                            {s.tipo === 'ALTERACAO' && s.demandas?.nome && (
                              <>
                                <span>•</span>
                                <span className="bg-muted px-1.5 py-0.5 rounded text-[11px]"><strong className="text-foreground/80">Original:</strong> {s.demandas.nome}</span>
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell label="Status">
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                            s.status === 'PENDENTE' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' :
                            s.status === 'APROVADA' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' :
                            'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                          }`}>
                            {s.status === 'PENDENTE' && <Clock4 className="h-3.5 w-3.5" />}
                            {s.status === 'APROVADA' && <CheckCircle2 className="h-3.5 w-3.5" />}
                            {s.status === 'REJEITADA' && <XCircle className="h-3.5 w-3.5" />}
                            {s.status}
                          </div>
                        </TableCell>
                        <TableCell label="Ação" className="text-right">
                          {s.status === 'PENDENTE' && isGestor && (
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-300 dark:border-emerald-800"
                                onClick={() => handleSolicitacaoAcao(s.id, aprovarSolicitacao, 'Solicitação aprovada e demanda salva!')}
                                disabled={isPending}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" /> Aprovar
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger
                                  render={
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-300 dark:border-rose-800"
                                      disabled={isPending}
                                    >
                                      <XCircle className="h-4 w-4 mr-1" /> Rejeitar
                                    </Button>
                                  }
                                />
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Rejeitar solicitação?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      A sugestão &ldquo;{s.nome}&rdquo; será rejeitada e o colaborador que sugeriu é notificado. Essa ação não pode ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogClose render={<Button variant="outline">Cancelar</Button>} />
                                    <AlertDialogClose
                                      render={
                                        <Button
                                          variant="destructive"
                                          onClick={() => handleSolicitacaoAcao(s.id, rejeitarSolicitacao, 'Solicitação rejeitada.')}
                                        >
                                          Rejeitar
                                        </Button>
                                      }
                                    />
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          )}
                          {s.status === 'PENDENTE' && !isGestor && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-muted-foreground hover:text-foreground"
                              onClick={() => handleSolicitacaoAcao(s.id, cancelarSolicitacao, 'Sugestão cancelada.')}
                              disabled={isPending}
                            >
                              <XCircle className="h-4 w-4 mr-1" /> Cancelar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

