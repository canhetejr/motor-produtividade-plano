'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { registrarAuditoria } from '@/lib/auditoria'
import type { ActionResult } from '@/lib/action-result'

export type LinkCompartilhado = {
  id: string
  token: string
  rotulo: string
  expiraEm: string | null
  ativo: boolean
  ultimoAcessoEm: string | null
}

const criarSchema = z.object({
  rotulo: z.string().trim().min(1, 'Diga para quem é este link').max(60, 'Rótulo muito longo'),
  // Prazo é opcional no banco, mas a interface pede: link sem validade vira
  // permanente por esquecimento.
  expiraEm: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export async function listarCompartilhamentos(
  quadroId: string
): Promise<ActionResult<LinkCompartilhado[]>> {
  await requireUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('quadros_compartilhamentos')
    .select('id, token, rotulo, expira_em, ativo, ultimo_acesso_em')
    .eq('quadro_id', quadroId)
    .order('criado_em', { ascending: false })

  if (error) return { ok: false, error: 'Não foi possível carregar os links.' }

  return {
    ok: true,
    data: (data ?? []).map((l) => ({
      id: l.id,
      token: l.token,
      rotulo: l.rotulo,
      expiraEm: l.expira_em,
      ativo: l.ativo,
      ultimoAcessoEm: l.ultimo_acesso_em,
    })),
  }
}

export async function criarCompartilhamento(
  quadroId: string,
  formData: FormData
): Promise<ActionResult<{ token: string }>> {
  const { user } = await requireUser()
  const supabase = await createClient()

  const parsed = criarSchema.safeParse({
    rotulo: formData.get('rotulo'),
    expiraEm: (formData.get('expiraEm') as string) || undefined,
  })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  // O token vem do default da tabela (32 bytes de gen_random_bytes): gerá-lo no
  // servidor de aplicação não seria pior, mas deixá-lo num lugar só evita duas
  // fontes de aleatoriedade com garantias diferentes.
  const { data, error } = await supabase
    .from('quadros_compartilhamentos')
    .insert({
      quadro_id: quadroId,
      rotulo: parsed.data.rotulo,
      // Fim do dia escolhido, não meia-noite: escolher "10/08" e o link morrer
      // à meia-noite do dia 10 surpreende.
      expira_em: parsed.data.expiraEm ? `${parsed.data.expiraEm}T23:59:59Z` : null,
      criado_por: user.id,
    })
    .select('token')
    .single()

  if (error || !data) {
    console.error('Falha ao criar link: code=%s message=%s', error?.code, error?.message)
    return { ok: false, error: 'Não foi possível criar o link.' }
  }

  await registrarAuditoria({
    atorId: user.id,
    acao: 'quadro.link_criado',
    entidade: 'quadros_compartilhamentos',
    entidadeId: quadroId,
    depois: { rotulo: parsed.data.rotulo, expiraEm: parsed.data.expiraEm ?? null },
  })

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true, data: { token: data.token } }
}

/**
 * Revogar em vez de excluir.
 *
 * Excluir apagaria o registro de que o link existiu e de quando foi acessado —
 * que é justamente o que se quer consultar depois de revogar.
 */
export async function revogarCompartilhamento(
  id: string,
  quadroId: string
): Promise<ActionResult> {
  const { user } = await requireUser()
  const supabase = await createClient()

  const { error } = await supabase
    .from('quadros_compartilhamentos')
    .update({ ativo: false })
    .eq('id', id)

  if (error) return { ok: false, error: 'Não foi possível revogar o link.' }

  await registrarAuditoria({
    atorId: user.id,
    acao: 'quadro.link_revogado',
    entidade: 'quadros_compartilhamentos',
    entidadeId: id,
  })

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}
