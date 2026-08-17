'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireGestor, requireUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { notificarGestores } from '@/lib/notifications'
import { registrarAuditoria } from '@/lib/auditoria'
import { lerPlanilha, faltandoColunas, type LinhaImportResultado, type ResultadoImportacao } from '@/lib/import-planilha'
import { lerBooleano } from '@/lib/planilha-cabecalho'
import { areasFaltantes, chaveArea, lerAreasAprovadas } from '@/lib/import-areas'
import { prepararDemanda } from '@/lib/demandas'
import { parseTempo } from '@/lib/tempo'
import type { ActionResult } from '@/lib/action-result'

// Mapeia os códigos que aprovar_solicitacao()/rejeitar_solicitacao() (RPC,
// banco — 20260722030000) levantam via RAISE EXCEPTION de volta pra
// mensagem amigável.
const ERROS_SOLICITACAO: Record<string, string> = {
  NAO_AUTORIZADO: 'Você não tem permissão para essa ação.',
  SOLICITACAO_NAO_ENCONTRADA: 'Solicitação não encontrada ou já processada.',
  DEMANDA_BLOCOS_SEM_TEMPO: 'Demanda dividida em blocos precisa de um tempo padrão definido.',
  DEMANDA_FINITA_SEM_BLOCOS: 'Demanda finita precisa estar dividida em mais de 1 bloco.',
  ALTERACAO_SEM_DEMANDA: 'Solicitação de alteração sem demanda original associada.',
  NOME_DUPLICADO: 'Já existe uma demanda com esse nome.',
}

const areaSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome da área'),
  // Área em comum (20260817180000_areas_comum.sql): demandas dela ficam
  // disponíveis pra colaborador de qualquer área, não só desta.
  comum: z.boolean(),
})

const demandaSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome da demanda'),
  tempo_padrao_min: z
    .preprocess(
      (v) => parseTempo(v as string | number),
      z.number().int('Tempo padrão deve ser em minutos inteiros').positive('Tempo padrão deve ser maior que zero').nullable()
    )
    .catch(null),
  variavel: z.boolean(),
  blocos_totais: z.coerce
    .number()
    .int('Blocos deve ser um número inteiro')
    .min(1, 'Blocos deve ser no mínimo 1')
    .catch(1),
  // "Bloco finito" (Fase 2): teto GLOBAL, somando todos os colaboradores
  // que lançam nessa demanda — pra tarefas tipo "projeto com X blocos que
  // se esgotam", diferente do blocos_totais comum (recorrente, teto por
  // lançamento). Só faz sentido com blocos_totais > 1 — ver prepararDemanda.
  finita: z.boolean().catch(false),
})


// === AREAS ===

export async function createArea(formData: FormData): Promise<ActionResult> {
  const { user, profile } = await requireGestor()
  const supabase = await createClient()

  const parsed = areaSchema.safeParse({
    nome: formData.get('nome'),
    comum: formData.get('comum') === 'on',
  })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const { data: area, error } = await supabase
    .from('areas')
    .insert({ ...parsed.data, organizacao_id: profile.organizacao_id })
    .select('id')
    .single()
  if (error) {
    return {
      ok: false,
      error: error.code === '23505' ? 'Já existe uma área com esse nome.' : 'Falha ao criar a área.',
    }
  }

  await registrarAuditoria({
    atorId: user.id,
    acao: 'area.criar',
    entidade: 'areas',
    entidadeId: area?.id,
    depois: parsed.data,
  }, profile.organizacao_id)

  revalidatePath('/catalogo')
  revalidatePath('/gestao/catalogo')
  revalidatePath('/minhas-demandas')
  return { ok: true }
}

export async function updateArea(id: string, formData: FormData): Promise<ActionResult> {
  const { user, profile } = await requireGestor()
  const supabase = await createClient()

  const parsed = areaSchema
    .extend({ ativo: z.boolean() })
    .safeParse({
      nome: formData.get('nome'),
      comum: formData.get('comum') === 'on',
      ativo: formData.get('ativo') === 'on',
    })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const { data: antes } = await supabase.from('areas').select('nome, ativo, comum').eq('id', id).single()

  const { error } = await supabase.from('areas').update(parsed.data).eq('id', id)
  if (error) {
    return {
      ok: false,
      error: error.code === '23505' ? 'Já existe uma área com esse nome.' : 'Falha ao atualizar a área.',
    }
  }

  await registrarAuditoria({
    atorId: user.id,
    acao: 'area.atualizar',
    entidade: 'areas',
    entidadeId: id,
    antes,
    depois: parsed.data,
  }, profile.organizacao_id)

  revalidatePath('/catalogo')
  revalidatePath('/gestao/catalogo')
  revalidatePath('/minhas-demandas')
  return { ok: true }
}

// === DEMANDAS ===

export async function createDemanda(formData: FormData): Promise<ActionResult> {
  const { user, profile } = await requireGestor()
  const supabase = await createClient()

  const area_id = z.string().uuid().safeParse(formData.get('area_id'))
  if (!area_id.success) return { ok: false, error: 'Selecione uma área.' }

  const parsed = demandaSchema.safeParse({
    nome: formData.get('nome'),
    tempo_padrao_min: formData.get('tempo_padrao_min') || null,
    variavel: formData.get('variavel') === 'on',
    blocos_totais: formData.get('blocos_totais') || 1,
    finita: formData.get('finita') === 'on',
  })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const prep = prepararDemanda(parsed.data)
  if ('error' in prep) return { ok: false, error: prep.error }

  const { data: demanda, error } = await supabase
    .from('demandas')
    .insert({
      area_id: area_id.data,
      organizacao_id: profile.organizacao_id,
      ...prep.data,
    })
    .select('id')
    .single()

  if (error) {
    return {
      ok: false,
      error:
        error.code === '23505'
          ? 'Já existe uma demanda com esse nome nesta área.'
          : 'Falha ao criar a demanda.',
    }
  }

  await registrarAuditoria({
    atorId: user.id,
    acao: 'demanda.criar',
    entidade: 'demandas',
    entidadeId: demanda?.id,
    depois: prep.data,
  }, profile.organizacao_id)

  revalidatePath('/catalogo')
  revalidatePath('/gestao/catalogo')
  revalidatePath('/minhas-demandas')
  revalidatePath('/minha-semana')
  return { ok: true }
}

export async function updateDemanda(id: string, formData: FormData): Promise<ActionResult> {
  const { user, profile } = await requireGestor()
  const supabase = await createClient()

  const parsed = demandaSchema
    .extend({ ativo: z.boolean() })
    .safeParse({
      nome: formData.get('nome'),
      tempo_padrao_min: formData.get('tempo_padrao_min') || null,
      variavel: formData.get('variavel') === 'on',
      ativo: formData.get('ativo') === 'on',
      blocos_totais: formData.get('blocos_totais') || 1,
      finita: formData.get('finita') === 'on',
    })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const prep = prepararDemanda(parsed.data)
  if ('error' in prep) return { ok: false, error: prep.error }

  const { data: antes } = await supabase.from('demandas').select('*').eq('id', id).single()

  const { error } = await supabase.from('demandas').update(prep.data).eq('id', id)
  if (error) {
    return {
      ok: false,
      error:
        error.code === '23505'
          ? 'Já existe uma demanda com esse nome nesta área.'
          : 'Falha ao atualizar a demanda.',
    }
  }

  await registrarAuditoria({
    atorId: user.id,
    acao: 'demanda.atualizar',
    entidade: 'demandas',
    entidadeId: id,
    antes,
    depois: prep.data,
  }, profile.organizacao_id)

  revalidatePath('/catalogo')
  revalidatePath('/gestao/catalogo')
  revalidatePath('/minhas-demandas')
  revalidatePath('/minha-semana')
  return { ok: true }
}

// Exclusão definitiva, para a lista de catálogo não virar um museu de
// demandas inativas. Quem faz o trabalho pesado é a RPC
// excluir_demanda_definitiva (migration 20260813120000): ela arquiva os
// apontamentos da demanda em apontamentos_arquivados antes de apagar, solta o
// vínculo dos cartões e checa organização e papel por conta própria — a
// checagem daqui é para dar mensagem legível, não para autorizar.
const ERROS_EXCLUSAO_DEMANDA: Record<string, string> = {
  NAO_AUTORIZADO: 'Você não tem permissão para excluir demandas.',
  DEMANDA_NAO_ENCONTRADA: 'Demanda não encontrada.',
}

export async function excluirDemanda(id: string): Promise<ActionResult<{ arquivados: number }>> {
  const { user, profile } = await requireGestor()
  const supabase = await createClient()

  const { data: antes } = await supabase.from('demandas').select('*').eq('id', id).single()

  const { data: arquivados, error } = await supabase.rpc('excluir_demanda_definitiva', {
    p_demanda_id: id,
  })
  if (error) {
    console.error('Erro ao excluir demanda:', error)
    return {
      ok: false,
      error: ERROS_EXCLUSAO_DEMANDA[error.message] ?? 'Falha ao excluir a demanda.',
    }
  }

  await registrarAuditoria({
    atorId: user.id,
    acao: 'demanda.excluir',
    entidade: 'demandas',
    entidadeId: id,
    antes,
    depois: { apontamentos_arquivados: arquivados ?? 0 },
  }, profile.organizacao_id)

  revalidatePath('/catalogo')
  revalidatePath('/gestao/catalogo')
  revalidatePath('/minhas-demandas')
  revalidatePath('/minha-semana')
  return { ok: true, data: { arquivados: arquivados ?? 0 } }
}

// Import em massa: linhas esperadas com cabeçalho "area,nome,tempo_padrao_min,
// variavel,blocos_totais" (CSV ou XLSX — mesmo parser do export, ver
// lib/import-planilha.ts). Reaproveita demandaSchema/prepararDemanda, então
// uma linha inválida usa a mesma mensagem de erro do cadastro manual. Sem
// transação única de propósito: linha inválida não deve travar as válidas —
// o relatório por linha é o que sinaliza o que precisa de correção manual.
export async function importarDemandasCSV(formData: FormData): Promise<ActionResult<ResultadoImportacao>> {
  const { user, profile } = await requireGestor()
  const supabase = await createClient()

  const file = formData.get('arquivo')
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Selecione um arquivo CSV ou XLSX.' }
  }

  let planilha
  try {
    planilha = await lerPlanilha(file)
  } catch (err) {
    console.error('Erro ao ler planilha de demandas:', err)
    return { ok: false, error: 'Não foi possível ler o arquivo. Confira se é um CSV ou XLSX válido.' }
  }
  const { linhas } = planilha
  if (linhas.length === 0) {
    return { ok: false, error: 'Nenhuma linha encontrada no arquivo (confira o cabeçalho: area, nome, tempo_padrao_min, variavel, blocos_totais).' }
  }
  const semColunas = faltandoColunas(planilha, ['area', 'nome'])
  if (semColunas) return { ok: false, error: semColunas }

  const { data: areas } = await supabase.from('areas').select('id, nome')
  const areaPorNome = new Map((areas ?? []).map((a) => [chaveArea(a.nome), a.id]))

  // Antes de processar linha nenhuma: quais áreas o arquivo cita que não
  // existem. Se ninguém decidiu ainda o que fazer com elas, a action para
  // aqui e devolve a pergunta — nada é gravado.
  const faltantes = areasFaltantes(linhas, (areas ?? []).map((a) => a.nome))
  const aprovadas = lerAreasAprovadas(formData.get('criar_areas'))
  if (aprovadas === null && faltantes.length > 0) {
    return { ok: true, data: { areasFaltando: faltantes } }
  }

  const areasCriadas: string[] = []
  for (const nome of faltantes) {
    if (!aprovadas?.has(chaveArea(nome))) continue
    const { data: nova, error: areaError } = await supabase
      .from('areas')
      .insert({ nome, organizacao_id: profile.organizacao_id })
      .select('id')
      .single()
    if (areaError || !nova) {
      console.error('Erro ao criar área durante import: code=%s message=%s', areaError?.code, areaError?.message)
      continue
    }
    areaPorNome.set(chaveArea(nome), nova.id)
    areasCriadas.push(nome)
  }

  // O que já existe, para o import poder atualizar em vez de recusar. Sem
  // isto, subir de volta o arquivo que a tela exportou dá "já existe uma
  // demanda com esse nome" em cada linha — o ciclo exportar, corrigir na
  // planilha e reimportar, que é o motivo de existir importação em massa,
  // não fechava.
  const { data: existentes } = await supabase.from('demandas').select('id, nome, area_id')
  const chaveDemanda = (areaId: string, nome: string) => `${areaId}::${nome.trim().toLowerCase()}`
  const idPorChave = new Map(
    (existentes ?? []).map((d) => [chaveDemanda(d.area_id, d.nome), d.id])
  )

  const relatorio: LinhaImportResultado[] = []

  for (let i = 0; i < linhas.length; i++) {
    const linhaNum = i + 2 // +1 pelo cabeçalho, +1 porque planilha é base 1
    const raw = linhas[i]
    const nome = raw.nome ?? ''

    const areaId = areaPorNome.get(chaveArea(raw.area ?? ''))
    if (!areaId) {
      relatorio.push({ linha: linhaNum, nome, status: 'erro', motivo: `Área "${raw.area ?? ''}" não encontrada.` })
      continue
    }

    const variavel = lerBooleano(raw.variavel)
    const finita = lerBooleano(raw.finita)
    // Coluna do export ("Ativa"). Ausente ou vazia, a demanda entra ativa —
    // é o que se espera de um cadastro novo; o valor só existe para o
    // arquivo exportado voltar igual ao que saiu.
    const ativo = lerBooleano(raw.ativo, true)

    const parsed = demandaSchema.safeParse({
      nome,
      tempo_padrao_min: raw.tempo_padrao_min || null,
      variavel,
      blocos_totais: raw.blocos_totais || 1,
      finita,
    })
    if (!parsed.success) {
      relatorio.push({ linha: linhaNum, nome, status: 'erro', motivo: parsed.error.issues[0].message })
      continue
    }

    const prep = prepararDemanda(parsed.data)
    if ('error' in prep) {
      relatorio.push({ linha: linhaNum, nome, status: 'erro', motivo: prep.error })
      continue
    }

    const existenteId = idPorChave.get(chaveDemanda(areaId, parsed.data.nome))

    const { error } = existenteId
      ? await supabase.from('demandas').update({ ...prep.data, ativo }).eq('id', existenteId)
      : await supabase
          .from('demandas')
          .insert({ area_id: areaId, organizacao_id: profile.organizacao_id, ...prep.data, ativo })
    if (error) {
      relatorio.push({
        linha: linhaNum,
        nome,
        status: 'erro',
        motivo: error.code === '23505' ? 'Já existe uma demanda com esse nome nesta área.' : 'Falha ao salvar.',
      })
      continue
    }

    relatorio.push({ linha: linhaNum, nome, status: 'ok', acao: existenteId ? 'atualizado' : 'criado' })
  }

  const totalCriados = relatorio.filter((r) => r.acao === 'criado').length
  const totalAtualizados = relatorio.filter((r) => r.acao === 'atualizado').length
  if (totalCriados > 0 || totalAtualizados > 0) {
    await registrarAuditoria({
      atorId: user.id,
      acao: 'demanda.importar_csv',
      entidade: 'demandas',
      depois: {
        total_processados: linhas.length,
        total_criados: totalCriados,
        total_atualizados: totalAtualizados,
      },
    }, profile.organizacao_id)
  }

  revalidatePath('/catalogo')
  revalidatePath('/gestao/catalogo')
  revalidatePath('/minhas-demandas')
  revalidatePath('/minha-semana')
  return { ok: true, data: { relatorio, areasCriadas } }
}

// === SOLICITACOES DE DEMANDA ===

export async function criarSolicitacao(tipo: 'NOVA' | 'ALTERACAO', demanda_id: string | null, formData: FormData): Promise<ActionResult> {
  const { user, profile } = await requireUser()
  const supabase = await createClient()

  const area_id = z.string().uuid().safeParse(formData.get('area_id'))
  if (!area_id.success) return { ok: false, error: 'Selecione uma área.' }

  const parsed = demandaSchema.extend({
    ativo: z.boolean().optional(),
  }).safeParse({
    nome: formData.get('nome'),
    tempo_padrao_min: formData.get('tempo_padrao_min') || null,
    variavel: formData.get('variavel') === 'on',
    blocos_totais: formData.get('blocos_totais') || 1,
    finita: formData.get('finita') === 'on',
    ativo: formData.get('ativo') === 'on',
  })

  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const prep = prepararDemanda(parsed.data)
  if ('error' in prep) return { ok: false, error: prep.error }

  const { data: sol, error } = await supabase
    .from('solicitacoes_demandas')
    .insert({
      colaborador_id: user.id,
      organizacao_id: profile.organizacao_id,
      area_id: area_id.data,
      demanda_id,
      tipo,
      nome: prep.data.nome,
      tempo_padrao_min: prep.data.tempo_padrao_min,
      variavel: prep.data.variavel,
      blocos_totais: prep.data.blocos_totais,
      finita: prep.data.finita,
      ativo: prep.data.ativo,
      status: 'PENDENTE',
    })
    .select('id')
    .single()

  if (error) {
    console.error(error)
    return { ok: false, error: 'Falha ao enviar sugestão. Tente novamente mais tarde.' }
  }

  await notificarGestores(
    {
      tipo: 'solicitacao_pendente',
      titulo: tipo === 'NOVA' ? 'Nova demanda sugerida' : 'Alteração de demanda sugerida',
      mensagem: `${profile.nome} sugeriu: ${parsed.data.nome}`,
      link: '/gestao/catalogo?tab=solicitacoes',
    },
    profile.organizacao_id
  )

  await registrarAuditoria({
    atorId: user.id,
    acao: 'solicitacao.criar',
    entidade: 'solicitacoes_demandas',
    entidadeId: sol?.id,
    depois: { tipo, demanda_id, ...prep.data },
  }, profile.organizacao_id)

  revalidatePath('/catalogo')
  revalidatePath('/gestao/catalogo')
  revalidatePath('/minhas-demandas')
  return { ok: true }
}

// aprovar_solicitacao/rejeitar_solicitacao (RPC, SECURITY DEFINER) fazem
// claim atômico + normalização + insert/update em demandas + notificação
// numa única transação — antes eram 4-5 chamadas separadas, e uma falha no
// meio podia deixar a solicitação "APROVADA" sem demanda correspondente ou
// perder a notificação. Um RAISE EXCEPTION na função desfaz tudo daquela
// invocação, então não precisa mais reverter o status manualmente.
export async function aprovarSolicitacao(id: string): Promise<ActionResult> {
  const { user, profile } = await requireGestor()
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('aprovar_solicitacao', { p_id: id })
  if (error || !data) {
    const codigo = error?.message ?? ''
    if (!ERROS_SOLICITACAO[codigo]) console.error('Erro ao aprovar solicitação:', error)
    return { ok: false, error: ERROS_SOLICITACAO[codigo] ?? 'Falha ao aprovar solicitação.' }
  }

  await registrarAuditoria({
    atorId: user.id,
    acao: 'solicitacao.aprovar',
    entidade: 'solicitacoes_demandas',
    entidadeId: id,
    depois: data,
  }, profile.organizacao_id)

  revalidatePath('/catalogo')
  revalidatePath('/gestao/catalogo')
  revalidatePath('/minhas-demandas')
  revalidatePath('/minha-semana')
  return { ok: true }
}

export async function rejeitarSolicitacao(id: string): Promise<ActionResult> {
  const { user, profile } = await requireGestor()
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('rejeitar_solicitacao', { p_id: id })
  if (error || !data) {
    const codigo = error?.message ?? ''
    if (!ERROS_SOLICITACAO[codigo]) console.error('Erro ao rejeitar solicitação:', error)
    return { ok: false, error: ERROS_SOLICITACAO[codigo] ?? 'Falha ao rejeitar solicitação.' }
  }

  await registrarAuditoria({
    atorId: user.id,
    acao: 'solicitacao.rejeitar',
    entidade: 'solicitacoes_demandas',
    entidadeId: id,
    depois: data,
  }, profile.organizacao_id)

  revalidatePath('/catalogo')
  revalidatePath('/gestao/catalogo')
  revalidatePath('/minhas-demandas')
  return { ok: true }
}

// Colaborador desiste de uma sugestão antes do gestor agir — sem isso, só
// dava pra esperar aprovação/rejeição mesmo em caso de engano.
export async function cancelarSolicitacao(id: string): Promise<ActionResult> {
  const { user, profile } = await requireUser()
  const supabase = await createClient()

  const { error } = await supabase
    .from('solicitacoes_demandas')
    .delete()
    .eq('id', id)
    .eq('colaborador_id', user.id)
    .eq('status', 'PENDENTE')

  if (error) return { ok: false, error: 'Falha ao cancelar a sugestão.' }

  await registrarAuditoria({
    atorId: user.id,
    acao: 'solicitacao.cancelar',
    entidade: 'solicitacoes_demandas',
    entidadeId: id,
  }, profile.organizacao_id)

  revalidatePath('/catalogo')
  revalidatePath('/gestao/catalogo')
  revalidatePath('/minhas-demandas')
  return { ok: true }
}

