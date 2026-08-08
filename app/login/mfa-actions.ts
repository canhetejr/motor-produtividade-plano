'use server'

import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { sendEmail, emailCodigoMfa } from '@/lib/email'
import {
  gerarCodigo,
  hashCodigo,
  verificarCodigo,
  expiraEm,
  MENSAGEM_RECUSA,
  VALIDADE_MIN,
} from '@/lib/mfa'
import { registrarAuditoria } from '@/lib/auditoria'
import { COOKIE_MFA } from '@/lib/mfa-cookie'

/** Cria o desafio e manda o código. Chamado pela action de login. */
export async function iniciarDesafioMfa(
  colaboradorId: string,
  nome: string,
  email: string
): Promise<void> {
  const admin = createAdminClient()
  const agora = new Date()

  const codigo = gerarCodigo()
  const sal = randomBytes(16).toString('hex')

  // Desafios anteriores em aberto são invalidados: dois códigos válidos ao
  // mesmo tempo dobram a superfície sem nenhum ganho.
  await admin
    .from('desafios_mfa')
    .update({ verificado_em: agora.toISOString() })
    .eq('colaborador_id', colaboradorId)
    .is('verificado_em', null)

  const { data, error } = await admin
    .from('desafios_mfa')
    .insert({
      colaborador_id: colaboradorId,
      // O sal viaja junto do hash: é público por definição, e guardá-lo à parte
      // só criaria uma segunda tabela para manter em sincronia.
      codigo_hash: `${sal}:${hashCodigo(codigo, sal)}`,
      expira_em: expiraEm(agora),
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('Falha ao criar desafio MFA: code=%s message=%s', error?.code, error?.message)
    return
  }

  const { subject, html } = emailCodigoMfa(nome, codigo, VALIDADE_MIN)
  await sendEmail({ to: email, subject, html })

  const jar = await cookies()
  jar.set(COOKIE_MFA, data.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    // Um pouco além da validade do código: o cookie sobreviver ao desafio é o
    // que permite mostrar "expirou" em vez de "nenhum código pendente".
    maxAge: (VALIDADE_MIN + 5) * 60,
    path: '/',
  })
}

export async function verificarMfa(formData: FormData) {
  const jar = await cookies()
  const desafioId = jar.get(COOKIE_MFA)?.value
  if (!desafioId) redirect('/login')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: linha } = await admin
    .from('desafios_mfa')
    .select('colaborador_id, codigo_hash, expira_em, tentativas, verificado_em')
    .eq('id', desafioId)
    .maybeSingle()

  // O desafio tem que ser de quem está logado. Sem esta checagem, um cookie
  // roubado de outra sessão valeria aqui.
  if (!linha || linha.colaborador_id !== user.id) {
    redirect('/login/verificar?erro=' + encodeURIComponent(MENSAGEM_RECUSA.inexistente))
  }

  const [sal, hash] = linha.codigo_hash.split(':')
  const resultado = verificarCodigo(
    {
      codigoHash: hash,
      sal,
      expiraEm: linha.expira_em,
      tentativas: linha.tentativas,
      verificadoEm: linha.verificado_em,
    },
    String(formData.get('codigo') ?? ''),
    new Date()
  )

  if (!resultado.ok) {
    // Contar a tentativa é o que faz o teto valer; sem isso o limite é enfeite.
    if (resultado.motivo === 'incorreto') {
      await admin
        .from('desafios_mfa')
        .update({ tentativas: linha.tentativas + 1 })
        .eq('id', desafioId)
    }
    redirect('/login/verificar?erro=' + encodeURIComponent(MENSAGEM_RECUSA[resultado.motivo]))
  }

  await admin
    .from('desafios_mfa')
    .update({ verificado_em: new Date().toISOString() })
    .eq('id', desafioId)

  jar.delete(COOKIE_MFA)

  const { data: perfil } = await admin
    .from('colaboradores')
    .select('organizacao_id')
    .eq('id', user.id)
    .single()

  await registrarAuditoria(
    {
      atorId: user.id,
      acao: 'auth.mfa_verificado',
      entidade: 'auth',
      entidadeId: user.id,
    },
    perfil?.organizacao_id ?? ''
  )

  redirect('/apontamento')
}
