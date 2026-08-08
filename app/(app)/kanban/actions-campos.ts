'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireGestor, requireUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import type { ActionResult } from '@/lib/action-result'
import type { Json, TipoCampoCustomizado } from '@/lib/database.types'
import type { CampoCustomizado } from './[quadroId]/types'

// Campos customizados do quadro (bloco 30). A definição é do quadro, o valor é
// do card — mesma divisão de `colunas_requisitos` / `cartoes_requisitos_status`.
//
// O valor vive numa coluna `jsonb` única, então a validação por tipo é
// responsabilidade daqui: o banco só garante que o `tipo` do campo é um dos
// sete conhecidos.

const TIPOS: TipoCampoCustomizado[] = ['texto', 'numero', 'data', 'selecao', 'pessoa', 'checkbox', 'url']

const campoSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome do campo').max(60, 'Nome muito longo (máx. 60 caracteres)'),
  tipo: z.enum(TIPOS as [TipoCampoCustomizado, ...TipoCampoCustomizado[]]),
  opcoes: z.array(z.string().trim().min(1)).max(50, 'Máximo de 50 opções').catch([]),
  obrigatorio: z.boolean().catch(false),
})

export async function listarCamposQuadro(quadroId: string): Promise<ActionResult<CampoCustomizado[]>> {
  await requireUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('quadros_campos')
    .select('id, nome, tipo, opcoes, obrigatorio, posicao')
    .eq('quadro_id', quadroId)
    .order('posicao')
  if (error) return { ok: false, error: 'Falha ao carregar os campos do quadro.' }

  return { ok: true, data: (data ?? []) as CampoCustomizado[] }
}

export async function criarCampoQuadro(
  quadroId: string,
  entrada: { nome: string; tipo: TipoCampoCustomizado; opcoes: string[]; obrigatorio: boolean }
): Promise<ActionResult> {
  const { profile } = await requireGestor()
  const supabase = await createClient()

  const parsed = campoSchema.safeParse(entrada)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  if (parsed.data.tipo === 'selecao' && parsed.data.opcoes.length === 0) {
    return { ok: false, error: 'Campo de seleção precisa de pelo menos uma opção.' }
  }

  const { count } = await supabase
    .from('quadros_campos')
    .select('id', { count: 'exact', head: true })
    .eq('quadro_id', quadroId)

  const { error } = await supabase.from('quadros_campos').insert({
    quadro_id: quadroId,
    nome: parsed.data.nome,
    tipo: parsed.data.tipo,
    // Opções só fazem sentido em seleção; guardar em outro tipo viraria lixo.
    opcoes: parsed.data.tipo === 'selecao' ? parsed.data.opcoes : [],
    obrigatorio: parsed.data.obrigatorio,
    posicao: count ?? 0,
    organizacao_id: profile.organizacao_id,
  })
  if (error) {
    return {
      ok: false,
      error: error.code === '23505' ? 'Já existe um campo com esse nome neste quadro.' : 'Falha ao criar o campo.',
    }
  }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}

export async function excluirCampoQuadro(campoId: string, quadroId: string): Promise<ActionResult> {
  await requireGestor()
  const supabase = await createClient()

  // Os valores em cartoes_campos_valores caem junto (on delete cascade) —
  // excluir um campo apaga o que já foi preenchido nele em todos os cards.
  const { error } = await supabase.from('quadros_campos').delete().eq('id', campoId)
  if (error) return { ok: false, error: 'Falha ao excluir o campo.' }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}

export async function reordenarCamposQuadro(quadroId: string, campoIds: string[]): Promise<ActionResult> {
  await requireGestor()
  const supabase = await createClient()

  const resultados = await Promise.all(
    campoIds.map((id, posicao) => supabase.from('quadros_campos').update({ posicao }).eq('id', id))
  )
  if (resultados.some((r) => r.error)) return { ok: false, error: 'Falha ao reordenar os campos.' }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}

export async function listarValoresCampos(cartaoId: string): Promise<ActionResult<Record<string, unknown>>> {
  await requireUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('cartoes_campos_valores')
    .select('campo_id, valor')
    .eq('cartao_id', cartaoId)
  if (error) return { ok: false, error: 'Falha ao carregar os campos do card.' }

  const valores: Record<string, unknown> = {}
  for (const linha of data ?? []) valores[linha.campo_id] = linha.valor

  return { ok: true, data: valores }
}

export async function salvarValorCampo(
  cartaoId: string,
  campoId: string,
  quadroId: string,
  valor: unknown
): Promise<ActionResult> {
  const { profile } = await requireUser()
  const supabase = await createClient()

  const { data: campo, error: campoError } = await supabase
    .from('quadros_campos')
    .select('id, nome, tipo, opcoes, obrigatorio')
    .eq('id', campoId)
    .maybeSingle()
  if (campoError || !campo) return { ok: false, error: 'Campo não encontrado.' }

  const validacao = validarValor(campo.tipo, campo.opcoes ?? [], valor)
  if (!validacao.ok) return { ok: false, error: `${campo.nome}: ${validacao.error}` }

  // Valor vazio apaga a linha em vez de gravar null — mantém a tabela com uma
  // linha só para campo de fato preenchido.
  if (validacao.valor === null) {
    if (campo.obrigatorio) return { ok: false, error: `${campo.nome} é obrigatório.` }
    const { error } = await supabase
      .from('cartoes_campos_valores')
      .delete()
      .eq('cartao_id', cartaoId)
      .eq('campo_id', campoId)
    if (error) return { ok: false, error: 'Falha ao limpar o campo.' }
    revalidatePath(`/kanban/${quadroId}`)
    return { ok: true }
  }

  const { error } = await supabase.from('cartoes_campos_valores').upsert(
    {
      cartao_id: cartaoId,
      campo_id: campoId,
      valor: validacao.valor as Json,
      atualizado_em: new Date().toISOString(),
      organizacao_id: profile.organizacao_id,
    },
    { onConflict: 'cartao_id,campo_id' }
  )
  if (error) return { ok: false, error: 'Falha ao salvar o campo.' }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}

type Validacao = { ok: true; valor: unknown } | { ok: false; error: string }

/**
 * O banco guarda todos os tipos numa coluna jsonb só, então é aqui que cada
 * tipo ganha significado. Devolve `valor: null` para entrada vazia — o
 * chamador trata isso como "limpar o campo".
 */
function validarValor(tipo: string, opcoes: string[], valor: unknown): Validacao {
  if (valor === null || valor === undefined || valor === '') return { ok: true, valor: null }

  switch (tipo) {
    case 'texto':
      return typeof valor === 'string' && valor.length <= 500
        ? { ok: true, valor: valor.trim() }
        : { ok: false, error: 'texto inválido (máx. 500 caracteres).' }

    case 'numero': {
      const numero = typeof valor === 'number' ? valor : Number(valor)
      return Number.isFinite(numero) ? { ok: true, valor: numero } : { ok: false, error: 'informe um número.' }
    }

    case 'data':
      return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)
        ? { ok: true, valor }
        : { ok: false, error: 'informe uma data válida.' }

    case 'selecao':
      return typeof valor === 'string' && opcoes.includes(valor)
        ? { ok: true, valor }
        : { ok: false, error: 'escolha uma das opções configuradas.' }

    case 'pessoa':
      return typeof valor === 'string' && /^[0-9a-f-]{36}$/i.test(valor)
        ? { ok: true, valor }
        : { ok: false, error: 'selecione uma pessoa.' }

    case 'checkbox':
      return { ok: true, valor: valor === true || valor === 'true' }

    case 'url': {
      if (typeof valor !== 'string') return { ok: false, error: 'informe um link.' }
      try {
        const url = new URL(valor)
        if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('protocolo')
        return { ok: true, valor }
      } catch {
        return { ok: false, error: 'informe um link começando com http:// ou https://.' }
      }
    }

    default:
      return { ok: false, error: 'tipo de campo desconhecido.' }
  }
}
