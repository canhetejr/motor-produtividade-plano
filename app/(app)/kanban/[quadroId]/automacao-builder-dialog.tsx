'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ArrowDown, Plus, Trash2, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CampoComVariaveis } from '@/components/ui/campo-com-variaveis'
import { VARIAVEIS_CARTAO } from '@/lib/variaveis'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  agruparEventos,
  agruparAcoes,
  EVENTO_POR_TIPO,
  ACAO_POR_TIPO,
  rotuloEvento,
  rotuloAcao,
} from '@/lib/automacoes-catalogo'
import { salvarAutomacao } from '../actions-automacoes'
import type { Automacao, Coluna, Etiqueta, MembroQuadro, CampoCustomizado } from './types'

type AcaoRascunho = { chave: string; tipo: string; config: Record<string, unknown> }

export function AutomacaoBuilderDialog({
  aberto,
  automacao,
  quadroId,
  colunas,
  etiquetas,
  membros,
  camposCustomizados,
  onClose,
  onSalva,
}: {
  aberto: boolean
  /** null = criando uma automação nova. */
  automacao: Automacao | null
  quadroId: string
  colunas: Coluna[]
  etiquetas: Etiqueta[]
  membros: MembroQuadro[]
  camposCustomizados: CampoCustomizado[]
  onClose: () => void
  onSalva: () => void
}) {
  const [nome, setNome] = useState(automacao?.nome ?? '')
  const [evento, setEvento] = useState(automacao?.evento ?? '')
  const [eventoConfig, setEventoConfig] = useState<Record<string, unknown>>(automacao?.eventoConfig ?? {})
  const [acoes, setAcoes] = useState<AcaoRascunho[]>(
    automacao?.acoes.map((a, i) => ({ chave: `${a.id}-${i}`, tipo: a.tipo, config: a.config })) ?? []
  )
  const [isPending, startTransition] = useTransition()

  const definicaoEvento = evento ? EVENTO_POR_TIPO.get(evento as never) : undefined

  function adicionarAcao() {
    setAcoes((prev) => [...prev, { chave: `nova-${Date.now()}-${prev.length}`, tipo: '', config: {} }])
  }

  function atualizarAcao(chave: string, patch: Partial<AcaoRascunho>) {
    setAcoes((prev) => prev.map((a) => (a.chave === chave ? { ...a, ...patch } : a)))
  }

  function moverAcao(indice: number, direcao: -1 | 1) {
    const destino = indice + direcao
    if (destino < 0 || destino >= acoes.length) return
    setAcoes((prev) => {
      const copia = prev.slice()
      const [movida] = copia.splice(indice, 1)
      copia.splice(destino, 0, movida)
      return copia
    })
  }

  function handleSalvar() {
    if (!evento) {
      toast.error('Escolha o evento que dispara a automação.')
      return
    }
    const acoesValidas = acoes.filter((a) => a.tipo)
    if (acoesValidas.length === 0) {
      toast.error('Adicione pelo menos uma ação.')
      return
    }

    startTransition(async () => {
      const result = await salvarAutomacao(
        quadroId,
        { nome, evento, eventoConfig, acoes: acoesValidas.map((a) => ({ tipo: a.tipo, config: a.config })) },
        automacao?.id
      )
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(automacao ? 'Automação atualizada.' : 'Automação criada.')
      onSalva()
      onClose()
    })
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[88vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{automacao ? 'Editar automação' : 'Nova automação'}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto pr-1 custom-scrollbar">
          <div className="space-y-1.5">
            <Label htmlFor="automacao-nome">Nome</Label>
            <Input
              id="automacao-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Triagem de chamados novos"
              autoFocus
            />
          </div>

          {/* QUANDO */}
          <div className="space-y-2 rounded-xl border border-border bg-secondary/20 p-3.5">
            <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">Quando</span>
            <Select
              value={evento}
              onValueChange={(v) => {
                setEvento(v ?? '')
                setEventoConfig({}) // config antiga não vale pro evento novo
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione um evento">{(v: string) => (v ? rotuloEvento(v) : 'Selecione um evento')}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {agruparEventos().map(({ grupo, itens }) => (
                  <SelectGroup key={grupo}>
                    <SelectLabel>{grupo}</SelectLabel>
                    {itens.map((e) => (
                      <SelectItem key={e.tipo} value={e.tipo} className="cursor-pointer">
                        {e.rotulo}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>

            {definicaoEvento?.config === 'coluna' && (
              <SeletorColuna
                colunas={colunas}
                valor={typeof eventoConfig.colunaId === 'string' ? eventoConfig.colunaId : ''}
                onChange={(v) => setEventoConfig(v ? { colunaId: v } : {})}
              />
            )}

            {definicaoEvento?.config === 'etiqueta' && (
              <Select
                value={typeof eventoConfig.etiquetaId === 'string' ? eventoConfig.etiquetaId : ''}
                onValueChange={(v) => setEventoConfig(v ? { etiquetaId: v } : {})}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Qualquer tag">
                    {(v: string) => etiquetas.find((e) => e.id === v)?.nome ?? 'Qualquer tag'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {etiquetas.map((e) => (
                    <SelectItem key={e.id} value={e.id} className="cursor-pointer">{e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {definicaoEvento?.config === 'horas_antes' && (
              <div className="space-y-1">
                <Label htmlFor="horas-antes" className="text-xs">Avisar quantas horas antes</Label>
                <Input
                  id="horas-antes"
                  type="number"
                  min={1}
                  value={typeof eventoConfig.horasAntes === 'number' ? eventoConfig.horasAntes : ''}
                  onChange={(e) => setEventoConfig({ horasAntes: Number(e.target.value) || 24 })}
                  placeholder="24"
                  className="h-8 text-xs"
                />
              </div>
            )}

            {definicaoEvento?.porCron && (
              <p className="text-2xs text-muted-foreground">
                Avaliado de hora em hora por uma rotina automática, não no momento exato.
              </p>
            )}
          </div>

          <div className="flex justify-center">
            <ArrowDown className="h-4 w-4 text-muted-foreground" />
          </div>

          {/* ENTÃO */}
          <div className="space-y-2.5 rounded-xl border border-border bg-secondary/20 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">Então</span>
              <span className="text-2xs text-muted-foreground">Rodam em ordem, de cima para baixo</span>
            </div>

            {acoes.length === 0 && (
              <p className="py-4 text-center text-xs italic text-muted-foreground">Nenhuma ação ainda.</p>
            )}

            {acoes.map((acao, indice) => (
              <div key={acao.chave} className="space-y-2 rounded-lg border border-border bg-card p-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-3xs font-bold text-muted-foreground">#{indice + 1}</span>
                  <Select value={acao.tipo} onValueChange={(v) => atualizarAcao(acao.chave, { tipo: v ?? '', config: {} })}>
                    <SelectTrigger className="h-8 flex-1 text-xs">
                      <SelectValue placeholder="Selecione uma ação">{(v: string) => (v ? rotuloAcao(v) : 'Selecione uma ação')}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {agruparAcoes().map(({ grupo, itens }) => (
                        <SelectGroup key={grupo}>
                          <SelectLabel>{grupo}</SelectLabel>
                          {itens.map((a) => (
                            <SelectItem key={a.tipo} value={a.tipo} className="cursor-pointer text-xs">
                              {a.rotulo}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex shrink-0 items-center">
                    <button
                      type="button"
                      onClick={() => moverAcao(indice, -1)}
                      disabled={indice === 0}
                      className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                      aria-label="Mover ação para cima"
                    >
                      <GripVertical className="h-3.5 w-3.5 rotate-90" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setAcoes((prev) => prev.filter((a) => a.chave !== acao.chave))}
                      className="p-1 text-muted-foreground hover:text-destructive"
                      aria-label="Remover ação"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <ConfigDaAcao
                  tipo={acao.tipo}
                  config={acao.config}
                  colunas={colunas}
                  membros={membros}
                  camposCustomizados={camposCustomizados}
                  onChange={(config) => atualizarAcao(acao.chave, { config })}
                />
              </div>
            ))}

            <Button type="button" size="sm" variant="outline" onClick={adicionarAcao} className="w-full h-8 text-xs">
              <Plus className="h-3.5 w-3.5" /> Adicionar ação
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={isPending}>Salvar automação</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SeletorColuna({
  colunas,
  valor,
  onChange,
  placeholder = 'Qualquer etapa',
}: {
  colunas: Coluna[]
  valor: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <Select value={valor} onValueChange={(v) => onChange(v ?? '')}>
      <SelectTrigger className="h-8 w-full text-xs">
        <SelectValue placeholder={placeholder}>
          {(v: string) => colunas.find((c) => c.id === v)?.nome ?? placeholder}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {colunas.map((c) => (
          <SelectItem key={c.id} value={c.id} className="cursor-pointer text-xs">{c.nome}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Formulário de cada ação — o catálogo diz de qual tipo ela precisa. */
function ConfigDaAcao({
  tipo,
  config,
  colunas,
  membros,
  camposCustomizados,
  onChange,
}: {
  tipo: string
  config: Record<string, unknown>
  colunas: Coluna[]
  membros: MembroQuadro[]
  camposCustomizados: CampoCustomizado[]
  onChange: (config: Record<string, unknown>) => void
}) {
  if (!tipo) return null
  const forma = ACAO_POR_TIPO.get(tipo as never)?.config
  const texto = (chave: string) => (typeof config[chave] === 'string' ? (config[chave] as string) : '')

  switch (forma) {
    case 'titulo':
      return (
        <div className="space-y-1.5 pl-6">
          <CampoComVariaveis
            valor={texto('titulo')}
            onChange={(v) => onChange({ ...config, titulo: v })}
            variaveis={VARIAVEIS_CARTAO}
            placeholder="Título da tarefa a criar"
            className="text-xs"
            aria-label="Título da tarefa a criar"
          />
          <CampoComVariaveis
            valor={texto('descricao')}
            onChange={(v) => onChange({ ...config, descricao: v })}
            variaveis={VARIAVEIS_CARTAO}
            multiline
            rows={2}
            placeholder="Descrição (opcional)"
            className="text-xs"
            aria-label="Descrição da tarefa a criar"
          />
          <SeletorColuna
            colunas={colunas}
            valor={texto('colunaId')}
            onChange={(v) => onChange({ ...config, colunaId: v })}
            placeholder="Mesma etapa do card"
          />
        </div>
      )

    case 'coluna_destino':
      return (
        <div className="pl-6">
          <SeletorColuna
            colunas={colunas}
            valor={texto('colunaId')}
            onChange={(v) => onChange({ ...config, colunaId: v })}
            placeholder="Etapa de destino…"
          />
        </div>
      )

    case 'colaborador':
      return (
        <div className="pl-6">
          <Select value={texto('colaboradorId')} onValueChange={(v) => onChange({ ...config, colaboradorId: v ?? '' })}>
            <SelectTrigger className="h-8 w-full text-xs">
              <SelectValue placeholder="Selecione a pessoa…">
                {(v: string) => membros.find((m) => m.id === v)?.nome ?? 'Selecione a pessoa…'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {membros.map((m) => (
                <SelectItem key={m.id} value={m.id} className="cursor-pointer text-xs">{m.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )

    case 'email':
      return (
        <div className="space-y-1.5 pl-6">
          {/* type="text" e não "email": o campo aceita variáveis
              ({{emails_alocados}}), que o validador nativo recusaria. Quem
              valida endereço é o executor, depois de resolver. */}
          <CampoComVariaveis
            valor={texto('destinatario')}
            onChange={(v) => onChange({ ...config, destinatario: v })}
            variaveis={VARIAVEIS_CARTAO}
            placeholder="destinatario@empresa.com ou {{emails_alocados}}"
            className="text-xs"
            rotuloBotao="Destinatário por variável"
            aria-label="Destinatário do e-mail"
          />
          <CampoComVariaveis
            valor={texto('assunto')}
            onChange={(v) => onChange({ ...config, assunto: v })}
            variaveis={VARIAVEIS_CARTAO}
            placeholder="Assunto (vazio = código e título do card)"
            className="text-xs"
            aria-label="Assunto do e-mail"
          />
          <CampoComVariaveis
            valor={texto('corpo')}
            onChange={(v) => onChange({ ...config, corpo: v })}
            variaveis={VARIAVEIS_CARTAO}
            multiline
            rows={4}
            placeholder="Mensagem…"
            className="text-xs"
            aria-label="Mensagem do e-mail"
          />
        </div>
      )

    case 'campo':
      return <ConfigCampo config={config} camposCustomizados={camposCustomizados} onChange={onChange} />

    default:
      return null
  }
}

const CAMPOS_FIXOS = [
  { chave: 'prioridade', nome: 'Prioridade', opcoes: ['baixa', 'media', 'alta'] },
  { chave: 'tipo', nome: 'Tipo', opcoes: ['Padrão', 'Bug', 'Melhoria', 'Solicitação'] },
  { chave: 'tag_referencia', nome: 'TAG (Ref)', opcoes: null },
]

function ConfigCampo({
  config,
  camposCustomizados,
  onChange,
}: {
  config: Record<string, unknown>
  camposCustomizados: CampoCustomizado[]
  onChange: (config: Record<string, unknown>) => void
}) {
  // Um select só lista campo fixo e customizado; o prefixo diz de qual tabela
  // o valor sai na hora de executar.
  const selecionado = typeof config.campoId === 'string'
    ? `custom:${config.campoId}`
    : typeof config.campo === 'string'
      ? `fixo:${config.campo}`
      : ''

  const campoCustom = typeof config.campoId === 'string'
    ? camposCustomizados.find((c) => c.id === config.campoId)
    : undefined
  const campoFixo = typeof config.campo === 'string' ? CAMPOS_FIXOS.find((c) => c.chave === config.campo) : undefined
  const opcoes = campoCustom?.tipo === 'selecao' ? campoCustom.opcoes : (campoFixo?.opcoes ?? null)

  return (
    <div className="space-y-1.5 pl-6">
      <Select
        value={selecionado}
        onValueChange={(v) => {
          if (!v) return onChange({})
          const [origem, id] = v.split(':')
          onChange(origem === 'custom' ? { campoId: id } : { campo: id })
        }}
      >
        <SelectTrigger className="h-8 w-full text-xs">
          <SelectValue placeholder="Selecione o campo…">
            {(v: string) => {
              if (!v) return 'Selecione o campo…'
              const [origem, id] = v.split(':')
              return origem === 'custom'
                ? camposCustomizados.find((c) => c.id === id)?.nome ?? 'Campo removido'
                : CAMPOS_FIXOS.find((c) => c.chave === id)?.nome ?? id
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Campos do card</SelectLabel>
            {CAMPOS_FIXOS.map((c) => (
              <SelectItem key={c.chave} value={`fixo:${c.chave}`} className="cursor-pointer text-xs">{c.nome}</SelectItem>
            ))}
          </SelectGroup>
          {camposCustomizados.length > 0 && (
            <SelectGroup>
              <SelectLabel>Campos customizados</SelectLabel>
              {camposCustomizados.map((c) => (
                <SelectItem key={c.id} value={`custom:${c.id}`} className="cursor-pointer text-xs">{c.nome}</SelectItem>
              ))}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>

      {selecionado && (opcoes ? (
        <Select
          value={typeof config.valor === 'string' ? config.valor : ''}
          onValueChange={(v) => onChange({ ...config, valor: v ?? '' })}
        >
          <SelectTrigger className="h-8 w-full text-xs">
            <SelectValue placeholder="Valor…">{(v: string) => v || 'Valor…'}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {opcoes.map((o) => (
              <SelectItem key={o} value={o} className="cursor-pointer text-xs">{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          value={typeof config.valor === 'string' ? config.valor : ''}
          onChange={(e) => onChange({ ...config, valor: e.target.value })}
          placeholder="Valor (vazio = limpar o campo)"
          className="h-8 text-xs"
        />
      ))}
    </div>
  )
}
