import { htmlParaTexto } from './rich-text-texto'

export type CartaoGoogle = {
  id: string
  codigo: string
  titulo: string
  descricao: string | null
  prazo: string
  prioridade: string
  tipo: string
  tag_referencia: string | null
  tempo_estimado_min: number | null
  updated_at: string
  demanda: { nome: string } | null
  coluna: { nome: string; quadro_id: string; quadro: { nome: string } | null }
}

export type EventoGooglePayload = {
  summary: string
  description: string
  start: { date: string }
  end: { date: string }
  source?: { title: string; url: string }
  extendedProperties: { private: Record<string, string> }
}

function proximoDia(data: string) {
  const value = new Date(`${data}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + 1)
  return value.toISOString().slice(0, 10)
}

function rotuloPrioridade(prioridade: string) {
  return ({ baixa: 'Baixa', media: 'Média', alta: 'Alta' } as Record<string, string>)[prioridade] ?? prioridade
}

function linkDoCartao(cartao: CartaoGoogle) {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
  return base ? `${base}/kanban/${cartao.coluna.quadro_id}?cartao=${cartao.id}` : null
}

export function montarEventoGoogle(
  cartao: CartaoGoogle,
  detalhes: {
    responsaveis: string[]
    etiquetas: string[]
    checklist: { total: number; concluidos: number }
  }
): EventoGooglePayload {
  const link = linkDoCartao(cartao)
  const descricao = htmlParaTexto(cartao.descricao).trim()
  const linhas = [
    descricao || 'Sem descrição.',
    '',
    `Quadro: ${cartao.coluna.quadro?.nome ?? '—'}`,
    `Etapa: ${cartao.coluna.nome}`,
    cartao.demanda ? `Demanda: ${cartao.demanda.nome}` : null,
    `Prioridade: ${rotuloPrioridade(cartao.prioridade)}`,
    `Tipo: ${cartao.tipo}`,
    detalhes.responsaveis.length > 0 ? `Responsáveis: ${detalhes.responsaveis.join(', ')}` : null,
    detalhes.etiquetas.length > 0 ? `Etiquetas: ${detalhes.etiquetas.join(', ')}` : null,
    detalhes.checklist.total > 0
      ? `Checklist: ${detalhes.checklist.concluidos} de ${detalhes.checklist.total} concluídos`
      : null,
    cartao.tempo_estimado_min ? `Tempo estimado: ${cartao.tempo_estimado_min} min` : null,
    cartao.tag_referencia ? `Referência: ${cartao.tag_referencia}` : null,
  ].filter((linha): linha is string => Boolean(linha))

  return {
    summary: `[${cartao.codigo}] ${cartao.titulo}`,
    description: linhas.join('\n'),
    start: { date: cartao.prazo },
    end: { date: proximoDia(cartao.prazo) },
    ...(link ? { source: { title: 'Clique aqui para visualizar no Vértice', url: link } } : {}),
    extendedProperties: {
      private: {
        vertice_card_id: cartao.id,
        vertice_updated_at: cartao.updated_at,
        vertice_board_id: cartao.coluna.quadro_id,
      },
    },
  }
}
