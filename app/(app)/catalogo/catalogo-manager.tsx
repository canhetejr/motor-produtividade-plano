'use client'

import { useState, useTransition, useMemo } from 'react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { createDemanda, updateDemanda, criarSolicitacao, aprovarSolicitacao, rejeitarSolicitacao } from './actions'
import type { ActionResult } from '@/lib/action-result'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, PlusCircle, Search, Edit2, Layers, Briefcase, Clock, FileDiff, CheckCircle2, XCircle, Clock4, FileText } from 'lucide-react'

type Area = { id: string; nome: string }
type Demanda = { id: string; area_id: string; nome: string; tempo_padrao_min: number | null; variavel: boolean; ativo: boolean; blocos_totais: number }
type Solicitacao = { 
  id: string; 
  tipo: 'NOVA' | 'ALTERACAO'; 
  demanda_id: string | null;
  nome: string; 
  tempo_padrao_min: number | null; 
  variavel: boolean; 
  blocos_totais: number; 
  ativo: boolean | null; 
  status: 'PENDENTE' | 'APROVADA' | 'REJEITADA';
  demandas: { nome: string } | null;
  colaboradores: { nome: string } | null;
  areas: { nome: string } | null;
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
  role, 
  userAreaId 
}: { 
  areas: Area[], 
  demandas: Demanda[], 
  solicitacoes: Solicitacao[], 
  role: 'gestor' | 'colaborador', 
  userAreaId?: string | null 
}) {
  const [selectedArea, setSelectedArea] = useState<string>(role === 'colaborador' && userAreaId ? userAreaId : (areas[0]?.id || ''))
  const [searchTerm, setSearchTerm] = useState('')
  const [isPending, startTransition] = useTransition()

  // um estado por dialog; o de edição de demanda guarda o id da linha aberta
  const [createDemandaOpen, setCreateDemandaOpen] = useState(false)
  const [editDemandaId, setEditDemandaId] = useState<string | null>(null)

  const currentAreaObj = areas.find(a => a.id === selectedArea)

  const demandasFiltradas = useMemo(() => {
    let filtradas = demandas.filter(d => d.area_id === selectedArea)
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase()
      filtradas = filtradas.filter(d => d.nome.toLowerCase().includes(lower))
    }
    return filtradas
  }, [demandas, selectedArea, searchTerm])

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

  const isGestor = role === 'gestor'
  const createButtonLabel = isGestor ? 'Nova Demanda' : 'Sugerir Nova Demanda'
  const createDialogTitle = isGestor ? 'Cadastrar Demanda' : 'Sugerir Demanda'
  const createAction = isGestor ? createDemanda : (fd: FormData) => criarSolicitacao('NOVA', null, fd)
  const successCreateMsg = isGestor ? 'Demanda criada com sucesso!' : 'Sugestão enviada para o gestor!'

  return (
    <div className="space-y-6">
      <Tabs defaultValue="catalogo" className="w-full">
        <div className="flex justify-between items-center mb-6">
          <TabsList className="bg-card/50 backdrop-blur-lg border border-border/50">
            <TabsTrigger value="catalogo" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2">
              <Layers className="h-4 w-4" /> Catálogo
            </TabsTrigger>
            <TabsTrigger value="solicitacoes" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2">
              <FileText className="h-4 w-4" /> {isGestor ? 'Aprovações' : 'Minhas Sugestões'}
              {solicitacoes.filter(s => s.status === 'PENDENTE').length > 0 && (
                <span className="ml-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] text-white">
                  {solicitacoes.filter(s => s.status === 'PENDENTE').length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="catalogo" className="space-y-6 mt-0">
          <div className="bg-card/80 backdrop-blur-xl border shadow-lg p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex-1">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Layers className="h-5 w-5 text-primary" />
                Área de Atuação
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {isGestor 
                  ? 'Selecione a área para visualizar e gerenciar suas demandas.' 
                  : 'Sua área está selecionada para consulta.'}
              </p>
            </div>
            
            <div className="flex gap-2 items-center flex-wrap w-full md:w-auto">
              <div className="w-full sm:w-64">
                <Select 
                  value={selectedArea} 
                  onValueChange={(val) => { setSelectedArea(val || ''); setSearchTerm('') }}
                  disabled={!isGestor}
                >
                  <SelectTrigger className="w-full bg-background opacity-100">
                    <SelectValue placeholder="Selecione a área">
                      <span className="truncate block font-medium">{currentAreaObj?.nome || "Selecione a área"}</span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {areas.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isGestor && (
                <Button render={<a href="/areas" />} variant="outline" className="gap-2 bg-background hover:bg-muted">
                  <Layers className="h-4 w-4" /> Gerenciar Áreas
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 mb-4">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar demandas..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-card/50 border-border/50 focus:border-primary/50 transition-colors"
              />
            </div>
            
            <Dialog open={createDemandaOpen} onOpenChange={setCreateDemandaOpen}>
              <DialogTrigger render={<Button className={`w-full sm:w-auto gap-2 shadow-lg shadow-primary/20 ${!isGestor ? 'bg-indigo-600 hover:bg-indigo-700' : ''}`} />}>
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
                      <Label htmlFor="nova-demanda-tempo">Tempo Padrão (min)</Label>
                      <Input id="nova-demanda-tempo" name="tempo_padrao_min" type="number" min="1" placeholder="Em branco se variável" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nova-demanda-blocos">Total de Blocos</Label>
                      <Input id="nova-demanda-blocos" name="blocos_totais" type="number" min="1" defaultValue={1} required />
                    </div>
                  </div>
                  
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

                  <SubmitButton pending={isPending}>{isGestor ? 'Salvar Demanda' : 'Enviar Sugestão'}</SubmitButton>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card/80 backdrop-blur-xl border shadow-lg rounded-2xl overflow-hidden"
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[300px]">Nome</TableHead>
                    <TableHead>Tempo Padrão</TableHead>
                    <TableHead>Blocos</TableHead>
                    <TableHead>Classificação</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence>
                    {demandasFiltradas.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                          Nenhuma demanda encontrada nesta área.
                        </TableCell>
                      </TableRow>
                    ) : (
                      demandasFiltradas.map((d, i) => (
                        <motion.tr 
                          key={d.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ delay: Math.min(i * 0.05, 0.5) }}
                          className="border-b transition-colors hover:bg-muted/50"
                        >
                          <TableCell className="font-medium truncate max-w-[300px]" title={d.nome}>
                            {d.nome}
                          </TableCell>
                          <TableCell>
                            {d.tempo_padrao_min ? (
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <Clock className="h-3.5 w-3.5" />
                                <span className="font-medium text-foreground">{d.tempo_padrao_min}</span> min
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center justify-center h-6 min-w-6 px-2 rounded-md bg-secondary text-secondary-foreground text-xs font-bold">
                              {d.blocos_totais}
                            </span>
                          </TableCell>
                          <TableCell>
                            {d.variavel ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-500 border border-purple-500/20">
                                Variável
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20">
                                Fixo
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {d.ativo ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Ativo
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20">
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Inativo
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Dialog
                              open={editDemandaId === d.id}
                              onOpenChange={(open) => setEditDemandaId(open ? d.id : null)}
                            >
                              <DialogTrigger render={<Button variant="ghost" size="sm" className="h-8 gap-2 hover:bg-primary/10 hover:text-primary" />}>
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
                                      <Label htmlFor={`demanda-tempo-${d.id}`}>Tempo Padrão (min)</Label>
                                      <Input id={`demanda-tempo-${d.id}`} name="tempo_padrao_min" type="number" min="1" defaultValue={d.tempo_padrao_min ?? ''} />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor={`demanda-blocos-${d.id}`}>Total de Blocos</Label>
                                      <Input id={`demanda-blocos-${d.id}`} name="blocos_totais" type="number" min="1" defaultValue={d.blocos_totais} required />
                                    </div>
                                  </div>
                                  
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

        <TabsContent value="solicitacoes" className="space-y-6 mt-0">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card/80 backdrop-blur-xl border shadow-lg rounded-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-border/50 bg-muted/10">
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

            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent">
                    {isGestor && <TableHead>Colaborador</TableHead>}
                    <TableHead>Tipo</TableHead>
                    <TableHead>Detalhes Propostos</TableHead>
                    <TableHead>Status</TableHead>
                    {isGestor && <TableHead className="text-right">Ação</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {solicitacoes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isGestor ? 5 : 3} className="h-32 text-center text-muted-foreground">
                        Nenhuma solicitação encontrada.
                      </TableCell>
                    </TableRow>
                  ) : (
                    solicitacoes.map((s) => (
                      <TableRow key={s.id} className="border-b transition-colors hover:bg-muted/50">
                        {isGestor && (
                          <TableCell className="font-medium">
                            {s.colaboradores?.nome}
                            <div className="text-xs text-muted-foreground">{s.areas?.nome}</div>
                          </TableCell>
                        )}
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${s.tipo === 'NOVA' ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                            {s.tipo}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold">{s.nome}</div>
                          <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-2">
                            <span><strong className="text-foreground/70">Tempo:</strong> {s.tempo_padrao_min ? `${s.tempo_padrao_min}m` : 'Variável'}</span>
                            <span>•</span>
                            <span><strong className="text-foreground/70">Blocos:</strong> {s.blocos_totais}</span>
                            {s.tipo === 'ALTERACAO' && s.demandas?.nome && (
                              <>
                                <span>•</span>
                                <span><strong className="text-foreground/70">Original:</strong> {s.demandas.nome}</span>
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                            s.status === 'PENDENTE' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                            s.status === 'APROVADA' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                            'bg-rose-500/10 text-rose-500 border-rose-500/20'
                          }`}>
                            {s.status === 'PENDENTE' && <Clock4 className="h-3.5 w-3.5" />}
                            {s.status === 'APROVADA' && <CheckCircle2 className="h-3.5 w-3.5" />}
                            {s.status === 'REJEITADA' && <XCircle className="h-3.5 w-3.5" />}
                            {s.status}
                          </div>
                        </TableCell>
                        {isGestor && (
                          <TableCell className="text-right">
                            {s.status === 'PENDENTE' && (
                              <div className="flex justify-end gap-2">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-8 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 border-emerald-200"
                                  onClick={() => handleSolicitacaoAcao(s.id, aprovarSolicitacao, 'Solicitação aprovada e demanda salva!')}
                                  disabled={isPending}
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-1" /> Aprovar
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 border-rose-200"
                                  onClick={() => handleSolicitacaoAcao(s.id, rejeitarSolicitacao, 'Solicitação rejeitada.')}
                                  disabled={isPending}
                                >
                                  <XCircle className="h-4 w-4 mr-1" /> Rejeitar
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        )}
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
