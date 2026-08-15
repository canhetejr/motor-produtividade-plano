import type {
  PrioridadeCartao,
  TipoCampoFormulario,
  MapeamentoCampoFormulario,
  TipoCartao,
  TipoComentarioCartao,
  StatusAprovacaoCartao,
  TipoCampoCustomizado,
  StatusExecucaoAutomacao,
} from '@/lib/database.types'

/** Definição de um campo customizado do quadro (bloco 30). */
export type CampoCustomizado = {
  id: string
  nome: string
  tipo: TipoCampoCustomizado
  opcoes: string[]
  obrigatorio: boolean
  posicao: number
}

export type Automacao = {
  id: string
  nome: string
  ativa: boolean
  posicao: number
  evento: string
  eventoConfig: Record<string, unknown>
  criadoPorNome: string | null
  acoes: { id: string; ordem: number; tipo: string; config: Record<string, unknown> }[]
  /** Resumo do log, usado pelos badges de contagem da tela de automações. */
  ultimoStatus: StatusExecucaoAutomacao | null
  totalExecucoes: number
}

export type Coluna = {
  id: string
  quadro_id: string
  nome: string
  posicao: number
  // Etapa final entrega o card que entra nela (trigger cartoes_aplicar_entrega);
  // limiteWip null = sem teto de cards em andamento.
  etapaFinal: boolean
  limiteWip: number | null
  /** Teto de horas na etapa; alimenta os eventos de SLA das automações. */
  slaHoras: number | null
}

export type Cartao = {
  id: string
  coluna_id: string
  titulo: string
  descricao: string | null
  posicao: number
  prioridade: PrioridadeCartao
  prazo: string | null
  codigo: string
  responsaveis: string[]
  etiquetas: string[]
  tipo: TipoCartao
  cartaoPaiId: string | null
  inicioDesejado: string | null
  entregueEm: string | null
  tempoEstimadoMin: number | null
  centroId: string | null
  /** Demanda do catálogo em que o tempo deste card é lançado (bloco 32). */
  demandaId: string | null
  tagReferencia: string | null
  recorrencia: { tipo: 'diaria' | 'semanal' | 'mensal' } | null
  // Contadores agregados no servidor só para a face do card — o detalhe de
  // cada um é carregado sob demanda pelas abas do dialog.
  totalSubtarefas: number
  totalAnexos: number
  checklist: { total: number; concluidos: number }
  temAprovacaoPendente: boolean
  tempoRegistradoMin: number
  /** Soma do tempo das subtarefas — a terceira barra do bloco de tempo. */
  tempoSubtarefasMin: number
  /** Quando o card entrou na etapa atual (carimbado pelo trigger de movimentação). */
  etapaDesde: string | null
}

export type Etiqueta = { id: string; nome: string; cor: string }

export type MembroQuadro = { id: string; nome: string; avatarUrl: string | null; areaId: string | null }

/** Demanda do catálogo, para o seletor do card. */
export type DemandaOpcao = {
  id: string
  nome: string
  areaId: string
  areaNome: string
  tempoPadraoMin: number | null
  blocosTotais: number
  finita: boolean
  variavel: boolean
}

// Colaboradores ativos que existem mas não são membros deste quadro — exibidos
// desabilitados no seletor de responsáveis com um contador ("Não autorizados").
export type MembroNaoAutorizado = { id: string; nome: string }

export type Quadro = { id: string; nome: string; descricao: string | null; codigo: string; ativo: boolean }

export type Comentario = {
  id: string
  cartaoId: string
  colaboradorId: string
  colaboradorNome: string | null
  conteudo: string
  tipo: TipoComentarioCartao
  criadoEm: string
}

export type Subtarefa = {
  id: string
  titulo: string
  colunaId: string
  colunaNome: string
  tipo: TipoCartao
  responsaveis: string[]
  prioridade: PrioridadeCartao
}

export type ChecklistItem = { id: string; texto: string; concluido: boolean; posicao: number }

export type Anexo = {
  id: string
  nomeArquivo: string
  tamanhoBytes: number
  tipoMime: string
  colaboradorNome: string | null
  criadoEm: string
}

export type Requisito = { id: string; descricao: string; obrigatorio: boolean; concluido: boolean }

export type Predecessor = { id: string; titulo: string; codigo: string; entregue: boolean }

export type SequenciaResponsavel = {
  id: string
  colaboradorId: string
  colaboradorNome: string
  ordem: number
  entregue: boolean
}

export type Aprovacao = {
  id: string
  // Nulos desde a exclusão definitiva de colaborador (migration
  // 20260813120000): a aprovação é histórico do cartão e fica, mesmo quando
  // quem pediu ou quem decidiu já não tem cadastro.
  solicitadoPor: string | null
  solicitadoPorNome: string | null
  aprovadorId: string | null
  aprovadorNome: string | null
  status: StatusAprovacaoCartao
  comentario: string | null
  criadoEm: string
}

export type SessaoTempo = {
  id: string
  cartaoId: string
  cartaoTitulo?: string
  quadroId?: string
  colunaNome?: string | null
  tempoEstimadoMin?: number | null
  /** Tempo fechado no card; o tempo da sessão em aberto é somado no cliente. */
  tempoRegistradoSegundos?: number
  colaboradorId?: string
  colaboradorNome?: string | null
  iniciadoEm: string
  finalizadoEm: string | null
  minutos: number | null
}

export type CampoFormulario = {
  id: string
  rotulo: string
  tipo: TipoCampoFormulario
  placeholder: string
  obrigatorio: boolean
  opcoes: string[]
  mapeado_para: MapeamentoCampoFormulario
}

export type Formulario = {
  id: string
  coluna_id: string
  titulo: string
  descricao: string | null
  slug: string
  ativo: boolean
  cor_tema: string
  mensagem_sucesso: string
  mostrar_marca: boolean
  /** Modelos com variáveis ({{pergunta}}); null = texto padrão do código. */
  titulo_template: string | null
  descricao_template: string | null
  webhookAtivo: boolean
  webhookTokenPrefixo: string | null
  campos: CampoFormulario[]
}
