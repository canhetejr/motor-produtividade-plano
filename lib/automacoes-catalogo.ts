// Catálogo de eventos/ações das automações do Kanban + a lógica pura que
// decide se uma automação responde a um evento.
//
// Fica separado de lib/automacoes.ts (o executor) porque nada aqui tem efeito
// colateral: a tela de automações importa os rótulos e os grupos, e os testes
// importam o casamento de evento sem precisar de banco. O executor é
// 'server-only' e nem pode ser importado do browser ou do vitest.
//
// Um catálogo só, em vez de listas duplicadas na UI e no executor: acrescentar
// um evento ou uma ação é editar um lugar, e o TypeScript acusa se o executor
// não tratar um tipo novo.

export type GrupoEvento = 'Movimentação' | 'Data e horário' | 'Gerenciamento de status' | 'Categorização'

export type TipoEvento =
  | 'cartao_entrou_etapa'
  | 'cartao_saiu_etapa'
  | 'subtarefa_entregue'
  | 'subtarefa_entrou_etapa'
  | 'subtarefa_saiu_etapa'
  | 'play_ativado'
  | 'cartao_atrasou'
  | 'cartao_perto_atrasar'
  | 'sla_estourado'
  | 'sla_perto_estourar'
  | 'aprovacao_solicitada'
  | 'cartao_aprovado'
  | 'cartao_reprovado'
  | 'tag_adicionada'
  | 'tag_removida'

/** Que configuração extra o evento aceita — define o formulário do "Quando". */
export type ConfigEvento = 'nenhuma' | 'coluna' | 'etiqueta' | 'horas_antes'

export type DefinicaoEvento = {
  tipo: TipoEvento
  grupo: GrupoEvento
  rotulo: string
  config: ConfigEvento
  /** Eventos de tempo não têm mutação que os dispare — quem os avalia é o cron. */
  porCron?: boolean
}

export const EVENTOS: DefinicaoEvento[] = [
  { tipo: 'cartao_entrou_etapa', grupo: 'Movimentação', rotulo: 'A tarefa entrar na etapa', config: 'coluna' },
  { tipo: 'cartao_saiu_etapa', grupo: 'Movimentação', rotulo: 'A tarefa sair da etapa', config: 'coluna' },
  { tipo: 'subtarefa_entregue', grupo: 'Movimentação', rotulo: 'A subtarefa for entregue', config: 'nenhuma' },
  { tipo: 'subtarefa_entrou_etapa', grupo: 'Movimentação', rotulo: 'A subtarefa entrar na etapa', config: 'coluna' },
  { tipo: 'subtarefa_saiu_etapa', grupo: 'Movimentação', rotulo: 'A subtarefa sair da etapa', config: 'coluna' },

  { tipo: 'play_ativado', grupo: 'Data e horário', rotulo: 'Ativar o play da tarefa', config: 'nenhuma' },
  { tipo: 'cartao_atrasou', grupo: 'Data e horário', rotulo: 'A tarefa atrasar', config: 'nenhuma', porCron: true },
  { tipo: 'cartao_perto_atrasar', grupo: 'Data e horário', rotulo: 'A tarefa estiver perto de atrasar', config: 'horas_antes', porCron: true },
  { tipo: 'sla_estourado', grupo: 'Data e horário', rotulo: 'A tarefa ultrapassar o tempo máximo (SLA) da etapa', config: 'nenhuma', porCron: true },
  { tipo: 'sla_perto_estourar', grupo: 'Data e horário', rotulo: 'A tarefa estiver perto do tempo máximo (SLA) da etapa', config: 'horas_antes', porCron: true },

  { tipo: 'aprovacao_solicitada', grupo: 'Gerenciamento de status', rotulo: 'Solicitar aprovação da tarefa', config: 'nenhuma' },
  { tipo: 'cartao_aprovado', grupo: 'Gerenciamento de status', rotulo: 'A tarefa for aprovada', config: 'nenhuma' },
  { tipo: 'cartao_reprovado', grupo: 'Gerenciamento de status', rotulo: 'A tarefa for reprovada', config: 'nenhuma' },

  { tipo: 'tag_adicionada', grupo: 'Categorização', rotulo: 'Adicionar tags na tarefa', config: 'etiqueta' },
  { tipo: 'tag_removida', grupo: 'Categorização', rotulo: 'Remover tags da tarefa', config: 'etiqueta' },
]

export type GrupoAcao = 'Criação' | 'Movimentação' | 'Status da tarefa' | 'Alocação' | 'Notificação' | 'Campos'

export type TipoAcao =
  | 'criar_tarefa'
  | 'criar_subtarefa'
  | 'mover_cartao'
  | 'solicitar_aprovacao'
  | 'marcar_urgente'
  | 'desmarcar_urgente'
  | 'adicionar_responsavel'
  | 'remover_responsavel'
  | 'adicionar_seguidor'
  | 'remover_seguidor'
  | 'enviar_email'
  | 'alterar_campo'

/** Que formulário a ação precisa no "Então". */
export type ConfigAcao = 'nenhuma' | 'titulo' | 'coluna_destino' | 'colaborador' | 'email' | 'campo'

export type DefinicaoAcao = {
  tipo: TipoAcao
  grupo: GrupoAcao
  rotulo: string
  config: ConfigAcao
  /** Texto extra na UI quando a ação não faz exatamente o que o nome sugere. */
  nota?: string
}

export const ACOES: DefinicaoAcao[] = [
  { tipo: 'criar_tarefa', grupo: 'Criação', rotulo: 'Criar tarefa', config: 'titulo' },
  { tipo: 'criar_subtarefa', grupo: 'Criação', rotulo: 'Criar subtarefa', config: 'titulo' },

  // O executor aceita colunaId de qualquer quadro (mover cruza quadro), mas o
  // seletor da UI só lista as etapas do quadro atual — o rótulo reflete só o
  // que dá pra configurar hoje, pra não prometer um destino que não existe no
  // formulário.
  { tipo: 'mover_cartao', grupo: 'Movimentação', rotulo: 'Mover tarefa de etapa', config: 'coluna_destino' },

  { tipo: 'solicitar_aprovacao', grupo: 'Status da tarefa', rotulo: 'Solicitar aprovação da tarefa', config: 'colaborador' },
  // Este schema não tem flag de urgência separada — o rótulo diz o que a ação
  // realmente grava, pra não prometer um campo que não existe.
  { tipo: 'marcar_urgente', grupo: 'Status da tarefa', rotulo: 'Marcar como urgente (prioridade alta)', config: 'nenhuma' },
  { tipo: 'desmarcar_urgente', grupo: 'Status da tarefa', rotulo: 'Desmarcar urgente (prioridade média)', config: 'nenhuma' },

  { tipo: 'adicionar_responsavel', grupo: 'Alocação', rotulo: 'Adicionar alocado na tarefa', config: 'colaborador' },
  { tipo: 'remover_responsavel', grupo: 'Alocação', rotulo: 'Remover alocado da tarefa', config: 'colaborador' },
  { tipo: 'adicionar_seguidor', grupo: 'Alocação', rotulo: 'Adicionar seguidor na tarefa', config: 'colaborador' },
  { tipo: 'remover_seguidor', grupo: 'Alocação', rotulo: 'Remover seguidor da tarefa', config: 'colaborador' },

  { tipo: 'enviar_email', grupo: 'Notificação', rotulo: 'Enviar e-mail', config: 'email' },

  { tipo: 'alterar_campo', grupo: 'Campos', rotulo: 'Alterar ou remover campo', config: 'campo' },
]

// --- Casamento de evento (puro) ------------------------------------------

/**
 * Teto de encadeamento. Uma automação que move o card dispara "entrou na
 * etapa" de novo, que pode disparar outra — encadear é uso legítimo (a
 * automação "TRIAGEM" de referência move o card 5 vezes), mas duas automações
 * que se chamam em ciclo rodariam para sempre. Ao bater no teto o corte é
 * registrado com status 'cortado', senão a automação simplesmente "não roda"
 * sem ninguém entender o motivo.
 */
export const PROFUNDIDADE_MAXIMA = 3

export type DadosEvento = {
  /** Coluna relevante: destino em "entrou", origem em "saiu". */
  colunaId?: string
  etiquetaId?: string
}

/**
 * Decide se uma automação responde a este evento. Puro de propósito: é a
 * regra mais fácil de quebrar sem perceber, e testá-la clicando exigiria
 * montar um quadro inteiro.
 */
export function automacaoCasa(
  automacao: { evento: string; evento_config: unknown },
  evento: string,
  dados: DadosEvento = {}
): boolean {
  if (automacao.evento !== evento) return false

  const config = (automacao.evento_config ?? {}) as { colunaId?: string; etiquetaId?: string }

  // Config vazia = "qualquer etapa" / "qualquer tag". Só filtra quando a
  // automação nomeou um alvo específico.
  if (config.colunaId && config.colunaId !== dados.colunaId) return false
  if (config.etiquetaId && config.etiquetaId !== dados.etiquetaId) return false

  return true
}

/** Ordena as ações de uma automação. `ordem` empatada cai no id, pra execução ser determinística. */
export function ordenarAcoes<T extends { ordem: number; id: string }>(acoes: T[]): T[] {
  return acoes.slice().sort((a, b) => a.ordem - b.ordem || a.id.localeCompare(b.id))
}

/**
 * A partir de que momento vale reexecutar uma automação para o mesmo card.
 *
 * Existe porque os eventos do cron descrevem um ESTADO ("está atrasado"),
 * não um acontecimento pontual. Sem isso, toda varredura redispara para o
 * mesmo card — um card atrasado mandaria e-mail (ou criaria subtarefa) em
 * todo ciclo, para sempre. Eventos disparados por mutação não precisam:
 * acontecem uma vez e pronto.
 *
 * - `etapa`: a condição zera quando o card muda de coluna (`etapa_desde`).
 * - `edicao`: zera quando o card é editado (`updated_at`) — é o sinal
 *   disponível de "o prazo pode ter mudado", já que não há timestamp
 *   próprio para alteração de prazo.
 * - `null`: evento pontual, sem dedupe.
 */
export function ancoraDedupe(evento: string): 'etapa' | 'edicao' | null {
  switch (evento) {
    case 'sla_estourado':
    case 'sla_perto_estourar':
      return 'etapa'
    case 'cartao_atrasou':
    case 'cartao_perto_atrasar':
      return 'edicao'
    default:
      return null
  }
}

export const EVENTO_POR_TIPO = new Map(EVENTOS.map((e) => [e.tipo, e]))
export const ACAO_POR_TIPO = new Map(ACOES.map((a) => [a.tipo, a]))

// --- Validação da configuração (pura) -------------------------------------

/**
 * Diz o que falta para uma ação estar configurada, ou null se está completa.
 *
 * Existe porque o executor já rejeita ação incompleta (`throw new Error`), mas
 * só na hora em que o evento acontece — a automação era salva "com sucesso" e
 * só falhava dias depois, num card real, com o erro escondido no log. Aqui a
 * mesma regra é aplicada ANTES de salvar, na tela e no servidor.
 *
 * A mensagem é a que aparece pro gestor, então nomeia o campo que falta.
 */
export function faltaNaAcao(tipo: string, config: Record<string, unknown>): string | null {
  const preenchido = (chave: string) => typeof config[chave] === 'string' && (config[chave] as string).trim() !== ''

  switch (ACAO_POR_TIPO.get(tipo as TipoAcao)?.config) {
    case 'titulo':
      return preenchido('titulo') ? null : 'Informe o título da tarefa a criar.'
    case 'coluna_destino':
      return preenchido('colunaId') ? null : 'Escolha a etapa de destino.'
    case 'colaborador':
      return preenchido('colaboradorId') ? null : 'Escolha a pessoa.'
    case 'email':
      return preenchido('destinatario') ? null : 'Informe o destinatário do e-mail.'
    case 'campo':
      // Campo fixo grava `campo`; customizado grava `campoId`. Valor vazio é
      // legítimo — é como se limpa o campo.
      return preenchido('campo') || preenchido('campoId') ? null : 'Escolha o campo a alterar.'
    default:
      return null
  }
}

export function rotuloEvento(tipo: string): string {
  return EVENTO_POR_TIPO.get(tipo as TipoEvento)?.rotulo ?? tipo
}

export function rotuloAcao(tipo: string): string {
  return ACAO_POR_TIPO.get(tipo as TipoAcao)?.rotulo ?? tipo
}

/** Agrupa preservando a ordem de declaração — os selects da UI espelham isso. */
export function agruparEventos(): { grupo: GrupoEvento; itens: DefinicaoEvento[] }[] {
  return agrupar(EVENTOS, (e) => e.grupo)
}

export function agruparAcoes(): { grupo: GrupoAcao; itens: DefinicaoAcao[] }[] {
  return agrupar(ACOES, (a) => a.grupo)
}

function agrupar<T, G extends string>(itens: T[], chave: (item: T) => G): { grupo: G; itens: T[] }[] {
  const mapa = new Map<G, T[]>()
  for (const item of itens) {
    const g = chave(item)
    const lista = mapa.get(g) ?? []
    lista.push(item)
    mapa.set(g, lista)
  }
  return [...mapa.entries()].map(([grupo, itens]) => ({ grupo, itens }))
}
