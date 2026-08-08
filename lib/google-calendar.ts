import 'server-only'

import { createHash } from 'crypto'
import { after } from 'next/server'

import { accessTokenFromRefreshToken, decifrarToken } from './google-workspace'
import { montarEventoGoogle, type CartaoGoogle, type EventoGooglePayload } from './google-calendar-payload'
import { createAdminClient } from '../utils/supabase/admin'

export { montarEventoGoogle } from './google-calendar-payload'

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

function idDeterministicoDoEvento(cartaoId: string, colaboradorId: string) {
  return createHash('sha256').update(`vertice:${cartaoId}:${colaboradorId}`).digest('hex').slice(0, 32)
}

async function enviarEvento(
  accessToken: string,
  method: 'POST' | 'PATCH',
  eventId: string | null,
  payload: EventoGooglePayload
) {
  return fetch(eventId ? `${GOOGLE_CALENDAR_API}/${encodeURIComponent(eventId)}` : GOOGLE_CALENDAR_API, {
    method,
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify(payload),
  })
}

async function gravarEvento(
  accessToken: string,
  eventId: string | undefined,
  cartaoId: string,
  colaboradorId: string,
  payload: EventoGooglePayload
) {
  const idDeterministico = idDeterministicoDoEvento(cartaoId, colaboradorId)
  let response = eventId
    ? await enviarEvento(accessToken, 'PATCH', eventId, payload)
    : await fetch(GOOGLE_CALENDAR_API, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ ...payload, id: idDeterministico }),
      })

  // O usuário pode ter apagado o evento diretamente no Google. Nesse caso o
  // vínculo local fica obsoleto e uma nova inclusão restaura a sincronização.
  if (eventId && (response.status === 404 || response.status === 410)) {
    response = await fetch(GOOGLE_CALENDAR_API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ ...payload, id: idDeterministico }),
    })
  }

  // Duas edições muito próximas podem tentar criar o mesmo evento antes que o
  // vínculo local seja gravado. O id determinístico transforma o conflito em
  // atualização, sem deixar uma cópia órfã no calendário.
  if (response.status === 409) {
    response = await enviarEvento(accessToken, 'PATCH', idDeterministico, payload)
  }

  const data = (await response.json().catch(() => null)) as { id?: string; error?: { message?: string } } | null
  if (!response.ok || !data?.id) throw new Error(data?.error?.message || 'Falha ao gravar o evento no Google Calendar.')
  return data.id
}

// Auditoria de organizacao_id (leva pendente): cartaoId aqui nunca vem de
// query string/body de uma rota pública — chega de agendarSincronizacaoGoogle
// (disparado por uma action já autorizada dentro da própria organização) ou
// do cron. A busca por `.eq('id', cartaoId)` é lookup de chave primária: não
// existe consulta de listagem aqui que um id de outra organização pudesse
// ampliar, então organizacao_id explícito não muda o resultado — mas fica
// registrado que a checagem foi feita, não esquecida.
export async function sincronizarCartaoNoGoogle(cartaoId: string): Promise<ResultadoSincronizacaoGoogle> {
  const admin = createAdminClient()
  const resultado: ResultadoSincronizacaoGoogle = { sincronizados: 0, removidos: 0, semConexao: 0, falhas: 0 }

  const [cardResult, responsaveisResult, checklistResult, etiquetasResult, eventosResult] =
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

  const erroLeitura = cardResult.error || responsaveisResult.error || checklistResult.error || etiquetasResult.error || eventosResult.error
  if (erroLeitura) throw erroLeitura
  const cardData = cardResult.data
  const responsaveisData = responsaveisResult.data
  const checklistData = checklistResult.data
  const etiquetasData = etiquetasResult.data
  const eventosData = eventosResult.data

  const responsaveis = (responsaveisData ?? []).map((item) => ({
    id: item.colaborador_id,
    nome: (item.colaboradores as unknown as { nome: string } | null)?.nome ?? '—',
  }))
  const responsavelIds = new Set(responsaveis.map((item) => item.id))
  const eventos = eventosData ?? []
  const idsComEvento = new Set(eventos.map((item) => item.colaborador_id))
  const todosIds = [...new Set([...responsavelIds, ...idsComEvento])]

  if (todosIds.length === 0) return resultado

  const { data: conexoes, error: conexoesError } = await admin
    .from('google_workspace_conexoes')
    .select('colaborador_id, refresh_token_cifrado')
    .in('colaborador_id', todosIds)
  if (conexoesError) throw conexoesError
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
      const { error: vinculoError } = await admin.from('google_calendar_eventos').delete().eq('cartao_id', cartaoId).eq('colaborador_id', evento.colaborador_id)
      if (vinculoError) throw vinculoError
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
      const eventId = await gravarEvento(token, eventoPorId.get(responsavel.id), cartaoId, responsavel.id, payload)
      const { error: vinculoError } = await admin.from('google_calendar_eventos').upsert({
        colaborador_id: responsavel.id,
        cartao_id: cartaoId,
        google_event_id: eventId,
        atualizado_em: new Date().toISOString(),
      })
      if (vinculoError) throw vinculoError
      resultado.sincronizados += 1
    } catch (error) {
      resultado.falhas += 1
      console.error('[google calendar sync] card=%s collaborator=%s', cartaoId, responsavel.id, error)
    }
  }

  return resultado
}

export async function sincronizarCartoesNoGoogle(
  cartaoIds: string[],
  concorrencia = 4,
  sincronizar: (cartaoId: string) => Promise<ResultadoSincronizacaoGoogle> = sincronizarCartaoNoGoogle
): Promise<ResultadoSincronizacaoGoogle> {
  const ids = [...new Set(cartaoIds)]
  const total: ResultadoSincronizacaoGoogle = { sincronizados: 0, removidos: 0, semConexao: 0, falhas: 0 }
  let proximo = 0

  async function trabalhador() {
    while (proximo < ids.length) {
      const cartaoId = ids[proximo++]
      try {
        const resultado = await sincronizar(cartaoId)
        total.sincronizados += resultado.sincronizados
        total.removidos += resultado.removidos
        total.semConexao += resultado.semConexao
        total.falhas += resultado.falhas
      } catch (error) {
        total.falhas += 1
        console.error('[google calendar batch sync] card=%s', cartaoId, error)
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(Math.max(1, concorrencia), ids.length) }, () => trabalhador()))
  return total
}

export function agendarSincronizacaoGoogleEmLote(cartaoIds: string[]) {
  const ids = [...new Set(cartaoIds)]
  if (ids.length === 0) return
  after(async () => {
    await sincronizarCartoesNoGoogle(ids)
  })
}

export function agendarSincronizacaoGoogle(cartaoId: string) {
  agendarSincronizacaoGoogleEmLote([cartaoId])
}

// organizacaoId é obrigatório: cartaoId chega de uma server action que só
// recebe o id do próprio client (app/(app)/kanban/actions.ts:excluirCartao),
// sem verificação prévia de que o card pertence a quem chamou — sem o
// filtro aqui, o client de service role apagaria evento de Google Calendar
// de um cartão de outra organização a partir de um id só adivinhado.
export async function removerEventosGoogleDoCartao(cartaoId: string, organizacaoId: string) {
  const admin = createAdminClient()
  const { data: eventos, error: eventosError } = await admin
    .from('google_calendar_eventos')
    .select('colaborador_id, google_event_id')
    .eq('cartao_id', cartaoId)
    .eq('organizacao_id', organizacaoId)
  if (eventosError) throw eventosError
  if (!eventos?.length) return

  const ids = eventos.map((evento) => evento.colaborador_id)
  const { data: conexoes, error: conexoesError } = await admin
    .from('google_workspace_conexoes')
    .select('colaborador_id, refresh_token_cifrado')
    .in('colaborador_id', ids)
  if (conexoesError) throw conexoesError
  const conexaoPorId = new Map((conexoes ?? []).map((item) => [item.colaborador_id, item.refresh_token_cifrado]))

  await Promise.all(eventos.map(async (evento) => {
    const refreshToken = conexaoPorId.get(evento.colaborador_id)
    if (!refreshToken) throw new Error('Conexão do Google indisponível para remover o evento.')
    const token = await accessTokenFromRefreshToken(decifrarToken(refreshToken))
    await apagarEvento(token, evento.google_event_id)
  }))
}

export async function removerEventosGoogleDoColaborador(colaboradorId: string) {
  const admin = createAdminClient()
  const [{ data: conexao, error: conexaoError }, { data: eventos, error: eventosError }] = await Promise.all([
    admin.from('google_workspace_conexoes').select('refresh_token_cifrado').eq('colaborador_id', colaboradorId).maybeSingle(),
    admin.from('google_calendar_eventos').select('google_event_id').eq('colaborador_id', colaboradorId),
  ])
  if (conexaoError || eventosError) throw conexaoError || eventosError
  if (!eventos?.length) return
  if (!conexao) throw new Error('Conexão do Google indisponível para remover os eventos.')

  const token = await accessTokenFromRefreshToken(decifrarToken(conexao.refresh_token_cifrado))
  await Promise.all(eventos.map((evento) => apagarEvento(token, evento.google_event_id)))
  const { error: exclusaoError } = await admin.from('google_calendar_eventos').delete().eq('colaborador_id', colaboradorId)
  if (exclusaoError) throw exclusaoError
}
