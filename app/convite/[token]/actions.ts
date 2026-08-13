'use server'

import { z } from 'zod'
import { createHash, randomBytes } from 'node:crypto'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

const aceiteSchema = z.object({
  token: z.string().trim().min(1),
  nome: z.string().trim().min(2, 'Informe seu nome'),
})

function falhar(token: string, mensagem: string): never {
  redirect(`/convite/${encodeURIComponent(token)}?message=${encodeURIComponent(mensagem)}`)
}

const MENSAGENS_RPC: Record<string, string> = {
  CONVITE_INVALIDO: 'Convite inválido.',
  CONVITE_JA_ACEITO: 'Este convite já foi aceito.',
  CONVITE_REVOGADO: 'Este convite foi revogado.',
  CONVITE_EXPIRADO: 'Este convite expirou. Peça um novo ao seu gestor.',
  // Levantadas pelo trigger trg_assentos_verificar, que roda no insert em
  // colaboradores dentro da RPC. Podem acontecer entre o envio e o aceite:
  // o convite fica válido por 7 dias, e nesse meio-tempo a empresa pode ter
  // sido suspensa ou ter estourado o teto por outro caminho.
  ORGANIZACAO_INATIVA: 'A conta da empresa que convidou você não está ativa no momento. Fale com quem te convidou.',
  LIMITE_ASSENTOS_EXCEDIDO: 'A empresa que convidou você está sem vagas no plano. Peça ao gestor para liberar um lugar e convidar de novo.',
}

// Quem aceita convite não escolhe senha aqui: o convite já é a credencial (o
// token chegou no e-mail da pessoa, é de uso único e expira). A conta nasce
// com uma senha aleatória que ninguém nunca vê, a sessão é aberta na hora, e
// `troca_senha_obrigatoria` (default true em colaboradores) faz o layout
// autenticado exigir a senha pessoal antes de liberar o app. Pedir senha na
// tela de convite era um passo a mais para o mesmo resultado — e ainda
// deixava a conta acessível por uma senha escolhida antes de qualquer prova
// de que a pessoa entrou de fato.
function senhaDescartavel() {
  return randomBytes(32).toString('base64url')
}

export async function aceitarConvite(formData: FormData): Promise<void> {
  const parsed = aceiteSchema.safeParse({
    token: formData.get('token'),
    nome: formData.get('nome'),
  })
  if (!parsed.success) {
    const token = String(formData.get('token') ?? '')
    falhar(token, parsed.error.issues[0].message)
  }

  const { token, nome } = parsed.data
  const password = senhaDescartavel()
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

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: convite.email,
    password,
    email_confirm: true,
  })
  if (authError || !created.user) {
    console.error('Erro ao criar usuário no aceite de convite:', authError)
    // E-mail que já tem conta é o caso mais provável de dar errado aqui, e
    // não é erro de quem clicou: a pessoa pode ter criado um teste por
    // conta própria antes de ser convidada. Como uma pessoa pertence a UMA
    // empresa (colaboradores.id = auth.users.id, decisão de produto), não
    // dá para simplesmente vinculá-la à nova organização — mas a tela tem
    // que dizer isso, e não devolver o texto cru do Supabase em inglês.
    // Mesmo tratamento que app/(marketing)/cadastro/actions.ts já fazia.
    if (authError?.message?.includes('already been registered')) {
      falhar(
        token,
        'Este e-mail já tem conta no Vértice. Cada pessoa pertence a uma empresa só — entre com ela, ou peça ao gestor para convidar outro e-mail. Se você precisa trocar de empresa, fale com vendas@teralabs.cloud.'
      )
    }
    // Qualquer outra falha não vira mensagem para o usuário: o texto do
    // provedor de auth é interno e pode dizer mais do que deveria.
    falhar(token, 'Não foi possível criar a conta. Tente de novo em instantes.')
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

  // Abre a sessão com a senha descartável — é a única vez em que ela é usada.
  // Se algo falhar aqui a conta já existe e está válida, então o caminho de
  // recuperação é a tela de login com "esqueci a senha", não um erro que
  // sugira refazer o convite (o token já foi consumido).
  const supabase = await createClient()
  const { error: sessaoError } = await supabase.auth.signInWithPassword({
    email: convite.email,
    password,
  })
  if (sessaoError) {
    console.error('Erro ao abrir sessão após aceite de convite:', sessaoError)
    redirect(
      '/login?message=' +
        encodeURIComponent('Conta criada! Use "Esqueci minha senha" para definir sua senha e entrar.')
    )
  }

  revalidatePath('/', 'layout')
  redirect('/setup')
}
