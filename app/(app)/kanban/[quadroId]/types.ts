import type {
  PrioridadeCartao,
  TipoCampoFormulario,
  MapeamentoCampoFormulario,
  TipoCartao,
  TipoComentarioCartao,
  StatusAprovacaoCartao,
} from '@/lib/database.types'

export type Coluna = { id: string; quadro_id: string; nome: string; posicao: number }

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
  tagReferencia: string | null
  recorrencia: { tipo: 'diaria' | 'semanal' | 'mensal' } | null
}

export type Etiqueta = { id: string; nome: string; cor: string }

export type MembroQuadro = { id: string; nome: string }

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
  solicitadoPor: string
  solicitadoPorNome: string | null
  aprovadorId: string
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
  campos: CampoFormulario[]
}
