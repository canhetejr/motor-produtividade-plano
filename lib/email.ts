import 'server-only'
import nodemailer from 'nodemailer'
import { Resend } from 'resend'

export type EmailResult =
  | { sent: true; id: string | null }
  | { sent: false; skipped?: string; error?: string }

const FROM_RAW = process.env.EMAIL_FROM ?? process.env.RESEND_FROM_EMAIL ?? 'Vértice <notificacoes@teralabs.cloud>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://vertice.teralabs.cloud'

export const REMETENTE_PADRAO = 'Vértice'

// Endereço puro extraído de FROM_RAW (formato "Nome <endereco>" ou só
// "endereco"). Sem domínio de e-mail verificado por cliente ainda (infra
// para quando existir é outra leva — ver organizacoes.email_remetente_nome),
// o endereço de envio É SEMPRE o do Vértice: só o nome de exibição muda por
// organização.
const FROM_ENDERECO = FROM_RAW.match(/<([^>]+)>/)?.[1] ?? FROM_RAW

export type Remetente = { nome?: string | null }

// "Nome da organização <notificacoes@teralabs.cloud>" quando a organização
// tem email_remetente_nome preenchido, senão o remetente padrão do Vértice.
function montarFrom(remetente?: Remetente): string {
  const nome = remetente?.nome?.trim() || REMETENTE_PADRAO
  return `${nome} <${FROM_ENDERECO}>`
}

export async function sendEmail(opts: {
  to: string | string[]
  subject: string
  html: string
  remetente?: Remetente
}): Promise<EmailResult> {
  const from = montarFrom(opts.remetente)

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
        from,
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
    const { data, error } = await resend.emails.send({ from, to: opts.to, subject: opts.subject, html: opts.html })
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

// `remetenteNome` é o nome de exibição da organização (organizacoes.
// email_remetente_nome). Sem valor, o layout usa o remetente padrão do
// Vértice — mesma regra de montarFrom() acima, só que para o texto visível
// no corpo/rodapé, não para o cabeçalho técnico "From".
export function layoutEmail(titulo: string, corpo: string, remetenteNome?: string | null): string {
  const nome = esc(remetenteNome?.trim() || REMETENTE_PADRAO)
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <style>
      .btn{display:inline-block;background:#820AD1;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700}
      .card{background:#ffffff;border-radius:12px;border:1px solid #eaeaea;max-width:600px;width:100%}
      .muted{color:#71717a;font-size:12px}
      @media (max-width:520px){.container{padding:16px}.content{padding:16px}.header{padding:16px}}
    </style>
  </head>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:28px 0;">
      <tr><td align="center">
        <table role="presentation" class="card" cellpadding="0" cellspacing="0" style="padding:0;">
          <tr>
            <td style="padding:18px 24px;border-bottom:1px solid #f0f0f2;background:linear-gradient(90deg, rgba(130,10,209,0.06), rgba(130,10,209,0));border-top-left-radius:12px;border-top-right-radius:12px;">
              <table role="presentation" width="100%">
                <tr>
                  <td style="vertical-align:middle">
                    <a href="${APP_URL}" style="display:inline-block;text-decoration:none;color:inherit">
                      <img src="${APP_URL}/brand/vertice-wordmark.png" alt="Vértice" width="136" height="28" style="display:block;border:0;width:136px;height:auto;" />
                    </a>
                  </td>
                  <td style="text-align:right;vertical-align:middle;font-size:13px;color:#6b21a8;font-weight:600">${nome}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr><td class="content" style="padding:20px 28px 24px;font-size:15px;line-height:1.6;color:#242424;">
            <h1 style="margin:0 0 12px;font-size:20px;color:#0f172a;">${esc(titulo)}</h1>
            ${corpo}
          </td></tr>
          <tr><td style="padding:16px 28px 24px;border-top:1px solid #f0f0f2;background:#fafafa;border-bottom-left-radius:12px;border-bottom-right-radius:12px;">
            <table role="presentation" width="100%">
              <tr>
                <td style="vertical-align:middle">
                  <p style="margin:0;font-size:12px;color:#6b7280">E-mail automático de <a href="${APP_URL}" style="color:#6b21a8;text-decoration:none;font-weight:600;">${nome}</a>, via Vértice. Não responda.</p>
                </td>
                <td style="text-align:right;vertical-align:middle">
                  <a href="${APP_URL}" style="color:#6b21a8;text-decoration:none;font-weight:600">Abrir app</a>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`
}

export function emailLembrete(nome: string, remetenteNome?: string | null) {
  const primeiroNome = esc(nome.trim().split(' ')[0])
  return {
    subject: 'Lembrete: registre seus apontamentos de hoje',
    html: layoutEmail(
      `${primeiroNome}, faltam seus apontamentos de hoje`,
      `<p>Ainda não encontramos nenhum lançamento seu no dia de hoje.</p>
       <p>Leva menos de 1 minuto — registre agora para manter seu índice em dia:</p>
       <p style="margin:24px 0;">
         <a href="${APP_URL}/apontamento" style="display:inline-block;background:#820AD1;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">Registrar apontamento</a>
       </p>`,
      remetenteNome
    ),
  }
}

export function emailConvite(opts: {
  organizacaoNome: string
  convidadoPorNome: string
  link: string
  expiraEmDias: number
  remetenteNome?: string | null
}) {
  const org = esc(opts.organizacaoNome)
  const quem = esc(opts.convidadoPorNome)
  return {
    subject: `${quem} convidou você para o ${org} no Vértice`,
    html: layoutEmail(
      `Você foi convidado para o ${org}`,
      `<p><strong>${quem}</strong> criou um acesso para você no Vértice, onde o ${org} acompanha demandas, prazos e produtividade.</p>
       <p>Clique abaixo para definir sua senha e entrar:</p>
       <p style="margin:24px 0;">
         <a href="${opts.link}" style="display:inline-block;background:#820AD1;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">Aceitar convite</a>
       </p>
       <p style="font-size:13px;color:#6b7280">O convite expira em ${opts.expiraEmDias} dias. Se você não esperava este e-mail, pode ignorá-lo — nada é criado até você aceitar.</p>`,
      opts.remetenteNome
    ),
  }
}

export function emailAlertaQueda(
  casos: { nome: string; indices: number[] }[],
  dias: string[],
  remetenteNome?: string | null
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
       <p><a href="${APP_URL}/gestao" style="color:#18181b;font-weight:600;">Abrir o dashboard</a> para investigar.</p>`,
      remetenteNome
    ),
  }
}

export function emailRelatorioSemanal(r: {
  inicio: string
  fim: string
  porArea: { area: string; indice: number }[]
  porColaborador: { nome: string; tempo: number; indice: number }[]
}, remetenteNome?: string | null) {
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
       <p><a href="${APP_URL}/gestao?period=week" style="color:#18181b;font-weight:600;">Ver no dashboard</a></p>`,
      remetenteNome
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
export function emailCodigoMfa(nome: string, codigo: string, validadeMin: number, remetenteNome?: string | null) {
  const safeNome = esc(nome)
  const safeCodigo = esc(codigo)
  return {
    subject: `Seu código de acesso: ${safeCodigo}`,
    html: layoutEmail(
      'Código de acesso',
      `<p style="margin:0 0 8px;color:#374151;font-size:15px;">Olá, ${safeNome}.</p>
       <p style="margin:0 0 12px;color:#374151;font-size:15px;">Use este código para concluir o acesso:</p>
       <div style="margin:18px 0;text-align:center">
         <div style="display:inline-block;background:#fff;border:1px solid #ececec;padding:12px 22px;border-radius:8px;font-family:ui-monospace,monospace;font-size:28px;font-weight:800;letter-spacing:.12em;color:#6b21a8">${safeCodigo}</div>
       </div>
       <p style="margin:0;color:#6b7280;font-size:13px">Vale por ${validadeMin} minutos e só pode ser usado uma vez.</p>
       <p style="margin:12px 0 0;color:#6b7280;font-size:13px">Se não foi você quem tentou entrar, alguém sabe sua senha — troque-a assim que puder.</p>`,
      remetenteNome
    ),
  }
}
