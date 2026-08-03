import 'server-only'
import nodemailer from 'nodemailer'
import { Resend } from 'resend'

export type EmailResult =
  | { sent: true; id: string | null }
  | { sent: false; skipped?: string; error?: string }

const FROM = process.env.EMAIL_FROM ?? process.env.RESEND_FROM_EMAIL ?? 'Vértice <motor@unicive.cloud>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://vertice.teralabs.cloud'

export async function sendEmail(opts: {
  to: string | string[]
  subject: string
  html: string
}): Promise<EmailResult> {
  // 1. Suporte a SMTP Padrão (Sem depender de SaaS / serviço externo pago)
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      })

      const toAddresses = Array.isArray(opts.to) ? opts.to.join(', ') : opts.to
      const info = await transporter.sendMail({
        from: FROM,
        to: toAddresses,
        subject: opts.subject,
        html: opts.html,
      })

      return { sent: true, id: info.messageId }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao enviar e-mail via SMTP'
      console.error('[email] Erro ao enviar via SMTP:', msg)
      return { sent: false, error: msg }
    }
  }

  // 2. Fallback para Resend caso configurado
  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { data, error } = await resend.emails.send({ from: FROM, ...opts })
    if (error) {
      console.error('[email] falha ao enviar via Resend:', error.message)
      return { sent: false, error: error.message }
    }
    return { sent: true, id: data?.id ?? null }
  }

  // Sem NENHUMA configuração de e-mail
  console.warn('[email] Nenhuma configuração de e-mail (SMTP ou Resend) encontrada — envio pulado:', opts.subject)
  return { sent: false, skipped: 'Configuração de e-mail (SMTP_HOST/SMTP_USER ou RESEND_API_KEY) ausente' }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function layoutEmail(titulo: string, corpo: string): string {
  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;border:1px solid #e4e4e7;">
          <tr><td style="padding:24px 32px 0;">
            <p style="margin:0;font-size:13px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#820AD1;">Vértice</p>
            <h1 style="margin:8px 0 0;font-size:20px;color:#18181b;">${esc(titulo)}</h1>
          </td></tr>
          <tr><td style="padding:16px 32px 24px;font-size:14px;line-height:1.6;color:#3f3f46;">
            ${corpo}
          </td></tr>
          <tr><td style="padding:16px 32px 24px;border-top:1px solid #e4e4e7;">
            <p style="margin:0;font-size:12px;color:#a1a1aa;">E-mail automático do <a href="${APP_URL}" style="color:#820AD1;">Vértice</a>. Não responda.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`
}

export function emailLembrete(nome: string) {
  const primeiroNome = esc(nome.trim().split(' ')[0])
  return {
    subject: 'Lembrete: registre seus apontamentos de hoje',
    html: layoutEmail(
      `${primeiroNome}, faltam seus apontamentos de hoje`,
      `<p>Ainda não encontramos nenhum lançamento seu no dia de hoje.</p>
       <p>Leva menos de 1 minuto — registre agora para manter seu índice em dia:</p>
       <p style="margin:24px 0;">
         <a href="${APP_URL}/apontamento" style="display:inline-block;background:#820AD1;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">Registrar apontamento</a>
       </p>`
    ),
  }
}

export function emailAlertaQueda(
  casos: { nome: string; indices: number[] }[],
  dias: string[]
) {
  const linhas = casos
    .map(
      (c) =>
        `<tr>
           <td style="padding:8px 12px;border-bottom:1px solid #e4e4e7;">${esc(c.nome)}</td>
           ${c.indices
             .map(
               (i) =>
                 `<td style="padding:8px 12px;border-bottom:1px solid #e4e4e7;text-align:right;color:${i < 0.7 ? '#dc2626' : '#3f3f46'};">${(i * 100).toFixed(0)}%</td>`
             )
             .join('')}
         </tr>`
    )
    .join('')
  const cabecalhos = dias
    .map(
      (d) =>
        `<th style="padding:8px 12px;text-align:right;font-size:12px;color:#71717a;">${esc(d)}</th>`
    )
    .join('')
  return {
    subject: `Alerta: ${casos.length} colaborador(es) abaixo de 70% por 2 dias`,
    html: layoutEmail(
      'Queda de produtividade detectada',
      `<p>Os colaboradores abaixo ficaram com índice inferior a <strong>70%</strong> nos últimos 2 dias úteis:</p>
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #e4e4e7;border-radius:8px;">
         <tr><th style="padding:8px 12px;text-align:left;font-size:12px;color:#71717a;">Colaborador</th>${cabecalhos}</tr>
         ${linhas}
       </table>
       <p><a href="${APP_URL}/dashboard" style="color:#18181b;font-weight:600;">Abrir o dashboard</a> para investigar.</p>`
    ),
  }
}

export function emailRelatorioSemanal(r: {
  inicio: string
  fim: string
  porArea: { area: string; indice: number }[]
  porColaborador: { nome: string; tempo: number; indice: number }[]
}) {
  const areaRows = r.porArea
    .map(
      (a) =>
        `<tr>
           <td style="padding:8px 12px;border-bottom:1px solid #e4e4e7;">${esc(a.area)}</td>
           <td style="padding:8px 12px;border-bottom:1px solid #e4e4e7;text-align:right;">${(a.indice * 100).toFixed(1)}%</td>
         </tr>`
    )
    .join('')
  const colabRows = r.porColaborador
    .map(
      (c) =>
        `<tr>
           <td style="padding:8px 12px;border-bottom:1px solid #e4e4e7;">${esc(c.nome)}</td>
           <td style="padding:8px 12px;border-bottom:1px solid #e4e4e7;text-align:right;">${Math.round(c.tempo)} min</td>
           <td style="padding:8px 12px;border-bottom:1px solid #e4e4e7;text-align:right;">${(c.indice * 100).toFixed(1)}%</td>
         </tr>`
    )
    .join('')
  return {
    subject: `Relatório semanal de produtividade (${r.inicio} a ${r.fim})`,
    html: layoutEmail(
      `Resumo da semana ${r.inicio} – ${r.fim}`,
      `<h2 style="font-size:15px;color:#18181b;margin:0 0 8px;">Por área</h2>
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border:1px solid #e4e4e7;border-radius:8px;">
         <tr><th style="padding:8px 12px;text-align:left;font-size:12px;color:#71717a;">Área</th><th style="padding:8px 12px;text-align:right;font-size:12px;color:#71717a;">Índice médio</th></tr>
         ${areaRows || '<tr><td colspan="2" style="padding:8px 12px;color:#a1a1aa;">Sem dados</td></tr>'}
       </table>
       <h2 style="font-size:15px;color:#18181b;margin:0 0 8px;">Por colaborador</h2>
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border:1px solid #e4e4e7;border-radius:8px;">
         <tr><th style="padding:8px 12px;text-align:left;font-size:12px;color:#71717a;">Colaborador</th><th style="padding:8px 12px;text-align:right;font-size:12px;color:#71717a;">Entregue</th><th style="padding:8px 12px;text-align:right;font-size:12px;color:#71717a;">Índice</th></tr>
         ${colabRows || '<tr><td colspan="3" style="padding:8px 12px;color:#a1a1aa;">Sem dados</td></tr>'}
       </table>
       <p><a href="${APP_URL}/dashboard?period=week" style="color:#18181b;font-weight:600;">Ver no dashboard</a></p>`
    ),
  }
}

/**
 * Código do segundo fator.
 *
 * Sem link nem botão de propósito: um e-mail de 2FA que pede clique treina a
 * pessoa a clicar em link de e-mail sobre a própria conta, que é exatamente o
 * gesto que o phishing explora. Aqui só há um número para digitar no app que a
 * pessoa já tem aberto.
 */
export function emailCodigoMfa(nome: string, codigo: string, validadeMin: number) {
  return {
    subject: `Seu código de acesso: ${codigo}`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <p style="font-size:15px;color:#130B33">Olá, ${nome}.</p>
        <p style="font-size:15px;color:#130B33">Use este código para concluir o acesso:</p>
        <p style="font-family:ui-monospace,monospace;font-size:32px;font-weight:700;letter-spacing:.15em;color:#820AD1;margin:24px 0">${codigo}</p>
        <p style="font-size:13px;color:#606070">
          Vale por ${validadeMin} minutos e só pode ser usado uma vez.
        </p>
        <p style="font-size:13px;color:#606070">
          Se não foi você quem tentou entrar, alguém sabe sua senha —
          troque-a assim que puder.
        </p>
      </div>
    `,
  }
}
