'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { sanitizarHtml } from '@/lib/rich-text'
import type { ActionResult } from '@/lib/action-result'
import type { PrioridadeCartao, TipoCartao } from '@/lib/database.types'

export type Template = {
  id: string
  nome: string
  titulo: string
  descricao: string | null
  prioridade: PrioridadeCartao
  tipo: TipoCartao
  tempoEstimadoMin: number | null
}

const templateSchema = z.object({
  nome: z.string().trim().min(1, 'Dê um nome ao modelo').max(60, 'Nome muito longo'),
  titulo: z.string().trim().min(1, 'O modelo precisa de um título'),
  descricao: z.string().optional(),
  prioridade: z.enum(['baixa', 'media', 'alta']),
  tipo: z.enum(['Padrão', 'Bug', 'Melhoria', 'Solicitação']),
  tempoEstimadoMin: z.coerce.number().int().positive().optional(),
})

export async function listarTemplates(quadroId: string): Promise<ActionResult<Template[]>> {
  await requireUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('cartoes_templates')
    .select('id, nome, titulo, descricao, prioridade, tipo, tempo_estimado_min')
    .eq('quadro_id', quadroId)
    .order('nome')

  if (error) return { ok: false, error: 'Não foi possível carregar os modelos.' }

  return {
    ok: true,
    data: (data ?? []).map((t) => ({
      id: t.id,
      nome: t.nome,
      titulo: t.titulo,
      descricao: t.descricao,
      prioridade: t.prioridade,
      tipo: t.tipo,
      tempoEstimadoMin: t.tempo_estimado_min,
    })),
  }
}

/**
 * Salva o card aberto como modelo.
 *
 * Prazo, responsável e coluna ficam de fora de propósito: prazo herdado sairia
 * sempre errado, e responsável fixo viraria atribuição automática que ninguém
 * pediu.
 */
export async function salvarComoTemplate(
  quadroId: string,
  formData: FormData
): Promise<ActionResult> {
  const { user } = await requireUser()
  const supabase = await createClient()

  const parsed = templateSchema.safeParse({
    nome: formData.get('nome'),
    titulo: formData.get('titulo'),
    descricao: formData.get('descricao') ?? undefined,
    prioridade: formData.get('prioridade'),
    tipo: formData.get('tipo'),
    tempoEstimadoMin: formData.get('tempoEstimadoMin') || undefined,
  })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const { error } = await supabase.from('cartoes_templates').insert({
    quadro_id: quadroId,
    nome: parsed.data.nome,
    titulo: parsed.data.titulo,
    // A descrição vem do editor rich text e vai para o card depois — sanitizar
    // aqui, e não só na instanciação, evita guardar HTML sujo no molde.
    descricao: parsed.data.descricao ? sanitizarHtml(parsed.data.descricao) : null,
    prioridade: parsed.data.prioridade,
    tipo: parsed.data.tipo,
    tempo_estimado_min: parsed.data.tempoEstimadoMin ?? null,
    criado_por: user.id,
  })

  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Já existe um modelo com esse nome neste quadro.' }
    console.error('Falha ao salvar modelo: code=%s message=%s', error.code, error.message)
    return { ok: false, error: 'Não foi possível salvar o modelo.' }
  }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}

export async function excluirTemplate(id: string, quadroId: string): Promise<ActionResult> {
  await requireUser()
  const supabase = await createClient()

  const { error } = await supabase.from('cartoes_templates').delete().eq('id', id)
  if (error) return { ok: false, error: 'Não foi possível excluir o modelo.' }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}
