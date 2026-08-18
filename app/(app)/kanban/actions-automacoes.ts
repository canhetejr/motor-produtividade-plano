'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireGestor, requireUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { EVENTO_POR_TIPO, ACAO_POR_TIPO, faltaNaAcao, rotuloAcao } from '@/lib/automacoes-catalogo'
import type { ActionResult } from '@/lib/action-result'
import type { Json, StatusExecucaoAutomacao } from '@/lib/database.types'
import type { Automacao } from './[quadroId]/types'

// CRUD das automações (bloco 31). Quem EXECUTA é lib/automacoes.ts, chamado
// pelas actions que causam os eventos — aqui só se lê e escreve a definição.
//
// Mexer numa automação afeta todo card do quadro, então é ação de gestor;
// listar é de qualquer membro (a tela mostra o que está rodando).

const acaoSchema = z.object({
  tipo: z.string().refine((t) => ACAO_POR_TIPO.has(t as never), 'Ação desconhecida'),
  config: z.record(z.string(), z.unknown()).catch({}),
})

const automacaoSchema = z.object({
  nome: z.string().trim().min(1, 'Dê um nome para a automação').max(80, 'Nome muito longo (máx. 80 caracteres)'),
  evento: z.string().refine((e) => EVENTO_POR_TIPO.has(e as never), 'Evento desconhecido'),
  eventoConfig: z.record(z.string(), z.unknown()).catch({}),
  acoes: z.array(acaoSchema).min(1, 'Adicione pelo menos uma ação'),
})

export type AutomacaoInput = z.input<typeof automacaoSchema>

export async function listarAutomacoes(quadroId: string): Promise<ActionResult<Automacao[]>> {
  await requireUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('automacoes')
    .select(
      'id, nome, ativa, posicao, evento, evento_config, colaboradores:criado_por(nome), automacoes_acoes(id, ordem, tipo, config)'
    )
    .eq('quadro_id', quadroId)
    .order('posicao')
  if (error) return { ok: false, error: 'Falha ao carregar as automações.' }

  const ids = (data ?? []).map((a) => a.id)

  // Resumo do log em uma consulta só: a tela precisa do último status (badge
  // "com erro") e do total de execuções, não do log inteiro.
  const { data: execucoes } = ids.length > 0
    ? await supabase
        .from('automacoes_execucoes')
        .select('automacao_id, status, executado_em, erro')
        .in('automacao_id', ids)
        .order('executado_em', { ascending: false })
    : { data: [] }

  const ultimoStatus = new Map<string, StatusExecucaoAutomacao>()
  const ultimoErro = new Map<string, string>()
  const ultimaEm = new Map<string, string>()
  const totais = new Map<string, number>()
  for (const e of execucoes ?? []) {
    if (!ultimoStatus.has(e.automacao_id)) {
      ultimoStatus.set(e.automacao_id, e.status as StatusExecucaoAutomacao)
      ultimaEm.set(e.automacao_id, e.executado_em)
      // O motivo só interessa quando a última execução falhou: erro antigo,
      // já resolvido por uma execução 'ok' depois, alarmaria à toa.
      if (e.erro) ultimoErro.set(e.automacao_id, e.erro)
    }
    totais.set(e.automacao_id, (totais.get(e.automacao_id) ?? 0) + 1)
  }

  const automacoes: Automacao[] = (data ?? []).map((a) => ({
    id: a.id,
    nome: a.nome,
    ativa: a.ativa,
    posicao: a.posicao,
    evento: a.evento,
    eventoConfig: (a.evento_config ?? {}) as Record<string, unknown>,
    criadoPorNome: (a.colaboradores as unknown as { nome: string } | null)?.nome ?? null,
    acoes: ((a.automacoes_acoes ?? []) as { id: string; ordem: number; tipo: string; config: unknown }[])
      .map((ac) => ({ ...ac, config: (ac.config ?? {}) as Record<string, unknown> }))
      .sort((x, y) => x.ordem - y.ordem),
    ultimoStatus: ultimoStatus.get(a.id) ?? null,
    ultimoErro: ultimoErro.get(a.id) ?? null,
    ultimaExecucaoEm: ultimaEm.get(a.id) ?? null,
    totalExecucoes: totais.get(a.id) ?? 0,
  }))

  return { ok: true, data: automacoes }
}

export async function salvarAutomacao(
  quadroId: string,
  entrada: AutomacaoInput,
  automacaoId?: string
): Promise<ActionResult<{ id: string }>> {
  const { user, profile } = await requireGestor()
  const supabase = await createClient()

  const parsed = automacaoSchema.safeParse(entrada)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  // Ação incompleta era aceita aqui e só estourava lá na frente, dentro do
  // executor, num card real — o gestor via "automação salva" e depois um badge
  // de erro sem explicação. A mesma regra roda na tela, mas repetir no
  // servidor é o que garante: a action é chamável sem passar pelo formulário.
  for (const [i, acao] of parsed.data.acoes.entries()) {
    const falta = faltaNaAcao(acao.tipo, acao.config)
    if (falta) return { ok: false, error: `Ação #${i + 1} (${rotuloAcao(acao.tipo)}): ${falta}` }
  }

  let id = automacaoId

  if (id) {
    const { error } = await supabase
      .from('automacoes')
      .update({
        nome: parsed.data.nome,
        evento: parsed.data.evento,
        evento_config: parsed.data.eventoConfig as Json,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (error) return { ok: false, error: 'Falha ao salvar a automação.' }

    // Ações são substituídas por inteiro: são poucas e ordenadas, e casar
    // item a item complicaria sem ganho.
    await supabase.from('automacoes_acoes').delete().eq('automacao_id', id)
  } else {
    const { count } = await supabase
      .from('automacoes')
      .select('id', { count: 'exact', head: true })
      .eq('quadro_id', quadroId)

    const { data: criada, error } = await supabase
      .from('automacoes')
      .insert({
        quadro_id: quadroId,
        nome: parsed.data.nome,
        evento: parsed.data.evento,
        evento_config: parsed.data.eventoConfig as Json,
        posicao: count ?? 0,
        criado_por: user.id,
        organizacao_id: profile.organizacao_id,
      })
      .select('id')
      .single()
    if (error || !criada) return { ok: false, error: 'Falha ao criar a automação.' }
    id = criada.id
  }

  const { error: acoesError } = await supabase.from('automacoes_acoes').insert(
    parsed.data.acoes.map((acao, ordem) => ({
      automacao_id: id,
      ordem,
      tipo: acao.tipo,
      config: acao.config as Json,
      organizacao_id: profile.organizacao_id,
    }))
  )
  if (acoesError) return { ok: false, error: 'Automação salva, mas falhou ao gravar as ações.' }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true, data: { id } }
}

export async function alternarAutomacaoAtiva(id: string, quadroId: string, ativa: boolean): Promise<ActionResult> {
  await requireGestor()
  const supabase = await createClient()

  const { error } = await supabase.from('automacoes').update({ ativa }).eq('id', id)
  if (error) return { ok: false, error: 'Falha ao alterar a automação.' }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}

export async function excluirAutomacao(id: string, quadroId: string): Promise<ActionResult> {
  await requireGestor()
  const supabase = await createClient()

  const { error } = await supabase.from('automacoes').delete().eq('id', id)
  if (error) return { ok: false, error: 'Falha ao excluir a automação.' }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}

export async function duplicarAutomacao(id: string, quadroId: string): Promise<ActionResult> {
  const { user, profile } = await requireGestor()
  const supabase = await createClient()

  const { data: original, error } = await supabase
    .from('automacoes')
    .select('nome, evento, evento_config, automacoes_acoes(ordem, tipo, config)')
    .eq('id', id)
    .single()
  if (error || !original) return { ok: false, error: 'Automação não encontrada.' }

  const { count } = await supabase
    .from('automacoes')
    .select('id', { count: 'exact', head: true })
    .eq('quadro_id', quadroId)

  const { data: copia, error: copiaError } = await supabase
    .from('automacoes')
    .insert({
      quadro_id: quadroId,
      nome: `(cópia) ${original.nome}`,
      evento: original.evento,
      evento_config: original.evento_config,
      // Cópia nasce desligada: duplicar pra depois ajustar é o uso normal, e
      // uma cópia idêntica ativa rodaria a mesma ação duas vezes.
      ativa: false,
      posicao: count ?? 0,
      criado_por: user.id,
      organizacao_id: profile.organizacao_id,
    })
    .select('id')
    .single()
  if (copiaError || !copia) return { ok: false, error: 'Falha ao duplicar a automação.' }

  const acoes = (original.automacoes_acoes ?? []) as { ordem: number; tipo: string; config: unknown }[]
  if (acoes.length > 0) {
    await supabase.from('automacoes_acoes').insert(
      acoes.map((a) => ({
        automacao_id: copia.id,
        ordem: a.ordem,
        tipo: a.tipo,
        config: a.config as Json,
        organizacao_id: profile.organizacao_id,
      }))
    )
  }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}

export async function reordenarAutomacoes(quadroId: string, ids: string[]): Promise<ActionResult> {
  await requireGestor()
  const supabase = await createClient()

  const resultados = await Promise.all(
    ids.map((id, posicao) => supabase.from('automacoes').update({ posicao }).eq('id', id))
  )
  if (resultados.some((r) => r.error)) return { ok: false, error: 'Falha ao reordenar as automações.' }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}
