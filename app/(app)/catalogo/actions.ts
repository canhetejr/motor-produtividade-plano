'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireGestor, requireUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { criarNotificacao, notificarGestores } from '@/lib/notifications'
import type { ActionResult } from '@/lib/action-result'

const areaSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome da área'),
})

const demandaSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome da demanda'),
  tempo_padrao_min: z.coerce
    .number()
    .int('Tempo padrão deve ser em minutos inteiros')
    .positive('Tempo padrão deve ser maior que zero')
    .nullable()
    .catch(null),
  variavel: z.boolean(),
  blocos_totais: z.coerce
    .number()
    .int('Blocos deve ser um número inteiro')
    .min(1, 'Blocos deve ser no mínimo 1')
    .catch(1),
})

// === AREAS ===

export async function createArea(formData: FormData): Promise<ActionResult> {
  await requireGestor()
  const supabase = await createClient()

  const parsed = areaSchema.safeParse({ nome: formData.get('nome') })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const { error } = await supabase.from('areas').insert(parsed.data)
  if (error) {
    return {
      ok: false,
      error: error.code === '23505' ? 'Já existe uma área com esse nome.' : 'Falha ao criar a área.',
    }
  }

  revalidatePath('/catalogo')
  return { ok: true }
}

export async function updateArea(id: string, formData: FormData): Promise<ActionResult> {
  await requireGestor()
  const supabase = await createClient()

  const parsed = areaSchema.safeParse({ nome: formData.get('nome') })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const { error } = await supabase.from('areas').update(parsed.data).eq('id', id)
  if (error) {
    return {
      ok: false,
      error: error.code === '23505' ? 'Já existe uma área com esse nome.' : 'Falha ao atualizar a área.',
    }
  }

  revalidatePath('/catalogo')
  return { ok: true }
}

// === DEMANDAS ===

export async function createDemanda(formData: FormData): Promise<ActionResult> {
  await requireGestor()
  const supabase = await createClient()

  const area_id = z.string().uuid().safeParse(formData.get('area_id'))
  if (!area_id.success) return { ok: false, error: 'Selecione uma área.' }

  const parsed = demandaSchema.safeParse({
    nome: formData.get('nome'),
    tempo_padrao_min: formData.get('tempo_padrao_min') || null,
    variavel: formData.get('variavel') === 'on',
    blocos_totais: formData.get('blocos_totais') || 1,
  })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const { error } = await supabase.from('demandas').insert({
    area_id: area_id.data,
    ...parsed.data,
  })
  if (error) {
    return {
      ok: false,
      error:
        error.code === '23505'
          ? 'Já existe uma demanda com esse nome nesta área.'
          : 'Falha ao criar a demanda.',
    }
  }

  revalidatePath('/catalogo')
  revalidatePath('/apontamento')
  return { ok: true }
}

export async function updateDemanda(id: string, formData: FormData): Promise<ActionResult> {
  await requireGestor()
  const supabase = await createClient()

  const parsed = demandaSchema
    .extend({ ativo: z.boolean() })
    .safeParse({
      nome: formData.get('nome'),
      tempo_padrao_min: formData.get('tempo_padrao_min') || null,
      variavel: formData.get('variavel') === 'on',
      ativo: formData.get('ativo') === 'on',
      blocos_totais: formData.get('blocos_totais') || 1,
    })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const { error } = await supabase.from('demandas').update(parsed.data).eq('id', id)
  if (error) {
    return {
      ok: false,
      error:
        error.code === '23505'
          ? 'Já existe uma demanda com esse nome nesta área.'
          : 'Falha ao atualizar a demanda.',
    }
  }

  revalidatePath('/catalogo')
  revalidatePath('/apontamento')
  return { ok: true }
}

// === SOLICITACOES DE DEMANDA ===

export async function criarSolicitacao(tipo: 'NOVA' | 'ALTERACAO', demanda_id: string | null, formData: FormData): Promise<ActionResult> {
  const { user, profile } = await requireUser()
  const supabase = await createClient()

  const area_id = z.string().uuid().safeParse(formData.get('area_id'))
  if (!area_id.success) return { ok: false, error: 'Selecione uma área.' }

  const parsed = demandaSchema.extend({
    ativo: z.boolean().optional(),
  }).safeParse({
    nome: formData.get('nome'),
    tempo_padrao_min: formData.get('tempo_padrao_min') || null,
    variavel: formData.get('variavel') === 'on',
    blocos_totais: formData.get('blocos_totais') || 1,
    ativo: formData.get('ativo') === 'on',
  })
  
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const { error } = await supabase.from('solicitacoes_demandas').insert({
    colaborador_id: user.id,
    area_id: area_id.data,
    demanda_id,
    tipo,
    nome: parsed.data.nome,
    tempo_padrao_min: parsed.data.tempo_padrao_min,
    variavel: parsed.data.variavel,
    blocos_totais: parsed.data.blocos_totais,
    ativo: parsed.data.ativo,
    status: 'PENDENTE'
  })

  if (error) {
    console.error(error)
    return { ok: false, error: 'Falha ao enviar sugestão. Tente novamente mais tarde.' }
  }

  await notificarGestores({
    tipo: 'solicitacao_pendente',
    titulo: tipo === 'NOVA' ? 'Nova demanda sugerida' : 'Alteração de demanda sugerida',
    mensagem: `${profile.nome} sugeriu: ${parsed.data.nome}`,
    link: '/catalogo',
  })

  revalidatePath('/catalogo')
  return { ok: true }
}

export async function aprovarSolicitacao(id: string): Promise<ActionResult> {
  await requireGestor()
  const supabase = await createClient()

  // 1. Pegar a solicitacao
  const { data: sol, error: solError } = await supabase.from('solicitacoes_demandas').select('*').eq('id', id).single()
  if (solError || !sol) return { ok: false, error: 'Solicitação não encontrada.' }
  if (sol.status !== 'PENDENTE') return { ok: false, error: 'Solicitação já foi processada.' }

  // 2. Realizar insert ou update na tabela principal
  if (sol.tipo === 'NOVA') {
    const { error: insertError } = await supabase.from('demandas').insert({
      area_id: sol.area_id,
      nome: sol.nome,
      tempo_padrao_min: sol.tempo_padrao_min,
      variavel: sol.variavel,
      blocos_totais: sol.blocos_totais,
      ativo: true
    })
    if (insertError) {
      if (insertError.code === '23505') return { ok: false, error: 'Já existe uma demanda com esse nome.' }
      return { ok: false, error: 'Falha ao criar demanda a partir da solicitação.' }
    }
  } else if (sol.tipo === 'ALTERACAO') {
    if (!sol.demanda_id) {
      return { ok: false, error: 'Solicitação de alteração sem demanda original associada.' }
    }
    const { error: updateError } = await supabase.from('demandas').update({
      nome: sol.nome,
      tempo_padrao_min: sol.tempo_padrao_min,
      variavel: sol.variavel,
      blocos_totais: sol.blocos_totais,
      ativo: sol.ativo !== null ? sol.ativo : true
    }).eq('id', sol.demanda_id)
    if (updateError) {
      if (updateError.code === '23505') return { ok: false, error: 'Já existe uma demanda com esse nome.' }
      return { ok: false, error: 'Falha ao atualizar demanda a partir da solicitação.' }
    }
  }

  // 3. Atualizar o status da solicitação
  await supabase.from('solicitacoes_demandas').update({ status: 'APROVADA', atualizado_em: new Date().toISOString() }).eq('id', id)

  await criarNotificacao({
    destinatarioId: sol.colaborador_id,
    tipo: 'solicitacao_aprovada',
    titulo: 'Solicitação aprovada',
    mensagem: `Sua sugestão "${sol.nome}" foi aprovada.`,
    link: '/catalogo',
  })

  revalidatePath('/catalogo')
  revalidatePath('/apontamento')
  return { ok: true }
}

export async function rejeitarSolicitacao(id: string): Promise<ActionResult> {
  await requireGestor()
  const supabase = await createClient()

  const { data: sol, error } = await supabase
    .from('solicitacoes_demandas')
    .update({ status: 'REJEITADA', atualizado_em: new Date().toISOString() })
    .eq('id', id)
    .select('colaborador_id, nome')
    .single()
  if (error) return { ok: false, error: 'Falha ao rejeitar solicitação.' }

  await criarNotificacao({
    destinatarioId: sol.colaborador_id,
    tipo: 'solicitacao_rejeitada',
    titulo: 'Solicitação rejeitada',
    mensagem: `Sua sugestão "${sol.nome}" foi rejeitada.`,
    link: '/catalogo',
  })

  revalidatePath('/catalogo')
  return { ok: true }
}
