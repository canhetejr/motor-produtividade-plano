'use server'

import { randomBytes, createHash } from 'node:crypto'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireGestor, isAdmin } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { registrarAuditoria } from '@/lib/auditoria'
import { sendEmail, emailConvite } from '@/lib/email'
import { mensagemDeErroDoBanco } from '@/lib/supabase-error'
import { urlPublica } from '@/lib/base-url'
import type { ActionResult } from '@/lib/action-result'

const APP_URL = urlPublica()
const EXPIRA_EM_DIAS = 7

const convidarSchema = z.object({
  email: z.string().trim().email('Informe um e-mail válido'),
  role: z.enum(['colaborador', 'gestor'], { message: 'Perfil inválido' }),
  area_id: z.string().uuid('Selecione uma área'),
})

// Mesma separação de privilégio de colaboradores/actions.ts: promover a
// gestor é conceder poder sobre todo o catálogo e toda a equipe. Convidar
// alguém JÁ como gestor é o mesmo ato por outra porta — sem esta checagem,
// o convite seria o caminho para contornar a regra.
const APENAS_ADMIN_GESTOR =
  'Só um admin pode convidar alguém como gestor. Convide como colaborador e peça a promoção ao administrador.'

export async function convidar(formData: FormData): Promise<ActionResult<{ link: string; emailEnviado: boolean }>> {
  const { user, profile } = await requireGestor()

  const parsed = convidarSchema.safeParse({
    email: formData.get('email'),
    role: formData.get('role'),
    area_id: formData.get('area_id'),
  })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  if (parsed.data.role === 'gestor' && !(await isAdmin())) {
    return { ok: false, error: APENAS_ADMIN_GESTOR }
  }

  const supabase = await createClient()

  // O token vai em texto puro só na URL do e-mail; no banco fica o SHA-256.
  // Diferente do /q/[token] (leitura), este concede escrita e consome um
  // assento — por isso nunca é gravado em claro.
  const token = randomBytes(32).toString('base64url')
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const expiraEm = new Date(Date.now() + EXPIRA_EM_DIAS * 86_400_000).toISOString()

  const { data: convite, error } = await supabase
    .from('convites')
    .insert({
      organizacao_id: profile.organizacao_id,
      email: parsed.data.email,
      role: parsed.data.role,
      area_id: parsed.data.area_id,
      token_hash: tokenHash,
      convidado_por: user.id,
      expira_em: expiraEm,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Erro ao criar convite: code=%s message=%s', error.code, error.message)
    return { ok: false, error: mensagemDeErroDoBanco(error) ?? 'Não foi possível criar o convite.' }
  }

  const link = `${APP_URL}/convite/${token}`

  // O e-mail é o segundo canal, não o convite em si: o convite já existe no
  // banco a esta altura. Falha de SMTP não desfaz nada — o gestor ainda tem
  // o link para mandar por outro caminho, e a UI diz qual dos dois aconteceu.
  let emailEnviado = false
  try {
    const conteudo = emailConvite({
      organizacaoNome: profile.organizacoes?.nome ?? 'sua equipe',
      convidadoPorNome: profile.nome,
      link,
      expiraEmDias: EXPIRA_EM_DIAS,
      remetenteNome: profile.organizacoes?.nome,
    })
    const resultado = await sendEmail({
      to: parsed.data.email,
      subject: conteudo.subject,
      html: conteudo.html,
      remetente: { nome: profile.organizacoes?.nome },
    })
    emailEnviado = resultado.sent
  } catch (err) {
    console.error('Falha ao enviar e-mail de convite:', err)
  }

  await registrarAuditoria(
    {
      atorId: user.id,
      acao: 'convite.criar',
      entidade: 'convites',
      entidadeId: convite.id,
      depois: { email: parsed.data.email, role: parsed.data.role, expira_em: expiraEm },
    },
    profile.organizacao_id
  )

  revalidatePath('/gestao/acessos')
  return { ok: true, data: { link, emailEnviado } }
}

export async function revogarConvite(id: string): Promise<ActionResult> {
  const { user, profile } = await requireGestor()
  const supabase = await createClient()

  // Revogar libera o assento na hora: assentos_ocupados() só conta convite
  // com revogado_em nulo.
  const { error } = await supabase
    .from('convites')
    .update({ revogado_em: new Date().toISOString() })
    .eq('id', id)
    .is('aceito_em', null)

  if (error) {
    console.error('Erro ao revogar convite: code=%s message=%s', error.code, error.message)
    return { ok: false, error: 'Não foi possível revogar o convite.' }
  }

  await registrarAuditoria(
    { atorId: user.id, acao: 'convite.revogar', entidade: 'convites', entidadeId: id },
    profile.organizacao_id
  )

  revalidatePath('/gestao/acessos')
  return { ok: true }
}
