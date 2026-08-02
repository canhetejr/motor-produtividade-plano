'use server'

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { validarDependencia, type Aresta } from '@/lib/dependencias'
import type { ActionResult } from '@/lib/action-result'

export type Dependencia = {
  id: string
  dependeDeId: string
  codigo: string | null
  titulo: string
  entregue: boolean
}

/**
 * Do que este card depende, com o estado de cada bloqueador.
 *
 * `entregue_em` do card bloqueador é o que diz se ele já saiu do caminho — é o
 * mesmo campo que o Kanban usa para "entregue" em todo lugar.
 */
export async function listarDependencias(cartaoId: string): Promise<ActionResult<Dependencia[]>> {
  await requireUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('cartoes_dependencias')
    .select('id, depende_de_id, cartoes!cartoes_dependencias_depende_de_id_fkey(codigo, titulo, entregue_em)')
    .eq('cartao_id', cartaoId)

  if (error) {
    console.error('Falha ao listar dependências: code=%s message=%s', error.code, error.message)
    return { ok: false, error: 'Não foi possível carregar as dependências.' }
  }

  return {
    ok: true,
    data: (data ?? []).map((d) => {
      const alvo = Array.isArray(d.cartoes) ? d.cartoes[0] : d.cartoes
      return {
        id: d.id,
        dependeDeId: d.depende_de_id,
        codigo: alvo?.codigo ?? null,
        titulo: alvo?.titulo ?? '(sem acesso)',
        entregue: Boolean(alvo?.entregue_em),
      }
    }),
  }
}

export async function adicionarDependencia(
  cartaoId: string,
  dependeDeId: string,
  quadroId: string
): Promise<ActionResult> {
  const { user } = await requireUser()
  const supabase = await createClient()

  // O ciclo é validado contra o grafo do quadro inteiro, e não só contra as
  // dependências deste card: A→B→C→A só é detectável olhando o conjunto.
  const { data: existentes, error: erroLeitura } = await supabase
    .from('cartoes_dependencias')
    .select('cartao_id, depende_de_id')

  if (erroLeitura) return { ok: false, error: 'Não foi possível validar a dependência.' }

  const arestas: Aresta[] = (existentes ?? []).map((e) => ({
    cartaoId: e.cartao_id,
    dependeDe: e.depende_de_id,
  }))

  const validacao = validarDependencia(arestas, cartaoId, dependeDeId)
  if (!validacao.ok) return { ok: false, error: validacao.motivo }

  const { error } = await supabase
    .from('cartoes_dependencias')
    .insert({ cartao_id: cartaoId, depende_de_id: dependeDeId, criado_por: user.id })

  if (error) {
    // A constraint única é a rede de segurança para duas abas gravando junto —
    // a checagem acima corre antes, mas não é atômica.
    if (error.code === '23505') return { ok: false, error: 'Essa dependência já existe.' }
    console.error('Falha ao criar dependência: code=%s message=%s', error.code, error.message)
    return { ok: false, error: 'Não foi possível criar a dependência.' }
  }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}

export async function removerDependencia(id: string, quadroId: string): Promise<ActionResult> {
  await requireUser()
  const supabase = await createClient()

  const { error } = await supabase.from('cartoes_dependencias').delete().eq('id', id)
  if (error) return { ok: false, error: 'Não foi possível remover a dependência.' }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}
