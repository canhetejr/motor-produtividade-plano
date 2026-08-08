'use server'

import { z } from 'zod'
import { createHash } from 'node:crypto'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/utils/supabase/admin'
import { verificarSenhaVazada, mensagemDeRecusa } from '@/lib/senha-vazada'

const aceiteSchema = z.object({
  token: z.string().trim().min(1),
  nome: z.string().trim().min(2, 'Informe seu nome'),
  password: z.string().min(6, 'A senha deve ter ao menos 6 caracteres'),
})

function falhar(token: string, mensagem: string): never {
  redirect(`/convite/${encodeURIComponent(token)}?message=${encodeURIComponent(mensagem)}`)
}

const MENSAGENS_RPC: Record<string, string> = {
  CONVITE_INVALIDO: 'Convite inválido.',
  CONVITE_JA_ACEITO: 'Este convite já foi aceito.',
  CONVITE_REVOGADO: 'Este convite foi revogado.',
  CONVITE_EXPIRADO: 'Este convite expirou. Peça um novo ao seu gestor.',
}

export async function aceitarConvite(formData: FormData): Promise<void> {
  const parsed = aceiteSchema.safeParse({
    token: formData.get('token'),
    nome: formData.get('nome'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    const token = String(formData.get('token') ?? '')
    falhar(token, parsed.error.issues[0].message)
  }

  const { token, nome, password } = parsed.data
  // Nunca comparar o token cru salvo em lugar nenhum — só o hash SHA-256
  // (token_hash) vive no banco.
  const tokenHash = createHash('sha256').update(token).digest('hex')

  const admin = createAdminClient()

  // Busca o e-mail e o status do convite ANTES de criar a conta Auth — sem
  // isso, um token expirado/revogado ainda criaria um auth.users inútil.
  const { data: convite, error: convError } = await admin
    .from('convites')
    .select('email, aceito_em, revogado_em, expira_em')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (convError || !convite) {
    falhar(token, 'Convite inválido.')
  }
  if (convite.aceito_em) falhar(token, MENSAGENS_RPC.CONVITE_JA_ACEITO)
  if (convite.revogado_em) falhar(token, MENSAGENS_RPC.CONVITE_REVOGADO)
  if (new Date(convite.expira_em) < new Date()) falhar(token, MENSAGENS_RPC.CONVITE_EXPIRADO)

  const recusaSenha = mensagemDeRecusa(await verificarSenhaVazada(password))
  if (recusaSenha) falhar(token, recusaSenha)

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: convite.email,
    password,
    email_confirm: true,
  })
  if (authError || !created.user) {
    console.error('Erro ao criar usuário no aceite de convite:', authError)
    falhar(token, authError?.message ?? 'Falha ao criar a conta.')
  }

  const { error: rpcError } = await admin.rpc('aceitar_convite', {
    p_token_hash: tokenHash,
    p_user_id: created.user.id,
    p_nome: nome,
  })

  if (rpcError) {
    console.error('Erro ao aceitar convite:', rpcError)
    await admin.auth.admin.deleteUser(created.user.id)
    const mensagem = MENSAGENS_RPC[rpcError.message] ?? 'Não foi possível aceitar o convite. Tente novamente.'
    falhar(token, mensagem)
  }

  redirect('/login?message=' + encodeURIComponent('Conta criada! Entre com seu e-mail e senha.'))
}
