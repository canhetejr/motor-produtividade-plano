import 'server-only'

import { after } from 'next/server'

import { accessTokenFromRefreshToken, decifrarToken } from '@/lib/google-workspace'
import { montarEventoGoogle, type CartaoGoogle, type EventoGooglePayload } from '@/lib/google-calendar-payload'
import { createAdminClient } from '@/utils/supabase/admin'

export { montarEventoGoogle } from '@/lib/google-calendar-payload'

const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

export type ResultadoSincronizacaoGoogle = {
  sincronizados: number
  removidos: number
  semConexao: number
  falhas: number
}

async function apagarEvento(accessToken: string, eventId: string) {
  const response = await fetch(`${GOOGLE_CALENDAR_API}/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })
  if (!response.ok && response.status !== 404 && response.status !== 410) {
    const data = (await response.json().catch(() => null)) as { error?: { message?: string } } | null
    throw new Error(data?.error?.message || 'Falha ao remover o evento do Google Calendar.')
  }
}

async function gravarEvento(accessToken: string, eventId: string | undefined, payload: EventoGooglePayload) {
  const endpoint = eventId ? `${GOOGLE_CALENDAR_API}/${encodeURIComponent(eventId)}` : GOOGLE_CALENDAR_API
  let response = await fetch(endpoint, {
    method: eventId ? 'PATCH' : 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify(payload),
  })

  // O usuário pode ter apagado o evento diretamente no Google. Nesse caso o
  // vínculo local fica obsoleto e uma nova inclusão restaura a sincronização.
  if (eventId && (response.status === 404 || response.status === 410)) {
    response = await fetch(GOOGLE_CALENDAR_API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify(payload),
    })
  }

  const data = (await response.json().catch(() => null)) as { id?: string; error?: { message?: string } } | null
  if (!response.ok || !data?.id) throw new Error(data?.error?.message || 'Falha ao gravar o evento no Google Calendar.')
  return data.id
}

export async function sincronizarCartaoNoGoogle(cartaoId: string): Promise<ResultadoSincronizacaoGoogle> {
  const admin = createAdminClient()
  const resultado: ResultadoSincronizacaoGoogle = { sincronizados: 0, removidos: 0, semConexao: 0, falhas: 0 }

  const [{ data: cardData, error: cardError }, { data: responsaveisData }, { data: checklistData }, { data: etiquetasData }, { data: eventosData }] =
    await Promise.all([
      admin
        .from('cartoes')
        .select('id, codigo, titulo, descricao, prazo, prioridade, tipo, tag_referencia, tempo_estimado_min, updated_at, demandas(nome), colunas!inner(nome, quadro_id, quadros!inner(nome))')
        .eq('id', cartaoId)
        .maybeSingle(),
      admin.from('cartoes_responsaveis').select('colaborador_id, colaboradores(nome)').eq('cartao_id', cartaoId),
      admin.from('cartoes_checklist_itens').select('concluido').eq('cartao_id', cartaoId),
      admin.from('cartoes_etiquetas').select('etiquetas(nome)').eq('cartao_id', cartaoId),
      admin.from('google_calendar_eventos').select('colaborador_id, google_event_id').eq('cartao_id', cartaoId),
    ])

  if (cardError) throw cardError

  const responsaveis = (responsaveisData ?? []).map((item) => ({
    id: item.colaborador_id,
    nome: (item.colaboradores as unknown as { nome: string } | null)?.nome ?? '—',
  }))
  const responsavelIds = new Set(responsaveis.map((item) => item.id))
  const eventos = eventosData ?? []
  const idsComEvento = new Set(eventos.map((item) => item.colaborador_id))
  const todosIds = [...new Set([...responsavelIds, ...idsComEvento])]

  if (todosIds.length === 0) return resultado

  const { data: conexoes } = await admin
    .from('google_workspace_conexoes')
    .select('colaborador_id, refresh_token_cifrado')
    .in('colaborador_id', todosIds)
  const conexaoPorId = new Map((conexoes ?? []).map((item) => [item.colaborador_id, item.refresh_token_cifrado]))
  const eventoPorId = new Map(eventos.map((item) => [item.colaborador_id, item.google_event_id]))

  const colunaRaw = cardData?.colunas as unknown as
    | { nome: string; quadro_id: string; quadros: { nome: string } | Array<{ nome: string }> }
    | Array<{ nome: string; quadro_id: string; quadros: { nome: string } | Array<{ nome: string }> }>
    | null
  const coluna = Array.isArray(colunaRaw) ? colunaRaw[0] : colunaRaw
  const quadroRaw = coluna?.quadros
  const quadro = Array.isArray(quadroRaw) ? quadroRaw[0] : quadroRaw
  const demandaRaw = cardData?.demandas as unknown as { nome: string } | Array<{ nome: string }> | null
  const demanda = Array.isArray(demandaRaw) ? demandaRaw[0] : demandaRaw
  const cartao = cardData && coluna && cardData.prazo
    ? ({ ...cardData, prazo: cardData.prazo, demanda, coluna: { nome: coluna.nome, quadro_id: coluna.quadro_id, quadro } } as CartaoGoogle)
    : null

  const checklist = {
    total: checklistData?.length ?? 0,
    concluidos: (checklistData ?? []).filter((item) => item.concluido).length,
  }
  const etiquetas = (etiquetasData ?? [])
    .map((item) => (item.etiquetas as unknown as { nome: string } | null)?.nome)
    .filter((nome): nome is string => Boolean(nome))

  // Sem prazo, card excluído ou responsável removido: o evento deixa de
  // representar trabalho da pessoa e precisa sair do calendário.
  for (const evento of eventos) {
    if (cartao && responsavelIds.has(evento.colaborador_id)) continue
    const refreshToken = conexaoPorId.get(evento.colaborador_id)
    if (!refreshToken) {
      resultado.semConexao += 1
      continue
    }
    try {
      const token = await accessTokenFromRefreshToken(decifrarToken(refreshToken))
      await apagarEvento(token, evento.google_event_id)
      await admin.from('google_calendar_eventos').delete().eq('cartao_id', cartaoId).eq('colaborador_id', evento.colaborador_id)
      resultado.removidos += 1
    } catch (error) {
      resultado.falhas += 1
      console.error('[google calendar delete] card=%s collaborator=%s', cartaoId, evento.colaborador_id, error)
    }
  }

  if (!cartao) return resultado
  const payload = montarEventoGoogle(cartao, { responsaveis: responsaveis.map((item) => item.nome), etiquetas, checklist })

  for (const responsavel of responsaveis) {
    const refreshToken = conexaoPorId.get(responsavel.id)
    if (!refreshToken) {
      resultado.semConexao += 1
      continue
    }
    try {
      const token = await accessTokenFromRefreshToken(decifrarToken(refreshToken))
      const eventId = await gravarEvento(token, eventoPorId.get(responsavel.id), payload)
      await admin.from('google_calendar_eventos').upsert({
        colaborador_id: responsavel.id,
        cartao_id: cartaoId,
        google_event_id: eventId,
        atualizado_em: new Date().toISOString(),
      })
      resultado.sincronizados += 1
    } catch (error) {
      resultado.falhas += 1
      console.error('[google calendar sync] card=%s collaborator=%s', cartaoId, responsavel.id, error)
    }
  }

  return resultado
}

export function agendarSincronizacaoGoogle(cartaoId: string) {
  after(async () => {
    try {
      await sincronizarCartaoNoGoogle(cartaoId)
    } catch (error) {
      console.error('[google calendar scheduled sync] card=%s', cartaoId, error)
    }
  })
}

export async function removerEventosGoogleDoCartao(cartaoId: string) {
  const admin = createAdminClient()
  const { data: eventos } = await admin
    .from('google_calendar_eventos')
    .select('colaborador_id, google_event_id')
    .eq('cartao_id', cartaoId)
  if (!eventos?.length) return

  const ids = eventos.map((evento) => evento.colaborador_id)
  const { data: conexoes } = await admin
    .from('google_workspace_conexoes')
    .select('colaborador_id, refresh_token_cifrado')
    .in('colaborador_id', ids)
  const conexaoPorId = new Map((conexoes ?? []).map((item) => [item.colaborador_id, item.refresh_token_cifrado]))

  await Promise.allSettled(eventos.map(async (evento) => {
    const refreshToken = conexaoPorId.get(evento.colaborador_id)
    if (!refreshToken) return
    const token = await accessTokenFromRefreshToken(decifrarToken(refreshToken))
    await apagarEvento(token, evento.google_event_id)
  }))
}
