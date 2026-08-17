'use server'

import { z } from 'zod'

import { requireUser } from '@/lib/auth'
import { sendEmail, layoutEmail } from '@/lib/email'
import type { ActionResult } from '@/lib/action-result'

const DESTINATARIO = 'canhete@teralabs.cloud'
const ANEXO_MAX_BYTES = 5 * 1024 * 1024
const ANEXO_TIPOS = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])

const schema = z.object({
  descricao: z.string().trim().min(10, 'Descreva o problema com pelo menos 10 caracteres.').max(4000),
  detalhes: z.string().trim().max(4000).optional(),
  pagina: z.string().trim().max(500).optional(),
})

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Vértice ainda não é 100% estável, e não há um canal de suporte dedicado —
// o formulário do menu "Ajuda" manda o reporte direto por e-mail em vez de
// gravar em tabela própria, o que evitaria migration + RLS para um recurso
// temporário que deve sumir quando o produto amadurecer.
export async function reportarBug(formData: FormData): Promise<ActionResult> {
  const { user, profile } = await requireUser()

  const parsed = schema.safeParse({
    descricao: formData.get('descricao'),
    detalhes: formData.get('detalhes') || undefined,
    pagina: formData.get('pagina') || undefined,
  })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const anexo = formData.get('anexo')
  let attachments: { filename: string; content: Buffer; contentType?: string }[] | undefined
  if (anexo instanceof File && anexo.size > 0) {
    if (!ANEXO_TIPOS.has(anexo.type)) {
      return { ok: false, error: 'Anexo precisa ser uma imagem (PNG, JPEG, WebP ou GIF).' }
    }
    if (anexo.size > ANEXO_MAX_BYTES) {
      return { ok: false, error: 'Imagem muito grande (máximo 5MB).' }
    }
    const buffer = Buffer.from(await anexo.arrayBuffer())
    attachments = [{ filename: anexo.name || 'anexo', content: buffer, contentType: anexo.type }]
  }

  const { descricao, detalhes, pagina } = parsed.data
  const html = layoutEmail(
    'Novo reporte de bug',
    `<p><strong>Organização:</strong> ${esc(profile.organizacoes?.nome ?? '—')}</p>
     <p><strong>Usuário:</strong> ${esc(profile.nome ?? '—')} (${esc(user.email ?? '—')})</p>
     ${pagina ? `<p><strong>Página:</strong> ${esc(pagina)}</p>` : ''}
     <p style="margin-top:16px;"><strong>Descrição do bug:</strong><br/>${esc(descricao).replace(/\n/g, '<br/>')}</p>
     ${detalhes ? `<p style="margin-top:12px;"><strong>Outras informações:</strong><br/>${esc(detalhes).replace(/\n/g, '<br/>')}</p>` : ''}`
  )

  const res = await sendEmail({
    to: DESTINATARIO,
    subject: `[Vértice] Bug reportado por ${profile.nome ?? user.email ?? 'usuário'}`,
    html,
    attachments,
  })
  if (!res.sent) {
    console.error('Erro ao enviar reporte de bug:', res.error ?? res.skipped)
    return { ok: false, error: 'Falha ao enviar o reporte. Tente novamente em instantes.' }
  }
  return { ok: true }
}
