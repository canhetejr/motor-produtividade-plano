'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireGestor, requireUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { registrarAuditoria } from '@/lib/auditoria'
import { traduzirRegraCartao } from '@/lib/kanban-regras'
import { criarNotificacao } from '@/lib/notifications'
import { dispararEvento } from '@/lib/automacoes'
import { sanitizarHtml, textoParaHtml, htmlParaTexto } from '@/lib/rich-text'
import { resolverMencoes } from '@/lib/mencoes'
import { resumirMudancas } from '@/lib/mudancas-cartao'
import { aplicarVariaveis, variaveisDeCampos } from '@/lib/variaveis'
import { formatarDataHoraBR } from '@/lib/dates'
import { agendarSincronizacaoGoogle, removerEventosGoogleDoCartao } from '@/lib/google-calendar'
import { areaComumDosResponsaveis } from '@/lib/demandas-responsaveis'
import type { ActionResult } from '@/lib/action-result'
import type { PrioridadeCartao, TipoCampoFormulario, MapeamentoCampoFormulario } from '@/lib/database.types'

const COLUNAS_PADRAO = ['A Fazer', 'Em Andamento', 'Concluído']

const quadroSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome do quadro'),
  codigo: z
    .string()
    .trim()
    .min(2, 'O código deve ter de 2 a 6 letras')
    .max(6, 'O código deve ter de 2 a 6 letras')
    .regex(/^[a-zA-Z]+$/, 'O código só pode ter letras')
    .transform((v) => v.toUpperCase()),
  descricao: z
    .string()
    .trim()
    .max(500, 'Descrição muito longa (máx. 500 caracteres)')
    .optional()
    .transform((v) => v || null),
})

const colunaSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome da coluna'),
})

const cartaoSchema = z.object({
  titulo: z.string().trim().min(1, 'Informe o título do card'),
  // O teto subiu de 4000 porque agora conta MARCAÇÃO, não só o texto que a
  // pessoa digitou: uma descrição com listas e links gasta várias vezes mais
  // caracteres em tags. `sanitizarHtml` roda depois e joga fora o que não for
  // do schema do editor.
  descricao: z
    .string()
    .trim()
    .max(30000, 'Descrição muito longa')
    .optional()
    .transform((v) => (v ? sanitizarHtml(v) : null))
    .transform((v) => v || null),
  prioridade: z.enum(['baixa', 'media', 'alta']).catch('media'),
  prazo: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || null),
  tipo: z.enum(['Padrão', 'Bug', 'Melhoria', 'Solicitação']).catch('Padrão'),
  inicioDesejado: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || null),
  tempoEstimadoMin: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .nullable()
    .catch(null),
  centroId: z
    .string()
    .trim()
    .uuid()
    .optional()
    .nullable()
    .catch(null),
  // Liga o card ao catálogo: é a demanda em que o tempo cronometrado vai ser
  // lançado como apontamento (bloco 32). Sem ela o timer não pontua no índice.
  demandaId: z
    .string()
    .trim()
    .uuid()
    .optional()
    .nullable()
    .catch(null),
  tagReferencia: z
    .string()
    .trim()
    .max(60, 'Tag muito longa (máx. 60 caracteres)')
    .optional()
    .transform((v) => v || null),
  recorrencia: z
    .enum(['nenhuma', 'diaria', 'semanal', 'mensal'])
    .optional()
    .catch('nenhuma')
    .transform((v) => (v && v !== 'nenhuma' ? { tipo: v } : null)),
})

const etiquetaSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome da etiqueta'),
  cor: z.string().trim().min(1).catch('#6B7280'),
})

const comentarioSchema = z.object({
  // Mesmo raciocínio do teto da descrição: o limite passou a contar marcação.
  conteudo: z
    .string()
    .trim()
    .min(1, 'Escreva um comentário')
    .max(15000, 'Comentário muito longo')
    .transform((v) => sanitizarHtml(v))
    .refine((v) => v.length > 0, 'Escreva um comentário'),
})

// === QUADROS ===

export async function criarQuadro(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const { user, profile } = await requireGestor()
  const supabase = await createClient()

  const parsed = quadroSchema.safeParse({
    nome: formData.get('nome'),
    codigo: formData.get('codigo'),
    descricao: formData.get('descricao') ?? undefined,
  })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const membros = formData.getAll('membros').map(String).filter(Boolean)

  const { data: quadro, error } = await supabase
    .from('quadros')
    .insert({
      nome: parsed.data.nome,
      codigo: parsed.data.codigo,
      descricao: parsed.data.descricao,
      criado_por: user.id,
      organizacao_id: profile.organizacao_id,
    })
    .select('id')
    .single()

  if (error || !quadro) {
    return {
      ok: false,
      error: error?.code === '23505' ? 'Já existe um quadro com esse código.' : 'Falha ao criar o quadro.',
    }
  }

  if (membros.length > 0) {
    await supabase
      .from('quadros_membros')
      .insert(membros.map((colaborador_id) => ({ quadro_id: quadro.id, colaborador_id, organizacao_id: profile.organizacao_id })))
  }

  await supabase
    .from('colunas')
    .insert(COLUNAS_PADRAO.map((nome, posicao) => ({ quadro_id: quadro.id, nome, posicao, organizacao_id: profile.organizacao_id })))

  await registrarAuditoria({
    atorId: user.id,
    acao: 'kanban.quadro_criar',
    entidade: 'quadros',
    entidadeId: quadro.id,
    depois: parsed.data,
  }, profile.organizacao_id)

  revalidatePath('/kanban')
  return { ok: true, data: { id: quadro.id } }
}

export async function atualizarQuadro(id: string, formData: FormData): Promise<ActionResult> {
  const { user, profile } = await requireGestor()
  const supabase = await createClient()

  const parsed = quadroSchema
    .omit({ codigo: true })
    .safeParse({ nome: formData.get('nome'), descricao: formData.get('descricao') ?? undefined })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const { data: antes } = await supabase.from('quadros').select('nome, descricao').eq('id', id).single()

  const { error } = await supabase.from('quadros').update(parsed.data).eq('id', id)
  if (error) return { ok: false, error: 'Falha ao atualizar o quadro.' }

  await registrarAuditoria({
    atorId: user.id,
    acao: 'kanban.quadro_atualizar',
    entidade: 'quadros',
    entidadeId: id,
    antes,
    depois: parsed.data,
  }, profile.organizacao_id)

  revalidatePath('/kanban')
  revalidatePath(`/kanban/${id}`)
  return { ok: true }
}

export async function arquivarQuadro(id: string, ativo: boolean): Promise<ActionResult> {
  const { user, profile } = await requireGestor()
  const supabase = await createClient()

  const { error } = await supabase.from('quadros').update({ ativo }).eq('id', id)
  if (error) return { ok: false, error: 'Falha ao atualizar o quadro.' }

  await registrarAuditoria({
    atorId: user.id,
    acao: 'kanban.quadro_arquivar',
    entidade: 'quadros',
    entidadeId: id,
    depois: { ativo },
  }, profile.organizacao_id)

  revalidatePath('/kanban')
  return { ok: true }
}

// Substitui de uma vez a lista de colaboradores vinculados ao quadro —
// mesmo padrão de "trocar responsáveis" usado nos cards (apaga tudo e
// reinsere o conjunto novo), mais simples que vincular/desvincular um a um.
export async function atualizarMembrosQuadro(quadroId: string, colaboradorIds: string[]): Promise<ActionResult> {
  const { profile } = await requireGestor()
  const supabase = await createClient()

  const { error: deleteError } = await supabase.from('quadros_membros').delete().eq('quadro_id', quadroId)
  if (deleteError) return { ok: false, error: 'Falha ao atualizar os membros do quadro.' }

  if (colaboradorIds.length > 0) {
    const { error: insertError } = await supabase
      .from('quadros_membros')
      .insert(colaboradorIds.map((colaborador_id) => ({ quadro_id: quadroId, colaborador_id, organizacao_id: profile.organizacao_id })))
    if (insertError) return { ok: false, error: 'Falha ao atualizar os membros do quadro.' }
  }

  revalidatePath('/kanban')
  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}

// === COLUNAS ===

export async function criarColuna(quadroId: string, formData: FormData): Promise<ActionResult> {
  const { profile } = await requireUser()
  const supabase = await createClient()

  const parsed = colunaSchema.safeParse({ nome: formData.get('nome') })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const { count } = await supabase
    .from('colunas')
    .select('id', { count: 'exact', head: true })
    .eq('quadro_id', quadroId)

  const { error } = await supabase
    .from('colunas')
    .insert({ quadro_id: quadroId, nome: parsed.data.nome, posicao: count ?? 0, organizacao_id: profile.organizacao_id })
  if (error) return { ok: false, error: 'Falha ao criar a coluna.' }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}

export async function renomearColuna(id: string, quadroId: string, formData: FormData): Promise<ActionResult> {
  await requireUser()
  const supabase = await createClient()

  const parsed = colunaSchema.safeParse({ nome: formData.get('nome') })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const { error } = await supabase.from('colunas').update({ nome: parsed.data.nome }).eq('id', id)
  if (error) return { ok: false, error: 'Falha ao renomear a coluna.' }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}

// Etapa final e limite de WIP: os dois campos que fazem a coluna significar
// algo além de um rótulo. `etapa_final` alimenta o trigger de entrega e
// `limite_wip` o de WIP (bloco 29).
export async function configurarColuna(
  id: string,
  quadroId: string,
  config: { etapaFinal: boolean; limiteWip: number | null; slaHoras: number | null }
): Promise<ActionResult> {
  await requireGestor()
  const supabase = await createClient()

  if (config.limiteWip !== null && (!Number.isInteger(config.limiteWip) || config.limiteWip < 1)) {
    return { ok: false, error: 'O limite de WIP deve ser um número inteiro maior que zero.' }
  }
  if (config.slaHoras !== null && (!Number.isInteger(config.slaHoras) || config.slaHoras < 1)) {
    return { ok: false, error: 'O SLA da etapa deve ser um número inteiro de horas maior que zero.' }
  }

  const { error } = await supabase
    .from('colunas')
    .update({ etapa_final: config.etapaFinal, limite_wip: config.limiteWip, sla_horas: config.slaHoras })
    .eq('id', id)
  if (error) return { ok: false, error: 'Falha ao configurar a coluna.' }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}

export async function reordenarColunas(quadroId: string, colunaIds: string[]): Promise<ActionResult> {
  await requireUser()
  const supabase = await createClient()

  const resultados = await Promise.all(
    colunaIds.map((id, posicao) => supabase.from('colunas').update({ posicao }).eq('id', id))
  )
  if (resultados.some((r) => r.error)) return { ok: false, error: 'Falha ao reordenar as colunas.' }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}

export async function excluirColuna(id: string, quadroId: string): Promise<ActionResult> {
  await requireUser()
  const supabase = await createClient()

  const { error } = await supabase.from('colunas').delete().eq('id', id)
  if (error) return { ok: false, error: 'Falha ao excluir a coluna.' }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}

// === CARTÕES ===

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

async function validarResponsaveisEDemanda(
  supabase: SupabaseServerClient,
  quadroId: string,
  responsavelIds: string[],
  demandaId?: string | null
): Promise<ActionResult> {
  const ids = [...new Set(responsavelIds)]
  const membrosPromise = ids.length > 0
    ? supabase.from('quadros_membros').select('colaborador_id').eq('quadro_id', quadroId).in('colaborador_id', ids)
    : Promise.resolve({ data: [], error: null })
  const colaboradoresPromise = ids.length > 0
    ? supabase.from('colaboradores').select('id, area_id, ativo').in('id', ids)
    : Promise.resolve({ data: [], error: null })
  const demandaPromise = demandaId
    ? supabase.from('demandas').select('id, area_id, ativo').eq('id', demandaId).maybeSingle()
    : Promise.resolve({ data: null, error: null })

  const [membrosResultado, colaboradoresResultado, demandaResultado] = await Promise.all([
    membrosPromise,
    colaboradoresPromise,
    demandaPromise,
  ])
  if (membrosResultado.error || colaboradoresResultado.error || demandaResultado.error) {
    return { ok: false, error: 'Não foi possível validar responsáveis e demanda.' }
  }

  const membrosIds = new Set((membrosResultado.data ?? []).map((membro) => membro.colaborador_id))
  const colaboradores = new Map((colaboradoresResultado.data ?? []).map((colaborador) => [colaborador.id, colaborador]))
  if (ids.some((id) => !membrosIds.has(id) || !colaboradores.get(id)?.ativo)) {
    return { ok: false, error: 'Selecione apenas responsáveis ativos que pertençam ao quadro.' }
  }

  if (!demandaId) return { ok: true }
  if (ids.length === 0) return { ok: false, error: 'Selecione ao menos um responsável antes de vincular a demanda.' }
  const demanda = demandaResultado.data
  if (!demanda?.ativo) return { ok: false, error: 'Selecione uma demanda ativa do catálogo.' }
  const areaComum = areaComumDosResponsaveis(
    ids.map((id) => ({ id, areaId: colaboradores.get(id)?.area_id ?? null })),
    ids
  )
  if (areaComum !== demanda.area_id) {
    return { ok: false, error: 'A demanda deve pertencer à mesma área de todos os responsáveis.' }
  }
  return { ok: true }
}

export async function criarCartao(colunaId: string, quadroId: string, formData: FormData): Promise<ActionResult<{ id: string }>> {
  const { user, profile } = await requireUser()
  const supabase = await createClient()

  const parsed = cartaoSchema.safeParse({
    titulo: formData.get('titulo'),
    descricao: formData.get('descricao') ?? undefined,
    prioridade: formData.get('prioridade'),
    prazo: formData.get('prazo') ?? undefined,
    tipo: formData.get('tipo') ?? undefined,
    inicioDesejado: formData.get('inicioDesejado') ?? undefined,
    tempoEstimadoMin: formData.get('tempoEstimadoMin') || undefined,
    centroId: formData.get('centroId') || undefined,
    demandaId: formData.get('demandaId') || undefined,
    tagReferencia: formData.get('tagReferencia') ?? undefined,
    recorrencia: formData.get('recorrencia') ?? undefined,
  })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  // Colaborador só cria card para si mesmo — nunca para outro colega. O gate
  // é aqui, não só na UI, porque o form chega como FormData e um cliente
  // adulterado poderia enviar qualquer colaborador_id.
  const responsaveisSubmetidos = [...new Set(formData.getAll('responsaveis').map(String).filter(Boolean))]
  const responsaveis = profile.role === 'gestor' ? responsaveisSubmetidos : [user.id]
  const validacaoVinculo = await validarResponsaveisEDemanda(supabase, quadroId, responsaveis, parsed.data.demandaId)
  if (!validacaoVinculo.ok) return validacaoVinculo
  const cartaoPaiId = (formData.get('cartaoPaiId') as string) || null

  const { count } = await supabase
    .from('cartoes')
    .select('id', { count: 'exact', head: true })
    .eq('coluna_id', colunaId)

  const { data: cartao, error } = await supabase
    .from('cartoes')
    .insert({
      coluna_id: colunaId,
      // Sobrescrito pelo trigger tr_gerar_codigo_cartao (BEFORE INSERT) — o
      // tipo gerado exige a coluna porque não sabe do trigger.
      codigo: '',
      titulo: parsed.data.titulo,
      descricao: parsed.data.descricao,
      prioridade: parsed.data.prioridade as PrioridadeCartao,
      prazo: parsed.data.prazo,
      tipo: parsed.data.tipo,
      inicio_desejado: parsed.data.inicioDesejado,
      tempo_estimado_min: parsed.data.tempoEstimadoMin,
      centro_id: parsed.data.centroId,
      demanda_id: parsed.data.demandaId,
      tag_referencia: parsed.data.tagReferencia,
      recorrencia: parsed.data.recorrencia,
      cartao_pai_id: cartaoPaiId,
      posicao: count ?? 0,
      criado_por: user.id,
      organizacao_id: profile.organizacao_id,
    })
    .select('id')
    .single()

  if (error || !cartao) return { ok: false, error: 'Falha ao criar o card.' }

  if (responsaveis.length > 0) {
    await supabase
      .from('cartoes_responsaveis')
      .insert(responsaveis.map((colaborador_id) => ({ cartao_id: cartao.id, colaborador_id, organizacao_id: profile.organizacao_id })))
  }

  agendarSincronizacaoGoogle(cartao.id)
  revalidatePath(`/kanban/${quadroId}`)
  revalidatePath('/minha-semana')
  return { ok: true, data: { id: cartao.id } }
}

export async function atualizarCartao(id: string, quadroId: string, formData: FormData): Promise<ActionResult> {
  const { user, profile } = await requireUser()
  const supabase = await createClient()

  const parsed = cartaoSchema.safeParse({
    titulo: formData.get('titulo'),
    descricao: formData.get('descricao') ?? undefined,
    prioridade: formData.get('prioridade'),
    prazo: formData.get('prazo') ?? undefined,
    tipo: formData.get('tipo') ?? undefined,
    inicioDesejado: formData.get('inicioDesejado') ?? undefined,
    tempoEstimadoMin: formData.get('tempoEstimadoMin') || undefined,
    centroId: formData.get('centroId') || undefined,
    demandaId: formData.get('demandaId') || undefined,
    tagReferencia: formData.get('tagReferencia') ?? undefined,
    recorrencia: formData.get('recorrencia') ?? undefined,
  })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  // Colaborador não reatribui responsáveis por aqui — mantém quem já estava
  // (pode ser um card que o gestor alocou pra vários). Só o gestor adiciona
  // ou remove pessoas; sem isso, editar qualquer outro campo do card
  // apagaria silenciosamente os demais responsáveis.
  const { data: responsaveisAtuaisRows } = await supabase
    .from('cartoes_responsaveis')
    .select('colaborador_id')
    .eq('cartao_id', id)
  const responsaveisAtuaisIds = (responsaveisAtuaisRows ?? []).map((r) => r.colaborador_id)

  const responsaveisSubmetidos = [...new Set(formData.getAll('responsaveis').map(String).filter(Boolean))]
  const responsaveis = profile.role === 'gestor' ? responsaveisSubmetidos : responsaveisAtuaisIds
  const etiquetas = formData.getAll('etiquetas').map(String).filter(Boolean)
  const novaColunaId = (formData.get('colunaId') as string) || null
  const validacaoVinculo = await validarResponsaveisEDemanda(supabase, quadroId, responsaveis, parsed.data.demandaId)
  if (!validacaoVinculo.ok) return validacaoVinculo
  // `entregue_em` não vem mais do formulário: é derivado da coluna de destino
  // pelo trigger cartoes_aplicar_entrega (bloco 29).

  // Os campos vêm junto com a coluna: são a base do evento de histórico que
  // registra o que foi editado. Uma consulta só, não duas.
  const { data: antes } = await supabase
    .from('cartoes')
    .select('coluna_id, titulo, prazo, prioridade, tipo, inicio_desejado, tempo_estimado_min, colunas(nome)')
    .eq('id', id)
    .single()

  // Mudar a etapa pelo dialog é uma mudança de coluna como qualquer outra: sem
  // uma posição nova o card levaria a posição que tinha na coluna antiga e
  // cairia num ponto arbitrário da fila de destino.
  const mudouDeColuna = !!novaColunaId && !!antes && novaColunaId !== antes.coluna_id
  let posicaoNova: number | null = null
  if (mudouDeColuna) {
    const { count } = await supabase
      .from('cartoes')
      .select('id', { count: 'exact', head: true })
      .eq('coluna_id', novaColunaId)
    posicaoNova = count ?? 0
  }

  const { error } = await supabase
    .from('cartoes')
    .update({
      titulo: parsed.data.titulo,
      descricao: parsed.data.descricao,
      prioridade: parsed.data.prioridade as PrioridadeCartao,
      prazo: parsed.data.prazo,
      tipo: parsed.data.tipo,
      inicio_desejado: parsed.data.inicioDesejado,
      tempo_estimado_min: parsed.data.tempoEstimadoMin,
      centro_id: parsed.data.centroId,
      demanda_id: parsed.data.demandaId,
      tag_referencia: parsed.data.tagReferencia,
      recorrencia: parsed.data.recorrencia,
      ...(novaColunaId ? { coluna_id: novaColunaId } : {}),
      ...(posicaoNova !== null ? { posicao: posicaoNova } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) {
    return { ok: false, error: traduzirRegraCartao(error) ?? 'Falha ao atualizar o card.' }
  }

  // Edição de campo não deixava rastro nenhum — o histórico registrava
  // movimentação, entrega e horas, mas não prazo nem prioridade, que são
  // justamente os que geram a pergunta "quem mudou isso e quando".
  const resumo = antes
    ? resumirMudancas(
        {
          titulo: antes.titulo,
          prazo: antes.prazo,
          prioridade: antes.prioridade,
          tipo: antes.tipo,
          inicioDesejado: antes.inicio_desejado,
          tempoEstimadoMin: antes.tempo_estimado_min,
        },
        {
          titulo: parsed.data.titulo,
          prazo: parsed.data.prazo,
          prioridade: parsed.data.prioridade,
          tipo: parsed.data.tipo,
          inicioDesejado: parsed.data.inicioDesejado,
          tempoEstimadoMin: parsed.data.tempoEstimadoMin,
        }
      )
    : null
  if (resumo) {
    // Best-effort, igual ao resto dos eventos de sistema: falhar ao registrar
    // histórico não pode desfazer uma edição que já foi gravada.
    await supabase.from('comentarios_cartao').insert({
      cartao_id: id,
      colaborador_id: user.id,
      conteudo: resumo,
      tipo: 'sistema',
      organizacao_id: profile.organizacao_id,
    })
  }

  // Responsáveis por diferença, não apaga-e-reinsere: o trigger
  // cartoes_notificar_responsavel dispara em cada insert, então reinserir a
  // lista inteira notificaria todo mundo de novo a cada "Salvar".
  const antesResponsaveis = new Set(responsaveisAtuaisIds)
  const depoisResponsaveis = new Set(responsaveis)

  const removidos = [...antesResponsaveis].filter((c) => !depoisResponsaveis.has(c))
  const adicionados = [...depoisResponsaveis].filter((c) => !antesResponsaveis.has(c))

  if (removidos.length > 0) {
    await supabase.from('cartoes_responsaveis').delete().eq('cartao_id', id).in('colaborador_id', removidos)
  }
  if (adicionados.length > 0) {
    await supabase
      .from('cartoes_responsaveis')
      .insert(adicionados.map((colaborador_id) => ({ cartao_id: id, colaborador_id, organizacao_id: profile.organizacao_id })))
    // Quem assume o card passa a segui-lo — senão não recebe os comentários
    // que o SeguidoresWidget promete.
    await supabase
      .from('cartoes_seguidores')
      .upsert(
        adicionados.map((colaborador_id) => ({ cartao_id: id, colaborador_id, organizacao_id: profile.organizacao_id })),
        { onConflict: 'cartao_id,colaborador_id', ignoreDuplicates: true }
      )
  }

  // Etiquetas também por diferença: os eventos de automação tag_adicionada e
  // tag_removida precisam saber QUAL tag mudou, e apagar-e-reinserir tudo
  // faria toda etiqueta parecer removida e readicionada a cada save.
  const { data: etiquetasAtuais } = await supabase
    .from('cartoes_etiquetas')
    .select('etiqueta_id')
    .eq('cartao_id', id)
  const antesEtiquetas = new Set((etiquetasAtuais ?? []).map((e) => e.etiqueta_id))
  const depoisEtiquetas = new Set(etiquetas)

  const etiquetasRemovidas = [...antesEtiquetas].filter((e) => !depoisEtiquetas.has(e))
  const etiquetasAdicionadas = [...depoisEtiquetas].filter((e) => !antesEtiquetas.has(e))

  if (etiquetasRemovidas.length > 0) {
    await supabase.from('cartoes_etiquetas').delete().eq('cartao_id', id).in('etiqueta_id', etiquetasRemovidas)
  }
  if (etiquetasAdicionadas.length > 0) {
    await supabase
      .from('cartoes_etiquetas')
      .insert(etiquetasAdicionadas.map((etiqueta_id) => ({ cartao_id: id, etiqueta_id, organizacao_id: profile.organizacao_id })))
  }

  for (const etiquetaId of etiquetasAdicionadas) {
    await dispararEvento({ supabase, evento: 'tag_adicionada', cartaoId: id, quadroId, atorId: user.id, organizacaoId: profile.organizacao_id, dados: { etiquetaId } })
  }
  for (const etiquetaId of etiquetasRemovidas) {
    await dispararEvento({ supabase, evento: 'tag_removida', cartaoId: id, quadroId, atorId: user.id, organizacaoId: profile.organizacao_id, dados: { etiquetaId } })
  }

  if (mudouDeColuna) {
    const { data: destino } = await supabase.from('colunas').select('nome').eq('id', novaColunaId).single()
    const origemNome = (antes.colunas as unknown as { nome: string } | null)?.nome ?? '—'
    await supabase.from('comentarios_cartao').insert({
      cartao_id: id,
      colaborador_id: user.id,
      conteudo: `Moveu o card de "${origemNome}" para "${destino?.nome ?? '—'}".`,
      tipo: 'sistema',
      organizacao_id: profile.organizacao_id,
    })
    await dispararEventosDeMovimentacao(id, quadroId, user.id, profile.organizacao_id, antes.coluna_id, novaColunaId)
  }

  agendarSincronizacaoGoogle(id)
  revalidatePath(`/kanban/${quadroId}`)
  revalidatePath('/minha-semana')
  return { ok: true }
}

export async function excluirCartao(id: string, quadroId: string): Promise<ActionResult> {
  await requireUser()
  const supabase = await createClient()

  // A FK apaga o vínculo local junto com o card. Remover o evento antes
  // preserva o id necessário para também limpar o Google Calendar.
  try {
    await removerEventosGoogleDoCartao(id)
  } catch (error) {
    console.error('[google calendar card delete] card=%s', id, error)
    return { ok: false, error: 'Não foi possível remover o evento do Google. Tente excluir o card novamente.' }
  }
  const { error } = await supabase.from('cartoes').delete().eq('id', id)
  if (error) return { ok: false, error: 'Falha ao excluir o card.' }

  revalidatePath(`/kanban/${quadroId}`)
  revalidatePath('/minha-semana')
  return { ok: true }
}

// Reordenar/mover cards via drag-and-drop: o client manda a ordem final de
// cada coluna afetada (1 coluna se foi só reordenação, 2 se mudou de
// coluna) e a action grava coluna_id + posicao pra cada card dessas
// colunas de uma vez. Sem RPC/transação: são poucas linhas e uma falha
// parcial se recupera sozinha no próximo evento de Realtime.
export async function moverCartao(
  cartaoId: string,
  colunaDestinoId: string,
  ordens: { colunaId: string; cartaoIds: string[] }[],
  quadroId: string
): Promise<ActionResult> {
  const { user, profile } = await requireUser()
  const supabase = await createClient()

  const { data: antes } = await supabase.from('cartoes').select('coluna_id, colunas(nome)').eq('id', cartaoId).single()

  const { error: moveError } = await supabase.from('cartoes').update({ coluna_id: colunaDestinoId }).eq('id', cartaoId)
  if (moveError) {
    return { ok: false, error: traduzirRegraCartao(moveError) ?? 'Falha ao mover o card.' }
  }

  if (antes && antes.coluna_id !== colunaDestinoId) {
    const { data: destino } = await supabase.from('colunas').select('nome').eq('id', colunaDestinoId).single()
    const origemNome = (antes.colunas as unknown as { nome: string } | null)?.nome ?? '—'
    await supabase.from('comentarios_cartao').insert({
      cartao_id: cartaoId,
      colaborador_id: user.id,
      conteudo: `Moveu o card de "${origemNome}" para "${destino?.nome ?? '—'}".`,
      tipo: 'sistema',
      organizacao_id: profile.organizacao_id,
    })
  }

  const updates = ordens.flatMap((ordem) =>
    ordem.cartaoIds.map((id, posicao) => supabase.from('cartoes').update({ posicao }).eq('id', id))
  )
  await Promise.all(updates)

  if (antes && antes.coluna_id !== colunaDestinoId) {
    await dispararEventosDeMovimentacao(cartaoId, quadroId, user.id, profile.organizacao_id, antes.coluna_id, colunaDestinoId)
    agendarSincronizacaoGoogle(cartaoId)
  }

  revalidatePath(`/kanban/${quadroId}`)
  revalidatePath('/minha-semana')
  return { ok: true }
}

// Sair e entrar são dois eventos distintos no catálogo, e um card que é
// subtarefa dispara a variante "subtarefa_*" — a automação de referência
// distingue os dois casos.
async function dispararEventosDeMovimentacao(
  cartaoId: string,
  quadroId: string,
  atorId: string,
  organizacaoId: string,
  colunaOrigemId: string,
  colunaDestinoId: string
) {
  const supabase = await createClient()
  const { data: cartao } = await supabase.from('cartoes').select('cartao_pai_id, entregue_em').eq('id', cartaoId).single()
  const ehSubtarefa = !!cartao?.cartao_pai_id

  const base = { supabase, cartaoId, quadroId, atorId, organizacaoId }

  await dispararEvento({
    ...base,
    evento: ehSubtarefa ? 'subtarefa_saiu_etapa' : 'cartao_saiu_etapa',
    dados: { colunaId: colunaOrigemId },
  })
  await dispararEvento({
    ...base,
    evento: ehSubtarefa ? 'subtarefa_entrou_etapa' : 'cartao_entrou_etapa',
    dados: { colunaId: colunaDestinoId },
  })

  if (ehSubtarefa && cartao?.entregue_em) {
    await dispararEvento({ ...base, evento: 'subtarefa_entregue', dados: { colunaId: colunaDestinoId } })
  }
}

// === ETIQUETAS ===

export async function criarEtiqueta(quadroId: string, formData: FormData): Promise<ActionResult<{ id: string; nome: string; cor: string }>> {
  const { profile } = await requireUser()
  const supabase = await createClient()

  const parsed = etiquetaSchema.safeParse({ nome: formData.get('nome'), cor: formData.get('cor') })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const { data: etiqueta, error } = await supabase
    .from('etiquetas')
    .insert({ quadro_id: quadroId, nome: parsed.data.nome, cor: parsed.data.cor, organizacao_id: profile.organizacao_id })
    .select('id, nome, cor')
    .single()

  if (error || !etiqueta) {
    return {
      ok: false,
      error: error?.code === '23505' ? 'Já existe uma etiqueta com esse nome neste quadro.' : 'Falha ao criar a etiqueta.',
    }
  }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true, data: etiqueta }
}

export async function excluirEtiqueta(id: string, quadroId: string): Promise<ActionResult> {
  await requireUser()
  const supabase = await createClient()

  const { error } = await supabase.from('etiquetas').delete().eq('id', id)
  if (error) return { ok: false, error: 'Falha ao excluir a etiqueta.' }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}

// === COMENTÁRIOS ===

export async function criarComentario(cartaoId: string, quadroId: string, formData: FormData): Promise<ActionResult> {
  const { user, profile } = await requireUser()
  const supabase = await createClient()

  const parsed = comentarioSchema.safeParse({ conteudo: formData.get('conteudo') })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const { error } = await supabase
    .from('comentarios_cartao')
    .insert({ cartao_id: cartaoId, colaborador_id: user.id, conteudo: parsed.data.conteudo, organizacao_id: profile.organizacao_id })
  if (error) return { ok: false, error: 'Falha ao enviar o comentário.' }

  await notificarComentario(cartaoId, quadroId, user.id, parsed.data.conteudo)

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}

// Mencionado tem que ser avisado mesmo sem seguir o card — e quem segue E foi
// mencionado recebe um aviso so, com a mensagem mais especifica das duas.
async function notificarComentario(cartaoId: string, quadroId: string, autorId: string, conteudo: string) {
  const mencionados = await notificarMencionados(cartaoId, quadroId, autorId, conteudo)
  await notificarSeguidores(cartaoId, quadroId, autorId, conteudo, mencionados)
}

/** Devolve os ids notificados, para o aviso de seguidor nao repetir. */
async function notificarMencionados(
  cartaoId: string,
  quadroId: string,
  autorId: string,
  conteudo: string
): Promise<Set<string>> {
  const supabase = await createClient()

  // A menção só vale para quem é membro do quadro: mencionar alguém de fora
  // criaria uma notificação com link para um card que a pessoa não pode abrir.
  const [{ data: cartao }, { data: membros }] = await Promise.all([
    supabase.from('cartoes').select('titulo').eq('id', cartaoId).single(),
    supabase
      .from('quadros_membros')
      .select('colaborador_id, colaboradores!inner(nome)')
      .eq('quadro_id', quadroId),
  ])

  const lista = (membros ?? []).map((m) => {
    const c = Array.isArray(m.colaboradores) ? m.colaboradores[0] : m.colaboradores
    return { id: m.colaborador_id, nome: c?.nome ?? '' }
  })

  const ids = resolverMencoes(conteudo, lista).filter((id) => id !== autorId)
  if (ids.length === 0) return new Set()

  await Promise.all(
    ids.map((destinatarioId) =>
      criarNotificacao({
        destinatarioId,
        tipo: 'cartao_comentario_novo',
        titulo: 'Você foi mencionado',
        mensagem: `"${cartao?.titulo ?? 'Card'}": ${resumirComentario(conteudo)}`,
        link: `/kanban/${quadroId}?cartao=${cartaoId}`,
      })
    )
  )

  return new Set(ids)
}

// A notificação é texto puro (sino e e-mail). Sem tirar as tags, o resumo sairia
// como "<p>bom dia pess..." — e o corte em 117 caracteres poderia ainda partir
// uma tag no meio.
function resumirComentario(conteudo: string): string {
  const textoPuro = htmlParaTexto(conteudo)
  return textoPuro.length > 120 ? `${textoPuro.slice(0, 117)}...` : textoPuro
}

// Seguir um card só fazia sentido se chegasse aviso — `cartoes_seguidores`
// existia desde o bloco 22 sem ninguém ler. Best-effort, igual ao resto de
// lib/notifications.ts: falhar aqui não pode derrubar o comentário.
async function notificarSeguidores(
  cartaoId: string,
  quadroId: string,
  autorId: string,
  conteudo: string,
  jaAvisados: Set<string>
) {
  const supabase = await createClient()

  const [{ data: seguidores }, { data: cartao }] = await Promise.all([
    supabase.from('cartoes_seguidores').select('colaborador_id').eq('cartao_id', cartaoId),
    supabase.from('cartoes').select('titulo').eq('id', cartaoId).single(),
  ])

  const destinatarios = (seguidores ?? [])
    .map((s) => s.colaborador_id)
    .filter((id) => id !== autorId && !jaAvisados.has(id))
  if (destinatarios.length === 0) return

  const resumo = resumirComentario(conteudo)

  await Promise.all(
    destinatarios.map((destinatarioId) =>
      criarNotificacao({
        destinatarioId,
        tipo: 'cartao_comentario_novo',
        titulo: 'Novo comentário',
        mensagem: `"${cartao?.titulo ?? 'Card'}": ${resumo}`,
        link: `/kanban/${quadroId}`,
      })
    )
  )
}

export async function excluirComentario(id: string, quadroId: string): Promise<ActionResult> {
  const { user } = await requireUser()
  const supabase = await createClient()

  const { error } = await supabase.from('comentarios_cartao').delete().eq('id', id).eq('colaborador_id', user.id)
  if (error) return { ok: false, error: 'Falha ao excluir o comentário.' }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}

// === SEGUIDORES (watchers — só recebem notificação, não são cobrados pela entrega) ===

export async function listarSeguidores(cartaoId: string): Promise<ActionResult<string[]>> {
  await requireUser()
  const supabase = await createClient()

  const { data, error } = await supabase.from('cartoes_seguidores').select('colaborador_id').eq('cartao_id', cartaoId)
  if (error) return { ok: false, error: 'Falha ao carregar os seguidores.' }

  return { ok: true, data: (data ?? []).map((s) => s.colaborador_id) }
}

export async function alternarSeguidor(cartaoId: string, quadroId: string, seguindo: boolean): Promise<ActionResult> {
  const { user, profile } = await requireUser()
  const supabase = await createClient()

  const { error } = seguindo
    ? await supabase
        .from('cartoes_seguidores')
        .insert({ cartao_id: cartaoId, colaborador_id: user.id, organizacao_id: profile.organizacao_id })
    : await supabase.from('cartoes_seguidores').delete().eq('cartao_id', cartaoId).eq('colaborador_id', user.id)
  if (error) return { ok: false, error: 'Falha ao atualizar seguidores.' }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}

// === FORMULÁRIOS PÚBLICOS (link externo sem login → cria cartão) ===

export type CampoFormularioInput = {
  rotulo: string
  tipo: TipoCampoFormulario
  placeholder: string
  obrigatorio: boolean
  opcoes: string[]
  mapeado_para: MapeamentoCampoFormulario
}

const campoFormularioSchema = z.object({
  rotulo: z.string().trim().min(1, 'Todo campo precisa de um rótulo'),
  tipo: z.enum(['texto', 'texto_longo', 'selecao', 'data', 'prioridade']),
  placeholder: z.string().trim().max(200).catch(''),
  obrigatorio: z.boolean(),
  opcoes: z.array(z.string().trim().min(1)).catch([]),
  mapeado_para: z.enum(['titulo', 'descricao', 'prazo', 'prioridade', 'personalizado']).catch('personalizado'),
})

const formularioInputSchema = z.object({
  coluna_id: z.string().uuid('Selecione a coluna de destino'),
  titulo: z.string().trim().min(1, 'Informe o título do formulário'),
  descricao: z
    .string()
    .trim()
    .max(500, 'Descrição muito longa (máx. 500 caracteres)')
    .optional()
    .transform((v) => v || null),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'O link deve ter pelo menos 3 caracteres')
    .max(60, 'Link muito longo (máx. 60 caracteres)')
    .regex(/^[a-z0-9-]+$/, 'O link só pode ter letras minúsculas, números e hífen'),
  cor_tema: z.string().trim().min(1).catch('#820AD1'),
  mensagem_sucesso: z.string().trim().min(1, 'Informe a mensagem de sucesso').max(500),
  mostrar_marca: z.boolean(),
  // Modelos com variáveis ({{pergunta}}). Vazio vira null — null é o "sem
  // modelo" que preserva o comportamento antigo em `submeterFormulario`, e
  // string vazia geraria card sem título.
  titulo_template: z
    .string()
    .trim()
    .max(300, 'Modelo de título muito longo (máx. 300 caracteres)')
    .optional()
    .transform((v) => v || null),
  descricao_template: z
    .string()
    .trim()
    .max(4000, 'Modelo de descrição muito longo (máx. 4000 caracteres)')
    .optional()
    .transform((v) => v || null),
  campos: z.array(campoFormularioSchema).min(1, 'Adicione pelo menos um campo ao formulário'),
})

export async function criarFormulario(
  quadroId: string,
  dados: z.infer<typeof formularioInputSchema>
): Promise<ActionResult<{ id: string; slug: string }>> {
  const { user, profile } = await requireUser()
  const supabase = await createClient()

  const parsed = formularioInputSchema.safeParse(dados)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const { campos, ...formulario } = parsed.data

  const { data: novoFormulario, error } = await supabase
    .from('formularios')
    .insert({ ...formulario, quadro_id: quadroId, criado_por: user.id, organizacao_id: profile.organizacao_id })
    .select('id, slug')
    .single()

  if (error || !novoFormulario) {
    return {
      ok: false,
      error: error?.code === '23505' ? 'Já existe um formulário com esse link.' : 'Falha ao criar o formulário.',
    }
  }

  const { error: camposError } = await supabase
    .from('formularios_campos')
    .insert(
      campos.map((campo, posicao) => ({ ...campo, formulario_id: novoFormulario.id, posicao, organizacao_id: profile.organizacao_id }))
    )

  if (camposError) {
    await supabase.from('formularios').delete().eq('id', novoFormulario.id)
    return { ok: false, error: 'Falha ao salvar os campos do formulário.' }
  }

  await registrarAuditoria({
    atorId: user.id,
    acao: 'kanban.formulario_criar',
    entidade: 'formularios',
    entidadeId: novoFormulario.id,
    depois: { slug: novoFormulario.slug, titulo: formulario.titulo, quadroId },
  }, profile.organizacao_id)

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true, data: novoFormulario }
}

export async function atualizarFormulario(
  id: string,
  quadroId: string,
  dados: z.infer<typeof formularioInputSchema>
): Promise<ActionResult> {
  await requireUser()
  const supabase = await createClient()

  const parsed = formularioInputSchema.safeParse(dados)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const { campos, ...formulario } = parsed.data

  const { error } = await supabase
    .from('formularios')
    .update({ ...formulario, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) {
    return {
      ok: false,
      error: error.code === '23505' ? 'Já existe um formulário com esse link.' : 'Falha ao atualizar o formulário.',
    }
  }

  const { error: deleteError } = await supabase.from('formularios_campos').delete().eq('formulario_id', id)
  if (deleteError) return { ok: false, error: 'Falha ao atualizar os campos do formulário.' }

  const { error: camposError } = await supabase
    .from('formularios_campos')
    .insert(campos.map((campo, posicao) => ({ ...campo, formulario_id: id, posicao })))
  if (camposError) return { ok: false, error: 'Falha ao atualizar os campos do formulário.' }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}

export async function alternarFormularioAtivo(id: string, quadroId: string, ativo: boolean): Promise<ActionResult> {
  await requireUser()
  const supabase = await createClient()

  const { error } = await supabase.from('formularios').update({ ativo }).eq('id', id)
  if (error) return { ok: false, error: 'Falha ao atualizar o formulário.' }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}

export async function excluirFormulario(id: string, quadroId: string): Promise<ActionResult> {
  const { user, profile } = await requireUser()
  const supabase = await createClient()

  const { error } = await supabase.from('formularios').delete().eq('id', id)
  if (error) return { ok: false, error: 'Falha ao excluir o formulário.' }

  await registrarAuditoria({
    atorId: user.id,
    acao: 'kanban.formulario_excluir',
    entidade: 'formularios',
    entidadeId: id,
  }, profile.organizacao_id)

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}

// Submissão pública (sem login): roda pelo client admin (service role) —
// não dá pra abrir uma policy de INSERT em `cartoes` pra `anon`, já que
// qualquer um poderia inserir cartão em QUALQUER coluna só sabendo o
// UUID. O client admin bypassa RLS só depois de validar que o formulário
// existe, está ativo e todos os campos obrigatórios vieram preenchidos.
export async function submeterFormulario(
  slug: string,
  respostas: Record<string, string>
): Promise<ActionResult<{ cartaoId: string; mensagemSucesso: string }>> {
  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    console.error('submeterFormulario: SUPABASE_SERVICE_ROLE_KEY não configurada.')
    return { ok: false, error: 'Não foi possível processar sua solicitação agora. Tente novamente mais tarde.' }
  }

  const { data: formulario, error: formularioError } = await admin
    .from('formularios')
    .select('*, formularios_campos(*)')
    .eq('slug', slug.trim().toLowerCase())
    .eq('ativo', true)
    .maybeSingle()

  if (formularioError || !formulario) {
    return { ok: false, error: 'Este formulário não existe ou foi desativado.' }
  }

  const campos = (formulario.formularios_campos ?? []).sort((a, b) => a.posicao - b.posicao)

  const faltando = campos.filter((c) => c.obrigatorio && !respostas[c.id]?.trim()).map((c) => c.rotulo)
  if (faltando.length > 0) {
    return { ok: false, error: `Campos obrigatórios não preenchidos: ${faltando.join(', ')}` }
  }

  // Valores das variáveis: uma entrada por pergunta (chave derivada do
  // rótulo, ver `variaveisDeCampos`) mais as fixas do formulário. O casamento
  // resposta ↔ chave é por ÍNDICE, então `campos` precisa estar na mesma
  // ordem que o builder mostrou — daí o sort por posição acima.
  const variaveisCampos = variaveisDeCampos(campos)
  const valores: Record<string, string> = {}
  campos.forEach((campo, i) => {
    valores[variaveisCampos[i].chave] = respostas[campo.id]?.trim() ?? ''
  })
  valores.formulario = formulario.titulo
  valores.enviado_em = formatarDataHoraBR(new Date())
  valores.todas_respostas = campos
    .map((campo) => `${campo.rotulo}: ${respostas[campo.id]?.trim() || '(não respondido)'}`)
    .join('\n')

  const campoTitulo = campos.find((c) => c.mapeado_para === 'titulo')
  const campoPrimeiroTexto = campos.find((c) => c.tipo === 'texto')
  // Modelo tem precedência; sem modelo (ou quando ele resolve pra vazio, caso
  // de um formulário cujas variáveis vieram todas em branco) vale a regra
  // antiga: campo marcado como título → primeiro campo de texto → genérico.
  let titulo =
    aplicarVariaveis(formulario.titulo_template, valores).trim() ||
    (campoTitulo && respostas[campoTitulo.id]?.trim()) ||
    (campoPrimeiroTexto && respostas[campoPrimeiroTexto.id]?.trim()) ||
    `Nova solicitação via ${formulario.titulo}`
  if (titulo.length > 150) titulo = titulo.slice(0, 150) + '...'

  const campoPrioridade = campos.find((c) => c.mapeado_para === 'prioridade' || c.tipo === 'prioridade')
  const valorPrioridade = campoPrioridade ? respostas[campoPrioridade.id] : undefined
  const prioridade: PrioridadeCartao =
    valorPrioridade === 'baixa' || valorPrioridade === 'alta' ? valorPrioridade : 'media'

  const campoPrazo = campos.find((c) => c.mapeado_para === 'prazo' || c.tipo === 'data')
  const valorPrazo = campoPrazo ? respostas[campoPrazo.id]?.trim() : undefined
  const prazo = valorPrazo && !isNaN(Date.parse(valorPrazo)) ? valorPrazo : null

  const descricaoPadrao = [
    `Enviado via formulário "${formulario.titulo}" em ${valores.enviado_em}.`,
    '',
    valores.todas_respostas,
  ].join('\n')
  const descricaoTexto = formulario.descricao_template
    ? aplicarVariaveis(formulario.descricao_template, valores)
    : descricaoPadrao
  // A descrição do card virou HTML renderizado, e estas respostas vêm de um
  // visitante DESLOGADO — a rota do formulário é a única fora do gate de
  // sessão (utils/supabase/middleware.ts). Passar texto cru aqui daria XSS
  // armazenado, disparando no navegador de quem abrisse o card. textoParaHtml
  // escapa tudo e só depois monta os parágrafos. Vale igual para o modelo: as
  // variáveis carregam texto do visitante.
  const descricaoHtml = textoParaHtml(descricaoTexto)

  const { count } = await admin
    .from('cartoes')
    .select('id', { count: 'exact', head: true })
    .eq('coluna_id', formulario.coluna_id)

  const { data: novoCartao, error: cartaoError } = await admin
    .from('cartoes')
    .insert({
      coluna_id: formulario.coluna_id,
      codigo: '', // sobrescrito por tr_gerar_codigo_cartao (BEFORE INSERT)
      titulo,
      descricao: descricaoHtml,
      prioridade,
      prazo,
      posicao: count ?? 0,
      criado_por: null,
      organizacao_id: formulario.organizacao_id,
    })
    .select('id')
    .single()

  if (cartaoError || !novoCartao) {
    console.error('Erro ao criar card via formulário público:', cartaoError)
    return { ok: false, error: 'Falha ao processar sua solicitação. Tente novamente em instantes.' }
  }

  // A mensagem de sucesso volta resolvida daqui em vez de sair da página:
  // "Obrigado, {{seu_nome}}" só existe depois que o visitante respondeu.
  return {
    ok: true,
    data: {
      cartaoId: novoCartao.id,
      mensagemSucesso: aplicarVariaveis(formulario.mensagem_sucesso, valores),
    },
  }
}
