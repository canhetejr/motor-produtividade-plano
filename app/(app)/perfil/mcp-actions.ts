'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { registrarAuditoria } from '@/lib/auditoria'
import { gerarTokenMcp, ESCOPOS_MCP_DISPONIVEIS, type EscopoMcp } from '@/lib/mcp-auth'
import type { ActionResult } from '@/lib/action-result'

// RLS de mcp_tokens (mcp_tokens_proprio) já restringe select/update ao
// próprio colaborador — estas actions usam o client normal (cookie de
// sessão), sem precisar de service role.
const EXPIRA_EM_DIAS_PADRAO = 90

const criarTokenSchema = z.object({
  nome: z.string().trim().min(1, 'Dê um nome ao token (ex.: "Claude Desktop")').max(80, 'Nome muito longo'),
  escopos: z.array(z.string()).min(1, 'Selecione ao menos uma permissão'),
})

export async function criarMcpToken(formData: FormData): Promise<ActionResult<{ token: string }>> {
  const { user, profile } = await requireUser()
  const supabase = await createClient()

  const parsed = criarTokenSchema.safeParse({
    nome: formData.get('nome'),
    escopos: formData.getAll('escopos').map(String),
  })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const escoposInvalidos = parsed.data.escopos.filter((e) => !ESCOPOS_MCP_DISPONIVEIS.includes(e as EscopoMcp))
  if (escoposInvalidos.length > 0) {
    return { ok: false, error: `Permissão desconhecida: ${escoposInvalidos.join(', ')}` }
  }

  // O valor em claro só existe neste retorno — o banco nunca vê o token,
  // só o hash (lib/mcp-auth.ts::gerarTokenMcp).
  const { token, tokenHash, tokenPrefixo } = gerarTokenMcp()
  const expiraEm = new Date(Date.now() + EXPIRA_EM_DIAS_PADRAO * 86_400_000).toISOString()

  const { error } = await supabase.from('mcp_tokens').insert({
    organizacao_id: profile.organizacao_id,
    colaborador_id: user.id,
    nome: parsed.data.nome,
    token_hash: tokenHash,
    token_prefixo: tokenPrefixo,
    escopos: parsed.data.escopos,
    expira_em: expiraEm,
  })

  if (error) {
    console.error('Erro ao criar token MCP: code=%s message=%s', error.code, error.message)
    return { ok: false, error: 'Não foi possível criar o token.' }
  }

  await registrarAuditoria(
    {
      atorId: user.id,
      acao: 'mcp_token.criar',
      entidade: 'mcp_tokens',
      depois: { nome: parsed.data.nome, escopos: parsed.data.escopos },
    },
    profile.organizacao_id
  )

  revalidatePath('/perfil')
  return { ok: true, data: { token } }
}

export async function revogarMcpToken(id: string): Promise<ActionResult> {
  const { user, profile } = await requireUser()
  const supabase = await createClient()

  const { error } = await supabase
    .from('mcp_tokens')
    .update({ revogado_em: new Date().toISOString() })
    .eq('id', id)
    .is('revogado_em', null)

  if (error) {
    console.error('Erro ao revogar token MCP: code=%s message=%s', error.code, error.message)
    return { ok: false, error: 'Não foi possível revogar o token.' }
  }

  await registrarAuditoria(
    { atorId: user.id, acao: 'mcp_token.revogar', entidade: 'mcp_tokens', entidadeId: id },
    profile.organizacao_id
  )

  revalidatePath('/perfil')
  return { ok: true }
}
