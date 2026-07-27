'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireGestor, requireUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { registrarAuditoria } from '@/lib/auditoria'
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
  descricao: z
    .string()
    .trim()
    .max(4000, 'Descrição muito longa (máx. 4000 caracteres)')
    .optional()
    .transform((v) => v || null),
  prioridade: z.enum(['baixa', 'media', 'alta']).catch('media'),
  prazo: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || null),
})

const etiquetaSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome da etiqueta'),
  cor: z.string().trim().min(1).catch('#6B7280'),
})

const comentarioSchema = z.object({
  conteudo: z.string().trim().min(1, 'Escreva um comentário').max(2000, 'Comentário muito longo (máx. 2000 caracteres)'),
})

// === QUADROS ===

export async function criarQuadro(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const { user } = await requireGestor()
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
    .insert({ nome: parsed.data.nome, codigo: parsed.data.codigo, descricao: parsed.data.descricao, criado_por: user.id })
    .select('id')
    .single()

  if (error || !quadro) {
    return {
      ok: false,
      error: error?.code === '23505' ? 'Já existe um quadro com esse código.' : 'Falha ao criar o quadro.',
    }
  }

  if (membros.length > 0) {
    await supabase.from('quadros_membros').insert(membros.map((colaborador_id) => ({ quadro_id: quadro.id, colaborador_id })))
  }

  await supabase.from('colunas').insert(COLUNAS_PADRAO.map((nome, posicao) => ({ quadro_id: quadro.id, nome, posicao })))

  await registrarAuditoria({
    atorId: user.id,
    acao: 'kanban.quadro_criar',
    entidade: 'quadros',
    entidadeId: quadro.id,
    depois: parsed.data,
  })

  revalidatePath('/kanban')
  return { ok: true, data: { id: quadro.id } }
}

export async function atualizarQuadro(id: string, formData: FormData): Promise<ActionResult> {
  const { user } = await requireGestor()
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
  })

  revalidatePath('/kanban')
  revalidatePath(`/kanban/${id}`)
  return { ok: true }
}

export async function arquivarQuadro(id: string, ativo: boolean): Promise<ActionResult> {
  const { user } = await requireGestor()
  const supabase = await createClient()

  const { error } = await supabase.from('quadros').update({ ativo }).eq('id', id)
  if (error) return { ok: false, error: 'Falha ao atualizar o quadro.' }

  await registrarAuditoria({
    atorId: user.id,
    acao: 'kanban.quadro_arquivar',
    entidade: 'quadros',
    entidadeId: id,
    depois: { ativo },
  })

  revalidatePath('/kanban')
  return { ok: true }
}

// Substitui de uma vez a lista de colaboradores vinculados ao quadro —
// mesmo padrão de "trocar responsáveis" usado nos cards (apaga tudo e
// reinsere o conjunto novo), mais simples que vincular/desvincular um a um.
export async function atualizarMembrosQuadro(quadroId: string, colaboradorIds: string[]): Promise<ActionResult> {
  await requireGestor()
  const supabase = await createClient()

  const { error: deleteError } = await supabase.from('quadros_membros').delete().eq('quadro_id', quadroId)
  if (deleteError) return { ok: false, error: 'Falha ao atualizar os membros do quadro.' }

  if (colaboradorIds.length > 0) {
    const { error: insertError } = await supabase
      .from('quadros_membros')
      .insert(colaboradorIds.map((colaborador_id) => ({ quadro_id: quadroId, colaborador_id })))
    if (insertError) return { ok: false, error: 'Falha ao atualizar os membros do quadro.' }
  }

  revalidatePath('/kanban')
  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}

// === COLUNAS ===

export async function criarColuna(quadroId: string, formData: FormData): Promise<ActionResult> {
  await requireUser()
  const supabase = await createClient()

  const parsed = colunaSchema.safeParse({ nome: formData.get('nome') })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const { count } = await supabase
    .from('colunas')
    .select('id', { count: 'exact', head: true })
    .eq('quadro_id', quadroId)

  const { error } = await supabase
    .from('colunas')
    .insert({ quadro_id: quadroId, nome: parsed.data.nome, posicao: count ?? 0 })
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

export async function excluirColuna(id: string, quadroId: string): Promise<ActionResult> {
  await requireUser()
  const supabase = await createClient()

  const { error } = await supabase.from('colunas').delete().eq('id', id)
  if (error) return { ok: false, error: 'Falha ao excluir a coluna.' }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}

// === CARTÕES ===

export async function criarCartao(colunaId: string, quadroId: string, formData: FormData): Promise<ActionResult<{ id: string }>> {
  const { user } = await requireUser()
  const supabase = await createClient()

  const parsed = cartaoSchema.safeParse({
    titulo: formData.get('titulo'),
    descricao: formData.get('descricao') ?? undefined,
    prioridade: formData.get('prioridade'),
    prazo: formData.get('prazo') ?? undefined,
  })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const responsaveis = formData.getAll('responsaveis').map(String).filter(Boolean)

  const { count } = await supabase
    .from('cartoes')
    .select('id', { count: 'exact', head: true })
    .eq('coluna_id', colunaId)

  const { data: cartao, error } = await supabase
    .from('cartoes')
    .insert({
      coluna_id: colunaId,
      titulo: parsed.data.titulo,
      descricao: parsed.data.descricao,
      prioridade: parsed.data.prioridade as PrioridadeCartao,
      prazo: parsed.data.prazo,
      posicao: count ?? 0,
      criado_por: user.id,
    })
    .select('id')
    .single()

  if (error || !cartao) return { ok: false, error: 'Falha ao criar o card.' }

  if (responsaveis.length > 0) {
    await supabase.from('cartoes_responsaveis').insert(responsaveis.map((colaborador_id) => ({ cartao_id: cartao.id, colaborador_id })))
  }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true, data: { id: cartao.id } }
}

export async function atualizarCartao(id: string, quadroId: string, formData: FormData): Promise<ActionResult> {
  await requireUser()
  const supabase = await createClient()

  const parsed = cartaoSchema.safeParse({
    titulo: formData.get('titulo'),
    descricao: formData.get('descricao') ?? undefined,
    prioridade: formData.get('prioridade'),
    prazo: formData.get('prazo') ?? undefined,
  })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const responsaveis = formData.getAll('responsaveis').map(String).filter(Boolean)
  const etiquetas = formData.getAll('etiquetas').map(String).filter(Boolean)

  const { error } = await supabase
    .from('cartoes')
    .update({
      titulo: parsed.data.titulo,
      descricao: parsed.data.descricao,
      prioridade: parsed.data.prioridade as PrioridadeCartao,
      prazo: parsed.data.prazo,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) return { ok: false, error: 'Falha ao atualizar o card.' }

  await supabase.from('cartoes_responsaveis').delete().eq('cartao_id', id)
  if (responsaveis.length > 0) {
    await supabase.from('cartoes_responsaveis').insert(responsaveis.map((colaborador_id) => ({ cartao_id: id, colaborador_id })))
  }

  await supabase.from('cartoes_etiquetas').delete().eq('cartao_id', id)
  if (etiquetas.length > 0) {
    await supabase.from('cartoes_etiquetas').insert(etiquetas.map((etiqueta_id) => ({ cartao_id: id, etiqueta_id })))
  }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}

export async function excluirCartao(id: string, quadroId: string): Promise<ActionResult> {
  await requireUser()
  const supabase = await createClient()

  const { error } = await supabase.from('cartoes').delete().eq('id', id)
  if (error) return { ok: false, error: 'Falha ao excluir o card.' }

  revalidatePath(`/kanban/${quadroId}`)
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
  await requireUser()
  const supabase = await createClient()

  const { error: moveError } = await supabase.from('cartoes').update({ coluna_id: colunaDestinoId }).eq('id', cartaoId)
  if (moveError) return { ok: false, error: 'Falha ao mover o card.' }

  const updates = ordens.flatMap((ordem) =>
    ordem.cartaoIds.map((id, posicao) => supabase.from('cartoes').update({ posicao }).eq('id', id))
  )
  await Promise.all(updates)

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}

// === ETIQUETAS ===

export async function criarEtiqueta(quadroId: string, formData: FormData): Promise<ActionResult<{ id: string; nome: string; cor: string }>> {
  await requireUser()
  const supabase = await createClient()

  const parsed = etiquetaSchema.safeParse({ nome: formData.get('nome'), cor: formData.get('cor') })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const { data: etiqueta, error } = await supabase
    .from('etiquetas')
    .insert({ quadro_id: quadroId, nome: parsed.data.nome, cor: parsed.data.cor })
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
  const { user } = await requireUser()
  const supabase = await createClient()

  const parsed = comentarioSchema.safeParse({ conteudo: formData.get('conteudo') })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const { error } = await supabase
    .from('comentarios_cartao')
    .insert({ cartao_id: cartaoId, colaborador_id: user.id, conteudo: parsed.data.conteudo })
  if (error) return { ok: false, error: 'Falha ao enviar o comentário.' }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}

export async function excluirComentario(id: string, quadroId: string): Promise<ActionResult> {
  const { user } = await requireUser()
  const supabase = await createClient()

  const { error } = await supabase.from('comentarios_cartao').delete().eq('id', id).eq('colaborador_id', user.id)
  if (error) return { ok: false, error: 'Falha ao excluir o comentário.' }

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
  cor_tema: z.string().trim().min(1).catch('#006652'),
  mensagem_sucesso: z.string().trim().min(1, 'Informe a mensagem de sucesso').max(500),
  mostrar_marca: z.boolean(),
  campos: z.array(campoFormularioSchema).min(1, 'Adicione pelo menos um campo ao formulário'),
})

export async function criarFormulario(
  quadroId: string,
  dados: z.infer<typeof formularioInputSchema>
): Promise<ActionResult<{ id: string; slug: string }>> {
  const { user } = await requireUser()
  const supabase = await createClient()

  const parsed = formularioInputSchema.safeParse(dados)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const { campos, ...formulario } = parsed.data

  const { data: novoFormulario, error } = await supabase
    .from('formularios')
    .insert({ ...formulario, quadro_id: quadroId, criado_por: user.id })
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
    .insert(campos.map((campo, posicao) => ({ ...campo, formulario_id: novoFormulario.id, posicao })))

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
  })

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
  const { user } = await requireUser()
  const supabase = await createClient()

  const { error } = await supabase.from('formularios').delete().eq('id', id)
  if (error) return { ok: false, error: 'Falha ao excluir o formulário.' }

  await registrarAuditoria({
    atorId: user.id,
    acao: 'kanban.formulario_excluir',
    entidade: 'formularios',
    entidadeId: id,
  })

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
): Promise<ActionResult<{ cartaoId: string }>> {
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

  const campoTitulo = campos.find((c) => c.mapeado_para === 'titulo')
  const campoPrimeiroTexto = campos.find((c) => c.tipo === 'texto')
  let titulo = (campoTitulo && respostas[campoTitulo.id]?.trim()) || (campoPrimeiroTexto && respostas[campoPrimeiroTexto.id]?.trim()) || `Nova solicitação via ${formulario.titulo}`
  if (titulo.length > 150) titulo = titulo.slice(0, 150) + '...'

  const campoPrioridade = campos.find((c) => c.mapeado_para === 'prioridade' || c.tipo === 'prioridade')
  const valorPrioridade = campoPrioridade ? respostas[campoPrioridade.id] : undefined
  const prioridade: PrioridadeCartao =
    valorPrioridade === 'baixa' || valorPrioridade === 'alta' ? valorPrioridade : 'media'

  const campoPrazo = campos.find((c) => c.mapeado_para === 'prazo' || c.tipo === 'data')
  const valorPrazo = campoPrazo ? respostas[campoPrazo.id]?.trim() : undefined
  const prazo = valorPrazo && !isNaN(Date.parse(valorPrazo)) ? valorPrazo : null

  const linhasDescricao = [`Enviado via formulário "${formulario.titulo}" em ${new Date().toLocaleString('pt-BR')}.`, '']
  for (const campo of campos) {
    const valor = respostas[campo.id]?.trim()
    linhasDescricao.push(`${campo.rotulo}: ${valor || '(não respondido)'}`)
  }

  const { count } = await admin
    .from('cartoes')
    .select('id', { count: 'exact', head: true })
    .eq('coluna_id', formulario.coluna_id)

  const { data: novoCartao, error: cartaoError } = await admin
    .from('cartoes')
    .insert({
      coluna_id: formulario.coluna_id,
      titulo,
      descricao: linhasDescricao.join('\n'),
      prioridade,
      prazo,
      posicao: count ?? 0,
      criado_por: null,
    })
    .select('id')
    .single()

  if (cartaoError || !novoCartao) {
    console.error('Erro ao criar card via formulário público:', cartaoError)
    return { ok: false, error: 'Falha ao processar sua solicitação. Tente novamente em instantes.' }
  }

  return { ok: true, data: { cartaoId: novoCartao.id } }
}
