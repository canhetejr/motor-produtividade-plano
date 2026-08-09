'use server'

import { revalidatePath } from 'next/cache'
import { requireOperador, registrarAcaoOperador } from '@/lib/operador-auth'
import { createAdminClient } from '@/utils/supabase/admin'
import type { ActionResult } from '@/lib/action-result'

const MAX_DIAS_TRIAL = 180

/** Lê a organização alvo — toda ação começa por aqui, e nenhuma escreve às cegas. */
async function carregarOrganizacao(admin: ReturnType<typeof createAdminClient>, id: string) {
  const { data } = await admin
    .from('organizacoes')
    .select('id, nome, status, limite_assentos, trial_expira_em, plano_id, excluir_em')
    .eq('id', id)
    .maybeSingle()
  return data
}

/**
 * Liberação de acesso: trial (ou expirada) vira cliente ativo.
 *
 * É a conversão manual que o plano previu enquanto não há gateway de
 * pagamento — e a razão de o console existir. Zera trial_expira_em porque a
 * constraint organizacoes_trial_coerente exige que só quem está em
 * 'trialing' tenha data de trial.
 */
export async function ativarOrganizacao(organizacaoId: string): Promise<ActionResult> {
  const { user } = await requireOperador()
  const admin = createAdminClient()

  const org = await carregarOrganizacao(admin, organizacaoId)
  if (!org) return { ok: false, error: 'Organização não encontrada.' }
  if (org.status === 'ativa') return { ok: false, error: 'Esta organização já está ativa.' }

  const { error } = await admin
    .from('organizacoes')
    .update({ status: 'ativa', trial_expira_em: null, suspensa_em: null })
    .eq('id', organizacaoId)

  if (error) {
    console.error('Erro ao ativar organização:', error)
    return { ok: false, error: 'Falha ao ativar a organização.' }
  }

  await registrarAcaoOperador({
    operadorId: user.id,
    acao: 'organizacao.ativar',
    organizacaoId,
    organizacaoNome: org.nome,
    detalhes: { de: org.status, para: 'ativa' },
  })

  revalidatePath('/console')
  return { ok: true }
}

/** Suspender (pendência, abuso) ou reativar quem foi suspenso. */
export async function definirSuspensao(organizacaoId: string, suspender: boolean): Promise<ActionResult> {
  const { user } = await requireOperador()
  const admin = createAdminClient()

  const org = await carregarOrganizacao(admin, organizacaoId)
  if (!org) return { ok: false, error: 'Organização não encontrada.' }

  // Reativar devolve para 'ativa', nunca para 'trialing': voltar ao trial
  // exigiria escolher nova data de expiração, e a constraint de coerência
  // recusaria o par (trialing, trial_expira_em nulo).
  const novoStatus = suspender ? 'suspensa' : 'ativa'
  const { error } = await admin
    .from('organizacoes')
    .update({
      status: novoStatus,
      suspensa_em: suspender ? new Date().toISOString() : null,
      trial_expira_em: null,
    })
    .eq('id', organizacaoId)

  if (error) {
    console.error('Erro ao mudar suspensão:', error)
    return { ok: false, error: 'Falha ao mudar o status da organização.' }
  }

  await registrarAcaoOperador({
    operadorId: user.id,
    acao: suspender ? 'organizacao.suspender' : 'organizacao.reativar',
    organizacaoId,
    organizacaoNome: org.nome,
    detalhes: { de: org.status, para: novoStatus },
  })

  revalidatePath('/console')
  return { ok: true }
}

/**
 * Assentos: muda o teto do cliente.
 *
 * Nunca abaixo do que já está ocupado — o trigger trg_assentos_verificar só
 * roda em insert/update de colaboradores e convites, então baixar o limite
 * aqui passaria batido e deixaria a organização num estado impossível
 * (ocupados > limite), que só apareceria na próxima vez que alguém tentasse
 * convidar.
 */
export async function definirLimiteAssentos(organizacaoId: string, limite: number): Promise<ActionResult> {
  const { user } = await requireOperador()

  if (!Number.isInteger(limite) || limite < 1) {
    return { ok: false, error: 'O limite precisa ser um número inteiro maior que zero.' }
  }

  const admin = createAdminClient()
  const org = await carregarOrganizacao(admin, organizacaoId)
  if (!org) return { ok: false, error: 'Organização não encontrada.' }

  const { data: ocupados, error: erroOcupados } = await admin.rpc('assentos_ocupados', { p_org: organizacaoId })
  if (erroOcupados) {
    console.error('Erro ao contar assentos:', erroOcupados)
    return { ok: false, error: 'Não foi possível conferir os assentos em uso.' }
  }
  if (limite < (ocupados ?? 0)) {
    return {
      ok: false,
      error: `Esta organização já usa ${ocupados} assento(s). Para baixar para ${limite}, desative pessoas ou revogue convites primeiro.`,
    }
  }

  const { error } = await admin.from('organizacoes').update({ limite_assentos: limite }).eq('id', organizacaoId)
  if (error) {
    console.error('Erro ao definir limite de assentos:', error)
    return { ok: false, error: 'Falha ao alterar o limite de assentos.' }
  }

  await registrarAcaoOperador({
    operadorId: user.id,
    acao: 'organizacao.limite_assentos',
    organizacaoId,
    organizacaoNome: org.nome,
    detalhes: { de: org.limite_assentos, para: limite, ocupados },
  })

  revalidatePath('/console')
  return { ok: true }
}

/**
 * Período de cortesia: estende o trial em N dias, contados a partir de hoje
 * ou do vencimento — o que for maior.
 *
 * Somar sobre a data vencida daria "estendi 7 dias" e o cliente continuar
 * expirado, que é o erro que a pessoa do outro lado percebe primeiro.
 */
export async function estenderTrial(organizacaoId: string, dias: number): Promise<ActionResult> {
  const { user } = await requireOperador()

  if (!Number.isInteger(dias) || dias < 1 || dias > MAX_DIAS_TRIAL) {
    return { ok: false, error: `Informe de 1 a ${MAX_DIAS_TRIAL} dias.` }
  }

  const admin = createAdminClient()
  const org = await carregarOrganizacao(admin, organizacaoId)
  if (!org) return { ok: false, error: 'Organização não encontrada.' }
  if (org.status === 'suspensa' || org.status === 'excluindo') {
    return { ok: false, error: 'Reative a organização antes de mexer no período de cortesia.' }
  }

  const base = org.trial_expira_em && new Date(org.trial_expira_em) > new Date()
    ? new Date(org.trial_expira_em)
    : new Date()
  const novaData = new Date(base.getTime() + dias * 86_400_000).toISOString()

  const { error } = await admin
    .from('organizacoes')
    .update({ status: 'trialing', trial_expira_em: novaData })
    .eq('id', organizacaoId)

  if (error) {
    console.error('Erro ao estender trial:', error)
    return { ok: false, error: 'Falha ao estender o período de cortesia.' }
  }

  await registrarAcaoOperador({
    operadorId: user.id,
    acao: 'organizacao.estender_trial',
    organizacaoId,
    organizacaoNome: org.nome,
    detalhes: { dias, de: org.trial_expira_em, para: novaData, statusAnterior: org.status },
  })

  revalidatePath('/console')
  return { ok: true }
}

/**
 * Encerrar o período de cortesia agora: o cliente cai para 'expirada' e vê
 * /conta/expirada no próximo acesso. Nada é apagado.
 */
export async function encerrarTrial(organizacaoId: string): Promise<ActionResult> {
  const { user } = await requireOperador()
  const admin = createAdminClient()

  const org = await carregarOrganizacao(admin, organizacaoId)
  if (!org) return { ok: false, error: 'Organização não encontrada.' }
  if (org.status !== 'trialing') {
    return { ok: false, error: 'Só dá para encerrar o período de cortesia de quem está em teste.' }
  }

  const { error } = await admin
    .from('organizacoes')
    .update({ status: 'expirada', trial_expira_em: null })
    .eq('id', organizacaoId)

  if (error) {
    console.error('Erro ao encerrar trial:', error)
    return { ok: false, error: 'Falha ao encerrar o período de cortesia.' }
  }

  await registrarAcaoOperador({
    operadorId: user.id,
    acao: 'organizacao.encerrar_trial',
    organizacaoId,
    organizacaoNome: org.nome,
    detalhes: { trialExpiravaEm: org.trial_expira_em },
  })

  revalidatePath('/console')
  return { ok: true }
}

export type Conferencia = {
  pessoas: { nome: string; role: string; ativo: boolean; area: string | null }[]
  convitesPendentes: number
  ultimoApontamento: string | null
  totais: { apontamentos: number; quadros: number; cartoes: number }
}

/**
 * Conferência: o retrato de uma organização antes de decidir sobre ela.
 *
 * Carregado sob demanda (e não junto da lista) porque são cinco consultas
 * por organização — puxar isso para todas as linhas transformaria a abertura
 * do console em dezenas de queries.
 */
export async function conferirOrganizacao(organizacaoId: string): Promise<ActionResult<Conferencia>> {
  await requireOperador()
  const admin = createAdminClient()

  const [pessoas, convites, ultimo, apontamentos, quadros, cartoes] = await Promise.all([
    admin
      .from('colaboradores')
      .select('nome, role, ativo, areas(nome)')
      .eq('organizacao_id', organizacaoId)
      .order('nome'),
    admin
      .from('convites')
      .select('id', { count: 'exact', head: true })
      .eq('organizacao_id', organizacaoId)
      .is('aceito_em', null)
      .is('revogado_em', null)
      .gt('expira_em', new Date().toISOString()),
    admin
      .from('apontamentos')
      .select('data')
      .eq('organizacao_id', organizacaoId)
      .order('data', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin.from('apontamentos').select('id', { count: 'exact', head: true }).eq('organizacao_id', organizacaoId),
    admin.from('quadros').select('id', { count: 'exact', head: true }).eq('organizacao_id', organizacaoId),
    admin.from('cartoes').select('id', { count: 'exact', head: true }).eq('organizacao_id', organizacaoId),
  ])

  if (pessoas.error) {
    console.error('Erro na conferência da organização:', pessoas.error)
    return { ok: false, error: 'Falha ao carregar os dados da organização.' }
  }

  return {
    ok: true,
    data: {
      pessoas: (pessoas.data ?? []).map((p) => ({
        nome: p.nome,
        role: p.role,
        ativo: p.ativo,
        area: p.areas?.nome ?? null,
      })),
      convitesPendentes: convites.count ?? 0,
      ultimoApontamento: ultimo.data?.data ?? null,
      totais: {
        apontamentos: apontamentos.count ?? 0,
        quadros: quadros.count ?? 0,
        cartoes: cartoes.count ?? 0,
      },
    },
  }
}

const BUCKETS_POR_ORGANIZACAO = ['avatars', 'anexos-cartoes'] as const

/**
 * Marca para exclusão: a conta some para o cliente (org_atual() devolve NULL
 * em 'excluindo') mas nada é apagado ainda.
 *
 * É o passo que separa "decidi encerrar" de "apaguei" — e existe justamente
 * para que os dois nunca sejam o mesmo clique.
 */
export async function marcarParaExclusao(organizacaoId: string, diasAteApagar: number): Promise<ActionResult> {
  const { user } = await requireOperador()

  if (!Number.isInteger(diasAteApagar) || diasAteApagar < 0 || diasAteApagar > 365) {
    return { ok: false, error: 'Informe de 0 a 365 dias de carência.' }
  }

  const admin = createAdminClient()
  const org = await carregarOrganizacao(admin, organizacaoId)
  if (!org) return { ok: false, error: 'Organização não encontrada.' }
  if (org.status === 'excluindo') return { ok: false, error: 'Esta organização já está marcada para exclusão.' }

  const excluirEm = new Date(Date.now() + diasAteApagar * 86_400_000).toISOString()

  const { error } = await admin
    .from('organizacoes')
    .update({ status: 'excluindo', excluir_em: excluirEm, trial_expira_em: null })
    .eq('id', organizacaoId)

  if (error) {
    console.error('Erro ao marcar organização para exclusão:', error)
    return { ok: false, error: 'Falha ao marcar para exclusão.' }
  }

  await registrarAcaoOperador({
    operadorId: user.id,
    acao: 'organizacao.marcar_exclusao',
    organizacaoId,
    organizacaoNome: org.nome,
    detalhes: { de: org.status, excluirEm, diasAteApagar },
  })

  revalidatePath('/console')
  return { ok: true }
}

/** Volta atrás: 'excluindo' → 'suspensa'. O dado nunca saiu do lugar. */
export async function cancelarExclusao(organizacaoId: string): Promise<ActionResult> {
  const { user } = await requireOperador()
  const admin = createAdminClient()

  const org = await carregarOrganizacao(admin, organizacaoId)
  if (!org) return { ok: false, error: 'Organização não encontrada.' }
  if (org.status !== 'excluindo') return { ok: false, error: 'Esta organização não está marcada para exclusão.' }

  const { error } = await admin
    .from('organizacoes')
    .update({ status: 'suspensa', excluir_em: null, suspensa_em: new Date().toISOString() })
    .eq('id', organizacaoId)

  if (error) {
    console.error('Erro ao cancelar exclusão:', error)
    return { ok: false, error: 'Falha ao cancelar a exclusão.' }
  }

  await registrarAcaoOperador({
    operadorId: user.id,
    acao: 'organizacao.cancelar_exclusao',
    organizacaoId,
    organizacaoNome: org.nome,
    detalhes: { excluirEmAnterior: org.excluir_em },
  })

  revalidatePath('/console')
  return { ok: true }
}

/**
 * Exclusão definitiva. Irreversível, e por isso cercada por quatro travas:
 *
 *  1. só de 'excluindo' — obriga a passar pelo estado intermediário antes;
 *  2. exige o nome digitado por extenso, conferido no servidor (confirmar no
 *     cliente protege contra clique errado, não contra requisição forjada);
 *  3. registra na trilha ANTES de apagar, com o retrato do que existia — o
 *     registro sobrevive à organização, e depois do delete não haveria mais
 *     de onde tirar esses números;
 *  4. `organizacao_id` em operadores_acoes é `on delete set null`, então a
 *     linha da trilha não vai junto no cascade.
 *
 * O plano previa esta ação como manual e explícita, nunca por cron
 * (PLANO-PRODUTO.md, risco 5): o delete desce em cascata por 43 tabelas.
 */
export async function excluirOrganizacao(organizacaoId: string, nomeDigitado: string): Promise<ActionResult> {
  const { user } = await requireOperador()
  const admin = createAdminClient()

  const org = await carregarOrganizacao(admin, organizacaoId)
  if (!org) return { ok: false, error: 'Organização não encontrada.' }
  if (org.status !== 'excluindo') {
    return { ok: false, error: 'Marque a organização para exclusão antes de apagar em definitivo.' }
  }
  if (nomeDigitado.trim() !== org.nome) {
    return { ok: false, error: 'O nome digitado não confere com o da organização.' }
  }

  // Retrato antes de apagar — depois do delete não há de onde tirar.
  const [{ count: apontamentos }, { count: pessoas }, { data: usuarios }] = await Promise.all([
    admin.from('apontamentos').select('id', { count: 'exact', head: true }).eq('organizacao_id', organizacaoId),
    admin.from('colaboradores').select('id', { count: 'exact', head: true }).eq('organizacao_id', organizacaoId),
    admin.from('colaboradores').select('id').eq('organizacao_id', organizacaoId),
  ])

  await registrarAcaoOperador({
    operadorId: user.id,
    acao: 'organizacao.excluir',
    organizacaoId,
    organizacaoNome: org.nome,
    detalhes: { apontamentos: apontamentos ?? 0, pessoas: pessoas ?? 0, slug: org.nome },
  })

  const { error } = await admin.from('organizacoes').delete().eq('id', organizacaoId)
  if (error) {
    console.error('Erro ao excluir organização:', error)
    return { ok: false, error: 'Falha ao excluir a organização. Nada foi apagado.' }
  }

  // Contas de autenticação não estão no cascade: colaboradores.id referencia
  // auth.users, não o contrário. Sem isto o e-mail continua ocupado e a
  // pessoa não consegue se cadastrar de novo em outra empresa.
  for (const u of usuarios ?? []) {
    const { error: erroAuth } = await admin.auth.admin.deleteUser(u.id)
    if (erroAuth) console.error('Falha ao apagar usuário %s da organização excluída:', u.id, erroAuth)
  }

  // Storage também fica fora do cascade do Postgres. Falha aqui não desfaz a
  // exclusão — o dado de negócio já foi, e arquivo órfão é problema menor do
  // que deixar a organização meio apagada.
  for (const bucket of BUCKETS_POR_ORGANIZACAO) {
    const { data: arquivos, error: erroLista } = await admin.storage.from(bucket).list(organizacaoId)
    if (erroLista || !arquivos?.length) continue
    const caminhos = arquivos.map((a) => `${organizacaoId}/${a.name}`)
    const { error: erroRemove } = await admin.storage.from(bucket).remove(caminhos)
    if (erroRemove) console.error('Falha ao limpar o bucket %s da organização %s:', bucket, organizacaoId, erroRemove)
  }

  revalidatePath('/console')
  return { ok: true }
}
