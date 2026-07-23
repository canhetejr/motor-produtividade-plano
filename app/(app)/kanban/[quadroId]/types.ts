import type { PrioridadeCartao, TipoCampoFormulario, MapeamentoCampoFormulario } from '@/lib/database.types'

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
}

export type Etiqueta = { id: string; nome: string; cor: string }

export type MembroQuadro = { id: string; nome: string }

export type Quadro = { id: string; nome: string; descricao: string | null; codigo: string; ativo: boolean }

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
