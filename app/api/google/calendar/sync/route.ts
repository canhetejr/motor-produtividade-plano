import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { createAdminClient } from '@/utils/supabase/admin'
import { accessTokenFromRefreshToken, decifrarToken } from '@/lib/google-workspace'

export const dynamic = 'force-dynamic'

function nextDay(date: string) {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + 1)
  return value.toISOString().slice(0, 10)
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) return new NextResponse('Forbidden', { status: 403 })
  const { user } = await requireUser()
  const admin = createAdminClient()
  const { data: connection } = await admin.from('google_workspace_conexoes').select('refresh_token_cifrado').eq('colaborador_id', user.id).maybeSingle()
  if (!connection) return NextResponse.redirect(new URL('/perfil?google=nao-conectado', request.url), 303)
  try {
    const token = await accessTokenFromRefreshToken(decifrarToken(connection.refresh_token_cifrado))
    const { data: responsible, error } = await admin.from('cartoes_responsaveis').select('cartao_id, cartoes!inner(id, titulo, prazo, codigo, coluna_id, colunas!inner(quadro_id, quadros!inner(nome)))').eq('colaborador_id', user.id).not('cartoes.prazo', 'is', null)
    if (error) throw error
    const cards = (responsible ?? []).map((item) => Array.isArray(item.cartoes) ? item.cartoes[0] : item.cartoes).filter(Boolean) as Array<{ id: string; titulo: string; prazo: string; codigo: string; colunas: { quadro_id: string; quadros: { nome: string } } | Array<{ quadro_id: string; quadros: { nome: string } }> }>
    const { data: existing } = await admin.from('google_calendar_eventos').select('cartao_id, google_event_id').eq('colaborador_id', user.id)
    const ids = new Map((existing ?? []).map((event) => [event.cartao_id, event.google_event_id]))
    for (const card of cards) {
      const column = Array.isArray(card.colunas) ? card.colunas[0] : card.colunas
      const eventId = ids.get(card.id)
      const endpoint = eventId ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}` : 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
      const response = await fetch(endpoint, { method: eventId ? 'PUT' : 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, cache: 'no-store', body: JSON.stringify({ summary: `[${card.codigo}] ${card.titulo}`, description: `Prazo sincronizado do Vértice — quadro: ${column?.quadros?.nome ?? ''}`, start: { date: card.prazo }, end: { date: nextDay(card.prazo) }, extendedProperties: { private: { vertice_card_id: card.id } } }) })
      const event = await response.json() as { id?: string; error?: { message?: string } }
      if (!response.ok || !event.id) throw new Error(event.error?.message || 'Falha ao gravar prazo no Google Calendar.')
      await admin.from('google_calendar_eventos').upsert({ colaborador_id: user.id, cartao_id: card.id, google_event_id: event.id, atualizado_em: new Date().toISOString() })
    }
    return NextResponse.redirect(new URL(`/perfil?google=sincronizado&total=${cards.length}`, request.url), 303)
  } catch (error) {
    console.error('[google calendar sync]', error)
    return NextResponse.redirect(new URL('/perfil?google=erro', request.url), 303)
  }
}
