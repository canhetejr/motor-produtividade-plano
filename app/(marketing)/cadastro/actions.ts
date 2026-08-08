'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/utils/supabase/admin'
import { verificarSenhaVazada, mensagemDeRecusa } from '@/lib/senha-vazada'

const cadastroSchema = z.object({
  empresa: z.string().trim().min(2, 'Informe o nome da empresa'),
  nome: z.string().trim().min(2, 'Informe seu nome'),
  email: z.string().trim().email('Informe um e-mail válido'),
  password: z.string().min(6, 'A senha deve ter ao menos 6 caracteres'),
})

// Mesmo padrão de app/login/actions.ts: erro vira redirect com
// ?message=, não ActionResult — o formulário não é client-driven além do
// useFormStatus, então não há onde exibir um ActionResult retornado.
function falhar(mensagem: string): never {
  redirect('/cadastro?message=' + encodeURIComponent(mensagem))
}

// Rate limit da primeira rota do app que cria linhas sem autenticação
// nenhuma. Duas camadas, sem exigir infraestrutura nova (sem Redis/KV):
//
// 1. Honeypot: campo "site" invisível para gente, que só um preenchimento
//    automático preenche. Bot que preenche todo formulário cai aqui.
// 2. Tempo mínimo de preenchimento: um carimbo de hora enviado como campo
//    oculto no primeiro render — menos de 3s entre carregar a página e
//    enviar o formulário não é humano preenchendo empresa/nome/e-mail/senha.
//
// Nenhuma das duas persiste estado entre requisições, então não barram um
// script que espera 3s e deixa o honeypot vazio — para isso, a terceira
// camada é uma janela global: mais de 20 organizações criadas nos últimos 5
// minutos (em todo o projeto) começam a ser recusadas. É grosso (não mira o
// IP/e-mail específico), mas não exige tabela nova nem serviço externo, e
// contém o cenário citado no plano ("uma tarde de script gera 10 mil
// organizações"). Se isso se provar insuficiente, o próximo passo é uma
// tabela de tentativas por IP.
const JANELA_RATE_LIMIT_MIN = 5
const LIMITE_CADASTROS_NA_JANELA = 20
const TEMPO_MINIMO_MS = 3_000
const ERRO_GENERICO = 'Não foi possível concluir o cadastro. Tente novamente.'

export async function cadastrar(formData: FormData): Promise<void> {
  // Honeypot: campo que só bot preenche. Erro genérico — não vale entregar
  // ao bot que ele foi identificado.
  if (String(formData.get('site') ?? '').trim() !== '') {
    falhar(ERRO_GENERICO)
  }

  const carimbo = Number(formData.get('carimbo'))
  if (!Number.isFinite(carimbo) || Date.now() - carimbo < TEMPO_MINIMO_MS) {
    falhar(ERRO_GENERICO)
  }

  const parsed = cadastroSchema.safeParse({
    empresa: formData.get('empresa'),
    nome: formData.get('nome'),
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    falhar(parsed.error.issues[0].message)
  }

  let admin
  try {
    admin = createAdminClient()
  } catch {
    falhar('SUPABASE_SERVICE_ROLE_KEY não configurada no servidor — necessária para criar contas.')
  }

  const desde = new Date(Date.now() - JANELA_RATE_LIMIT_MIN * 60_000).toISOString()
  const { count, error: countError } = await admin
    .from('organizacoes')
    .select('id', { count: 'exact', head: true })
    .gt('criado_em', desde)
  if (countError) {
    console.error('Erro ao checar rate limit de cadastro:', countError)
  } else if ((count ?? 0) >= LIMITE_CADASTROS_NA_JANELA) {
    falhar('Muitos cadastros em pouco tempo. Tente novamente em alguns minutos.')
  }

  const recusaSenha = mensagemDeRecusa(await verificarSenhaVazada(parsed.data.password))
  if (recusaSenha) falhar(recusaSenha)

  // 1) auth.users primeiro — fora da transação SQL, por isso vem antes.
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
  })
  if (authError || !created.user) {
    console.error('Erro ao criar usuário no cadastro:', authError)
    const mensagem = authError?.message?.includes('already been registered')
      ? 'Este e-mail já está cadastrado. Faça login ou use outro e-mail.'
      : (authError?.message ?? 'Falha ao criar a conta.')
    falhar(mensagem)
  }

  // 2) RPC transacional: organização + área padrão + colaborador gestor/admin.
  const { error: rpcError } = await admin.rpc('criar_organizacao', {
    p_user_id: created.user.id,
    p_nome_empresa: parsed.data.empresa,
    p_nome_gestor: parsed.data.nome,
  })

  if (rpcError) {
    console.error('Erro ao criar organização no cadastro:', rpcError)
    // 3) RPC falhou: apaga o usuário órfão para permitir nova tentativa com
    // o mesmo e-mail.
    await admin.auth.admin.deleteUser(created.user.id)
    falhar('Não foi possível criar sua organização. Tente novamente.')
  }

  redirect('/login?message=' + encodeURIComponent('Conta criada! Entre com seu e-mail e senha.'))
}
