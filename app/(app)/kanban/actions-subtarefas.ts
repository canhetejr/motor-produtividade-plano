'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import type { ActionResult } from '@/lib/action-result'
import type { PrioridadeCartao, TipoCartao } from '@/lib/database.types'
import type { Subtarefa } from './[quadroId]/types'

// Subtarefa é só um `cartao` com `cartao_pai_id` setado — herda de graça
// responsáveis/etiquetas/comentários/etapa (ver nota em
// supabase/migrations/20260729100000_kanban_cartoes_campos_novos.sql).
// Geração por IA fica pra depois; aqui é só o CRUD manual.

const tituloSchema = z.string().trim().min(1, 'Informe o título da subtarefa')

export async function criarSubtarefa(cartaoPaiId: string, quadroId: string, titulo: string): Promise<ActionResult<{ id: string }>> {
  const { user, profile } = await requireUser()
  const supabase = await createClient()

  const parsed = tituloSchema.safeParse(titulo)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const { data: pai, error: paiError } = await supabase
    .from('cartoes')
    .select('coluna_id, demanda_id')
    .eq('id', cartaoPaiId)
    .single()
  if (paiError || !pai) return { ok: false, error: 'Card pai não encontrado.' }

  const { count } = await supabase.from('cartoes').select('id', { count: 'exact', head: true }).eq('coluna_id', pai.coluna_id)

  const { data: subtarefa, error } = await supabase
    .from('cartoes')
    .insert({
      coluna_id: pai.coluna_id,
      titulo: parsed.data,
      cartao_pai_id: cartaoPaiId,
      // Herda a demanda do pai: o bloco de tempo do card soma "tempo nas
      // subtarefas", então as pessoas cronometram nelas — sem demanda esse
      // tempo não viraria apontamento.
      demanda_id: pai.demanda_id,
      posicao: count ?? 0,
      criado_por: user.id,
      organizacao_id: profile.organizacao_id,
    })
    .select('id')
    .single()

  if (error || !subtarefa) return { ok: false, error: 'Falha ao criar a subtarefa.' }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true, data: { id: subtarefa.id } }
}

export async function listarSubtarefas(cartaoPaiId: string): Promise<ActionResult<Subtarefa[]>> {
  await requireUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('cartoes')
    .select('id, titulo, coluna_id, tipo, prioridade, colunas(nome), cartoes_responsaveis(colaborador_id)')
    .eq('cartao_pai_id', cartaoPaiId)
    .order('posicao')

  if (error) return { ok: false, error: 'Falha ao carregar as subtarefas.' }

  const subtarefas: Subtarefa[] = (data ?? []).map((s) => ({
    id: s.id,
    titulo: s.titulo,
    colunaId: s.coluna_id,
    colunaNome: (s.colunas as unknown as { nome: string } | null)?.nome ?? '—',
    // Vêm de coluna com CHECK/enum no banco — o valor já é um dos literais.
    tipo: s.tipo as TipoCartao,
    prioridade: s.prioridade as PrioridadeCartao,
    responsaveis: (s.cartoes_responsaveis ?? []).map((r: { colaborador_id: string }) => r.colaborador_id),
  }))

  return { ok: true, data: subtarefas }
}

export async function converterEmSubtarefa(cartaoId: string, cartaoPaiId: string, quadroId: string): Promise<ActionResult> {
  await requireUser()
  const supabase = await createClient()

  if (cartaoId === cartaoPaiId) return { ok: false, error: 'Um card não pode ser subtarefa de si mesmo.' }

  const { error } = await supabase.from('cartoes').update({ cartao_pai_id: cartaoPaiId }).eq('id', cartaoId)
  if (error) return { ok: false, error: 'Falha ao converter em subtarefa.' }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}

export async function promoverSubtarefa(cartaoId: string, quadroId: string): Promise<ActionResult> {
  await requireUser()
  const supabase = await createClient()

  const { error } = await supabase.from('cartoes').update({ cartao_pai_id: null }).eq('id', cartaoId)
  if (error) return { ok: false, error: 'Falha ao promover a subtarefa a card independente.' }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}
