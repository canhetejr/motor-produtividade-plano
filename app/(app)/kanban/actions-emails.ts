'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { sendEmail, layoutEmail } from '@/lib/email'
import { sanitizarHtml } from '@/lib/rich-text'
import type { ActionResult } from '@/lib/action-result'

// Aba "Emails": envio avulso a partir do card, com log persistido. Não é
// caixa de entrada bidirecional — usa o remetente transacional já existente
// (lib/email.ts), sem infra de IMAP/webhook.

const emailSchema = z.object({
  destinatario: z.string().trim().email('Informe um e-mail válido'),
  assunto: z.string().trim().min(1, 'Informe o assunto').max(200, 'Assunto muito longo (máx. 200 caracteres)'),
  // O corpo virou HTML do editor, então o teto passou a contar marcação — e
  // `sanitizarHtml` é o que garante que só o que o editor produz vai para
  // dentro do e-mail. Antes desta mudança o corpo era interpolado cru em
  // `<p>${corpo}</p>`, o que era injeção de HTML na mensagem enviada.
  corpo: z
    .string()
    .trim()
    .min(1, 'Escreva a mensagem')
    .max(30000, 'Mensagem muito longa')
    .transform((v) => sanitizarHtml(v))
    .refine((v) => v.length > 0, 'Escreva a mensagem'),
})

export type EmailCartao = { id: string; destinatario: string; assunto: string; corpo: string; enviadoEm: string; colaboradorNome: string | null }

export async function listarEmailsCartao(cartaoId: string): Promise<ActionResult<EmailCartao[]>> {
  await requireUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('cartoes_emails')
    .select('id, destinatario, assunto, corpo, enviado_em, colaboradores(nome)')
    .eq('cartao_id', cartaoId)
    .order('enviado_em', { ascending: false })

  if (error) return { ok: false, error: 'Falha ao carregar os e-mails.' }

  const emails: EmailCartao[] = (data ?? []).map((e) => ({
    id: e.id,
    destinatario: e.destinatario,
    assunto: e.assunto,
    corpo: e.corpo,
    enviadoEm: e.enviado_em,
    colaboradorNome: (e.colaboradores as unknown as { nome: string } | null)?.nome ?? null,
  }))

  return { ok: true, data: emails }
}

export async function enviarEmailCartao(cartaoId: string, quadroId: string, formData: FormData): Promise<ActionResult> {
  const { user, profile } = await requireUser()
  const supabase = await createClient()

  const parsed = emailSchema.safeParse({
    destinatario: formData.get('destinatario'),
    assunto: formData.get('assunto'),
    corpo: formData.get('corpo'),
  })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  let remetenteNome: string | null = null
  try {
    const admin = createAdminClient()
    const { data: org } = await admin.from('organizacoes').select('email_remetente_nome').eq('id', profile.organizacao_id).maybeSingle()
    remetenteNome = org?.email_remetente_nome ?? null
  } catch {
    // Sem service role em desenvolvimento: segue com o remetente padrão.
  }

  const resultado = await sendEmail({
    to: parsed.data.destinatario,
    subject: parsed.data.assunto,
    // `corpo` já saiu do schema sanitizado; layoutEmail injeta o corpo cru por
    // contrato (escapa só o título), então a garantia tem de vir daqui.
    html: layoutEmail(parsed.data.assunto, parsed.data.corpo, remetenteNome),
    remetente: { nome: remetenteNome },
  })
  if (!resultado.sent) {
    return { ok: false, error: resultado.error ?? (resultado.skipped ? `Envio desabilitado: ${resultado.skipped}` : 'Falha ao enviar o e-mail.') }
  }

  const { error } = await supabase.from('cartoes_emails').insert({
    cartao_id: cartaoId,
    colaborador_id: user.id,
    destinatario: parsed.data.destinatario,
    assunto: parsed.data.assunto,
    corpo: parsed.data.corpo,
    organizacao_id: profile.organizacao_id,
  })
  if (error) return { ok: false, error: 'E-mail enviado, mas falhou ao registrar no histórico do card.' }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}
