'use server'

import { revalidatePath } from 'next/cache'
import { requireGestor, requireUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { parseTempo, somarSegundosSessoes, fatiarSessaoPorDia, dataLocalISO } from '@/lib/tempo'
import { dispararEvento } from '@/lib/automacoes'
import type { ActionResult } from '@/lib/action-result'
import type { SessaoTempo } from './[quadroId]/types'

async function finalizarSessaoAberta(colaboradorId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data: aberta } = await supabase
    .from('cartoes_sessoes_tempo')
    .select('id, iniciado_em')
    .eq('colaborador_id', colaboradorId)
    .is('finalizado_em', null)
    .maybeSingle()

  if (!aberta) return null

  const inicio = new Date(aberta.iniciado_em).getTime()
  const diffMs = Math.max(0, Date.now() - inicio)

  // Só descarta clique acidental (play e pause no mesmo segundo). Qualquer
  // tempo real fica gravado: antes, `Math.round(diffMs / 60000) === 0`
  // APAGAVA a sessão, então trabalhar 40 segundos e pausar sumia com o tempo.
  if (diffMs < 1000) {
    await supabase.from('cartoes_sessoes_tempo').delete().eq('id', aberta.id)
    return null
  }

  // `minutos` é arredondado só porque a coluna é inteira e o CHECK exige um
  // valor. Quem soma o tempo de verdade é `somarSegundosSessoes`, que usa a
  // diferença entre os timestamps e tem precisão de segundo — por isso guardar
  // 0 aqui numa sessão de 40s não perde nada.
  const finalizadoEm = new Date().toISOString()
  await supabase
    .from('cartoes_sessoes_tempo')
    .update({ finalizado_em: finalizadoEm, minutos: Math.round(diffMs / 60000) })
    .eq('id', aberta.id)

  return lancarApontamentoDaSessao(aberta.id, aberta.iniciado_em, finalizadoEm)
}

/**
 * Transforma uma sessão fechada em apontamento, para o tempo do Kanban contar
 * no índice de produtividade (`indicadores_diarios` lê só de apontamentos).
 *
 * Best-effort de propósito: se o lançamento falhar — demanda inativa, sessão
 * acima da carga horária, rede — o pause do cronômetro já aconteceu e não pode
 * ser desfeito por causa disso. Mesma política de `criarNotificacao` e do
 * dispatcher de automações.
 *
 * Card sem demanda não gera nada, e a RPC devolve null sem erro: é um card que
 * ainda não foi ligado ao catálogo, não uma falha.
 */
async function lancarApontamentoDaSessao(sessaoId: string, iniciadoEm: string, finalizadoEm: string): Promise<string | null> {
  try {
    const supabase = await createClient()

    // Sessão que cruza a meia-noite é trabalho de dois dias; cada fatia vira
    // um apontamento na data certa. Ver `fatiarSessaoPorDia`.
    for (const fatia of fatiarSessaoPorDia(iniciadoEm, finalizadoEm)) {
      const { error } = await supabase.rpc('registrar_apontamento_timer', {
        p_sessao_id: sessaoId,
        p_data: fatia.data,
        p_minutos: fatia.minutos,
      })
      if (error) {
        console.error('Sessão %s não virou apontamento (%s): %s', sessaoId, fatia.data, error.message)
        return error.message === 'BLOCOS_FINITOS_ESGOTADOS'
          ? 'O tempo foi salvo no card, mas a demanda finita já esgotou todos os blocos.'
          : 'O tempo foi salvo no card, mas não entrou no índice de produtividade.'
      }
    }
  } catch (erro) {
    console.error('Falha ao lançar apontamento da sessão %s: %o', sessaoId, erro)
    return 'O tempo foi salvo no card, mas não entrou no índice de produtividade.'
  }
  return null
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

  await dispararEvento({ supabase, evento: 'play_ativado', cartaoId, quadroId, atorId: user.id })

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}

export async function pausarTimer(quadroId: string): Promise<ActionResult<{ aviso: string | null }>> {
  const { user } = await requireUser()
  const aviso = await finalizarSessaoAberta(user.id)

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true, data: { aviso } }
}

export async function obterSessaoAberta(): Promise<ActionResult<SessaoTempo | null>> {
  const { user } = await requireUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('cartoes_sessoes_tempo')
    .select('id, cartao_id, iniciado_em, finalizado_em, minutos, cartoes(titulo, tempo_estimado_min, colunas(quadro_id, nome))')
    .eq('colaborador_id', user.id)
    .is('finalizado_em', null)
    .maybeSingle()

  if (error) return { ok: false, error: 'Falha ao carregar o timer.' }
  if (!data) return { ok: true, data: null }

  // O widget precisa do histórico fechado apenas uma vez, quando a sessão é
  // aberta/trocada. O contador de segundos corre no cliente; assim não há uma
  // consulta ao banco a cada tick.
  const { data: sessoesFechadas } = await supabase
    .from('cartoes_sessoes_tempo')
    .select('iniciado_em, finalizado_em, minutos')
    .eq('cartao_id', data.cartao_id)
    .not('finalizado_em', 'is', null)

  const cartaoInfo = data.cartoes as unknown as {
    titulo: string
    tempo_estimado_min: number | null
    colunas: { quadro_id: string; nome: string } | null
  } | null

  return {
    ok: true,
    data: {
      id: data.id,
      cartaoId: data.cartao_id,
      cartaoTitulo: cartaoInfo?.titulo,
      quadroId: cartaoInfo?.colunas?.quadro_id,
      colunaNome: cartaoInfo?.colunas?.nome ?? null,
      tempoEstimadoMin: cartaoInfo?.tempo_estimado_min ?? null,
      tempoRegistradoSegundos: somarSegundosSessoes(
        (sessoesFechadas ?? []).map((sessao) => ({
          iniciadoEm: sessao.iniciado_em,
          finalizadoEm: sessao.finalizado_em,
          minutos: sessao.minutos,
        }))
      ),
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
    .select('id, cartao_id, colaborador_id, iniciado_em, finalizado_em, minutos, colaboradores(nome)')
    .eq('cartao_id', cartaoId)
    .order('iniciado_em', { ascending: false })

  if (error) {
    console.error('listarTempoCartao error:', error)
    return { ok: false, error: 'Falha ao carregar o tempo do card.' }
  }

  const sessoes: SessaoTempo[] = (data ?? []).map((s) => ({
    id: s.id,
    cartaoId: s.cartao_id,
    colaboradorId: s.colaborador_id,
    colaboradorNome: (s.colaboradores as unknown as { nome: string } | null)?.nome ?? null,
    iniciadoEm: s.iniciado_em,
    finalizadoEm: s.finalizado_em,
    minutos: s.minutos,
  }))

  const totalSegundos = somarSegundosSessoes(sessoes)
  const totalMinutos = Math.round(totalSegundos / 60)

  return { ok: true, data: { totalMinutos, totalSegundos, sessoes } }
}

// Corrigir tempo lançado errado só era possível somando mais tempo por cima
// (ajustarHorasRegistradas). Apagar a sessão é o caminho pra tirar.
export async function excluirSessaoTempo(sessaoId: string, quadroId: string): Promise<ActionResult> {
  const { user, profile } = await requireUser()
  const supabase = await createClient()

  const { data: sessao } = await supabase
    .from('cartoes_sessoes_tempo')
    .select('id, colaborador_id, finalizado_em')
    .eq('id', sessaoId)
    .maybeSingle()
  if (!sessao) return { ok: false, error: 'Sessão de tempo não encontrada.' }

  if (sessao.colaborador_id !== user.id && profile.role !== 'gestor') {
    return { ok: false, error: 'Só o dono da sessão ou um gestor pode excluí-la.' }
  }
  if (!sessao.finalizado_em) {
    return { ok: false, error: 'Pause o cronômetro antes de excluir esta sessão.' }
  }

  // Os apontamentos gerados por esta sessão caem junto — `cartao_sessao_id`
  // tem `on delete cascade` (bloco 32). Sem isso o índice seguiria contando
  // tempo de uma sessão que não existe mais.
  const { error } = await supabase.from('cartoes_sessoes_tempo').delete().eq('id', sessaoId)
  if (error) return { ok: false, error: 'Falha ao excluir a sessão de tempo.' }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
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
  const { data: sessao, error } = await supabase
    .from('cartoes_sessoes_tempo')
    .insert({
      cartao_id: cartaoId,
      colaborador_id: colaboradorId,
      iniciado_em: agora,
      finalizado_em: agora,
      minutos,
    })
    .select('id')
    .single()
  if (error || !sessao) return { ok: false, error: 'Falha ao ajustar as horas registradas.' }

  // Ajuste manual também é tempo declarado e precisa contar no índice. Não dá
  // pra reaproveitar `fatiarSessaoPorDia` aqui: a sessão de ajuste tem início
  // igual ao fim (duração zero no relógio), então o fatiamento devolveria
  // lista vazia. O tempo real está em `minutos`, lançado no dia de hoje —
  // dia LOCAL: `agora.slice(0, 10)` seria o dia em UTC, que depois das 21h
  // no Brasil já é amanhã.
  const { error: apontamentoError } = await supabase.rpc('registrar_apontamento_timer', {
    p_sessao_id: sessao.id,
    p_data: dataLocalISO(new Date()),
    p_minutos: minutos,
  })
  if (apontamentoError) {
    console.error('Ajuste de horas não virou apontamento: %s', apontamentoError.message)
  }

  await supabase.from('comentarios_cartao').insert({
    cartao_id: cartaoId,
    colaborador_id: user.id,
    conteudo: `Ajustou horas registradas: +${tempoInput.trim()}.`,
    tipo: 'sistema',
  })

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}
