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
    .select('id, nome, status, limite_assentos, trial_expira_em, plano_id')
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
