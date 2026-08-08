'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireGestor } from '@/lib/auth'
import { registrarAuditoria } from '@/lib/auditoria'
import { agendarSincronizacaoGoogleEmLote } from '@/lib/google-calendar'
import { textoParaHtml } from '@/lib/rich-text'
import { traduzirRegraCartao } from '@/lib/kanban-regras'
import { areaComumDosResponsaveis } from '@/lib/demandas-responsaveis'
import { createClient } from '@/utils/supabase/server'
import type { ActionResult } from '@/lib/action-result'
import type { PrioridadeCartao } from '@/lib/database.types'

const demandaSchema = z.object({
  titulo: z.string().trim().min(1, 'Informe o título da demanda').max(300, 'Título muito longo'),
  descricao: z.string().trim().max(10_000, 'Descrição muito longa').optional().default(''),
  prazo: z.string().date('Informe uma data válida'),
  prioridade: z.enum(['baixa', 'media', 'alta']),
  demandaId: z.string().uuid('Selecione uma demanda válida do catálogo'),
  responsavelIds: z.array(z.string().uuid()).min(1, 'Selecione ao menos um responsável'),
})

const loteSchema = z.object({
  quadroId: z.string().uuid('Quadro inválido'),
  colunaId: z.string().uuid('Etapa inválida'),
  demandas: z.array(demandaSchema).min(1, 'Inclua ao menos uma demanda').max(50, 'O limite é de 50 demandas por lote'),
})

export type NovaDemandaSemana = z.input<typeof demandaSchema>
export type NovoLoteSemana = z.input<typeof loteSchema>

export type ResultadoCriacaoSemana = {
  criados: number
  ids: string[]
  sincronizacoesAgendadas: number
}

export async function criarDemandasDaSemana(input: NovoLoteSemana): Promise<ActionResult<ResultadoCriacaoSemana>> {
  const { user, profile } = await requireGestor()
  const supabase = await createClient()
  const parsed = loteSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const { quadroId, colunaId, demandas } = parsed.data
  const demandaIds = [...new Set(demandas.map((demanda) => demanda.demandaId))]
  const responsavelIds = [...new Set(demandas.flatMap((demanda) => demanda.responsavelIds))]
  const [{ data: coluna }, { data: quadro }, { data: membros }, { data: demandasCatalogo }, { data: colaboradores }] = await Promise.all([
    supabase.from('colunas').select('id, quadro_id').eq('id', colunaId).maybeSingle(),
    supabase.from('quadros').select('id, ativo').eq('id', quadroId).maybeSingle(),
    supabase.from('quadros_membros').select('colaborador_id').eq('quadro_id', quadroId),
    supabase.from('demandas').select('id, area_id, ativo').in('id', demandaIds),
    supabase.from('colaboradores').select('id, area_id, ativo').in('id', responsavelIds),
  ])
  if (!quadro?.ativo || !coluna || coluna.quadro_id !== quadroId) {
    return { ok: false, error: 'Selecione um quadro ativo e uma etapa válida.' }
  }

  const membrosIds = new Set((membros ?? []).map((membro) => membro.colaborador_id))
  const responsaveisInvalidos = demandas.flatMap((demanda) => demanda.responsavelIds).filter((id) => !membrosIds.has(id))
  if (responsaveisInvalidos.length > 0) {
    return { ok: false, error: 'Um dos responsáveis não pertence ao quadro selecionado.' }
  }
  const demandasAtivas = new Map((demandasCatalogo ?? []).filter((demanda) => demanda.ativo).map((demanda) => [demanda.id, demanda]))
  if (demandaIds.some((id) => !demandasAtivas.has(id))) {
    return { ok: false, error: 'Uma das demandas selecionadas não está ativa no catálogo.' }
  }
  const colaboradoresAtivos = new Map((colaboradores ?? []).filter((colaborador) => colaborador.ativo).map((colaborador) => [colaborador.id, colaborador]))
  if (responsavelIds.some((id) => !colaboradoresAtivos.has(id))) {
    return { ok: false, error: 'Um dos responsáveis selecionados não está ativo.' }
  }
  const vinculoForaDaArea = demandas.some((demanda) => {
    const areaDaDemanda = demandasAtivas.get(demanda.demandaId)?.area_id
    const areasDosResponsaveis = demanda.responsavelIds.map((id) => ({
      id,
      areaId: colaboradoresAtivos.get(id)?.area_id ?? null,
    }))
    return areaComumDosResponsaveis(areasDosResponsaveis, demanda.responsavelIds) !== areaDaDemanda
  })
  if (vinculoForaDaArea) {
    return { ok: false, error: 'A demanda do catálogo deve pertencer à mesma área do responsável.' }
  }

  const { count, error: countError } = await supabase
    .from('cartoes')
    .select('id', { count: 'exact', head: true })
    .eq('coluna_id', colunaId)
  if (countError) return { ok: false, error: 'Não foi possível calcular a posição das demandas.' }

  const ids = demandas.map(() => randomUUID())
  const { error: cartoesError } = await supabase.from('cartoes').insert(demandas.map((demanda, indice) => ({
    id: ids[indice],
    coluna_id: colunaId,
    titulo: demanda.titulo,
    descricao: textoParaHtml(demanda.descricao),
    prazo: demanda.prazo,
    prioridade: demanda.prioridade as PrioridadeCartao,
    demanda_id: demanda.demandaId,
    posicao: (count ?? 0) + indice,
    criado_por: user.id,
  })))
  if (cartoesError) {
    return { ok: false, error: traduzirRegraCartao(cartoesError) ?? 'Falha ao criar as demandas.' }
  }

  const vinculos = demandas.flatMap((demanda, indice) =>
    demanda.responsavelIds.map((colaborador_id) => ({ cartao_id: ids[indice], colaborador_id }))
  )
  const { error: responsaveisError } = await supabase.from('cartoes_responsaveis').insert(vinculos)
  if (responsaveisError) {
    // Sem responsável o lote não cumpre a finalidade. A remoção devolve a
    // tela ao estado anterior e evita cards órfãos após uma falha parcial.
    await supabase.from('cartoes').delete().in('id', ids)
    return { ok: false, error: 'Falha ao vincular os responsáveis. Nenhuma demanda foi mantida.' }
  }

  await registrarAuditoria({
    atorId: user.id,
    acao: demandas.length === 1 ? 'semana.demanda_criar' : 'semana.demandas_criar_lote',
    entidade: 'cartoes',
    depois: { quadroId, colunaId, quantidade: demandas.length, cartaoIds: ids },
  })

  agendarSincronizacaoGoogleEmLote(ids)

  revalidatePath('/minha-semana')
  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true, data: { criados: ids.length, ids, sincronizacoesAgendadas: ids.length } }
}
