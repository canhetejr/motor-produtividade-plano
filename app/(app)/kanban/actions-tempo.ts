'use server'

import { revalidatePath } from 'next/cache'
import { requireGestor, requireUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { parseTempo } from '@/lib/tempo'
import type { ActionResult } from '@/lib/action-result'
import type { SessaoTempo } from './[quadroId]/types'

function calcularMinutos(iniciadoEm: string): number {
  const inicio = new Date(iniciadoEm).getTime()
  const diffMs = Math.max(0, Date.now() - inicio)
  return Math.round(diffMs / 60000)
}

async function finalizarSessaoAberta(colaboradorId: string) {
  const supabase = await createClient()
  const { data: aberta } = await supabase
    .from('cartoes_sessoes_tempo')
    .select('id, iniciado_em')
    .eq('colaborador_id', colaboradorId)
    .is('finalizado_em', null)
    .maybeSingle()

  if (!aberta) return

  const inicio = new Date(aberta.iniciado_em).getTime()
  const diffMs = Math.max(0, Date.now() - inicio)
  const minutos = Math.round(diffMs / 60000)

  if (minutos === 0) {
    await supabase.from('cartoes_sessoes_tempo').delete().eq('id', aberta.id)
    return
  }

  await supabase
    .from('cartoes_sessoes_tempo')
    .update({ finalizado_em: new Date().toISOString(), minutos })
    .eq('id', aberta.id)
}

export async function iniciarTimer(cartaoId: string, quadroId: string): Promise<ActionResult> {
  const { user } = await requireUser()
  const supabase = await createClient()

  await finalizarSessaoAberta(user.id)

  const { error } = await supabase.from('cartoes_sessoes_tempo').insert({
    cartao_id: cartaoId,
    colaborador_id: user.id,
    iniciado_em: new Date().toISOString()
  })
  if (error) {
    console.error('iniciarTimer error:', error)
    return { ok: false, error: 'Falha ao iniciar o timer.' }
  }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}

export async function pausarTimer(quadroId: string): Promise<ActionResult> {
  const { user } = await requireUser()
  await finalizarSessaoAberta(user.id)

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}

export async function obterSessaoAberta(): Promise<ActionResult<SessaoTempo | null>> {
  const { user } = await requireUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('cartoes_sessoes_tempo')
    .select('id, cartao_id, iniciado_em, finalizado_em, minutos, cartoes(titulo, colunas(quadro_id))')
    .eq('colaborador_id', user.id)
    .is('finalizado_em', null)
    .maybeSingle()

  if (error) return { ok: false, error: 'Falha ao carregar o timer.' }
  if (!data) return { ok: true, data: null }

  const cartaoInfo = data.cartoes as unknown as { titulo: string; colunas: { quadro_id: string } | null } | null

  return {
    ok: true,
    data: {
      id: data.id,
      cartaoId: data.cartao_id,
      cartaoTitulo: cartaoInfo?.titulo,
      quadroId: cartaoInfo?.colunas?.quadro_id,
      iniciadoEm: data.iniciado_em,
      finalizadoEm: data.finalizado_em,
      minutos: data.minutos,
    },
  }
}

export async function listarTempoCartao(cartaoId: string): Promise<ActionResult<{ totalMinutos: number; totalSegundos: number; sessoes: SessaoTempo[] }>> {
  await requireUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('cartoes_sessoes_tempo')
    .select('id, cartao_id, iniciado_em, finalizado_em, minutos')
    .eq('cartao_id', cartaoId)
    .order('iniciado_em', { ascending: false })

  if (error) {
    console.error('listarTempoCartao error:', error)
    return { ok: false, error: 'Falha ao carregar o tempo do card.' }
  }

  const sessoes: SessaoTempo[] = (data ?? []).map((s) => ({
    id: s.id,
    cartaoId: s.cartao_id,
    iniciadoEm: s.iniciado_em,
    finalizadoEm: s.finalizado_em,
    minutos: s.minutos,
  }))

  const totalSegundos = sessoes.reduce((soma, s) => {
    if (s.finalizadoEm && s.iniciadoEm) {
      if (s.iniciadoEm === s.finalizadoEm && s.minutos) {
        return soma + (s.minutos * 60)
      }
      const diffMs = Math.max(0, new Date(s.finalizadoEm).getTime() - new Date(s.iniciadoEm).getTime())
      return soma + Math.floor(diffMs / 1000)
    }
    return soma
  }, 0)

  const totalMinutos = Math.round(totalSegundos / 60)

  return { ok: true, data: { totalMinutos, totalSegundos, sessoes } }
}

export async function ajustarHorasRegistradas(
  cartaoId: string,
  quadroId: string,
  tempoInput: string,
  colaboradorIdAlvo?: string
): Promise<ActionResult> {
  const { user, profile } = await requireUser()

  const minutos = parseTempo(tempoInput)
  if (!minutos) return { ok: false, error: 'Informe um tempo válido (ex.: 01:30 ou 90).' }

  let colaboradorId = user.id
  if (colaboradorIdAlvo && colaboradorIdAlvo !== user.id) {
    if (profile.role !== 'gestor') return { ok: false, error: 'Apenas gestores podem ajustar horas de outra pessoa.' }
    await requireGestor()
    colaboradorId = colaboradorIdAlvo
  }

  const supabase = await createClient()
  const agora = new Date().toISOString()
  const { error } = await supabase.from('cartoes_sessoes_tempo').insert({
    cartao_id: cartaoId,
    colaborador_id: colaboradorId,
    iniciado_em: agora,
    finalizado_em: agora,
    minutos,
  })
  if (error) return { ok: false, error: 'Falha ao ajustar as horas registradas.' }

  await supabase.from('comentarios_cartao').insert({
    cartao_id: cartaoId,
    colaborador_id: user.id,
    conteudo: `Ajustou horas registradas: +${tempoInput.trim()}.`,
    tipo: 'sistema',
  })

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}
