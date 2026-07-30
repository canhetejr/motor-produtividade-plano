import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, PrioridadeCartao } from '@/lib/database.types'
import type { TipoEvento, TipoAcao, DadosEvento } from '@/lib/automacoes-catalogo'
import { automacaoCasa, ordenarAcoes, PROFUNDIDADE_MAXIMA } from '@/lib/automacoes-catalogo'
import { sendEmail, layoutEmail } from '@/lib/email'

// Executor das automações do quadro. O catálogo (rótulos e grupos, também
// usado pela UI) fica em lib/automacoes-catalogo.ts; aqui é só o que roda no
// servidor.
//
// Política: best-effort. Uma automação que falha é registrada em
// `automacoes_execucoes` e NUNCA derruba a ação do usuário que a disparou —
// mesma escolha de lib/notifications.ts. Quem move um card não pode ver um
// erro porque a automação de outra pessoa está mal configurada.

type Supabase = SupabaseClient<Database>

export type ContextoEvento = {
  supabase: Supabase
  evento: TipoEvento
  cartaoId: string
  quadroId: string
  atorId: string | null
  dados?: DadosEvento
  profundidade?: number
  /**
   * Só para eventos de estado (atraso, SLA): não reexecuta a automação se ela
   * já rodou com sucesso para este card depois deste instante. Sem isso, cada
   * varredura do cron redispara o mesmo card enquanto a condição durar.
   * Ver `ancoraDedupe` em lib/automacoes-catalogo.ts.
   */
  dedupeDesde?: string
}

type AutomacaoCarregada = {
  id: string
  nome: string
  evento: string
  evento_config: unknown
  posicao: number
  acoes: { id: string; ordem: number; tipo: string; config: unknown }[]
}

export async function dispararEvento(ctx: ContextoEvento): Promise<void> {
  try {
    await executarEvento(ctx)
  } catch (erro) {
    // Rede/permissão/bug no executor: loga e segue. A ação do usuário já
    // aconteceu e não pode ser desfeita por causa disso.
    console.error('automacoes: falha ao disparar %s: %o', ctx.evento, erro)
  }
}

async function executarEvento(ctx: ContextoEvento): Promise<void> {
  const { supabase, evento, cartaoId, quadroId, dados = {} } = ctx
  const profundidade = ctx.profundidade ?? 0

  const { data, error } = await supabase
    .from('automacoes')
    .select('id, nome, evento, evento_config, posicao, automacoes_acoes(id, ordem, tipo, config)')
    .eq('quadro_id', quadroId)
    .eq('evento', evento)
    .eq('ativa', true)
    .order('posicao')
  if (error) throw error

  const candidatas: AutomacaoCarregada[] = (data ?? []).map((a) => ({
    id: a.id,
    nome: a.nome,
    evento: a.evento,
    evento_config: a.evento_config,
    posicao: a.posicao,
    acoes: (a.automacoes_acoes ?? []) as AutomacaoCarregada['acoes'],
  }))

  let aplicaveis = candidatas.filter((a) => automacaoCasa(a, evento, dados))
  if (aplicaveis.length === 0) return

  if (ctx.dedupeDesde) {
    const { data: jaRodaram } = await supabase
      .from('automacoes_execucoes')
      .select('automacao_id')
      .eq('cartao_id', cartaoId)
      .eq('status', 'ok')
      .gte('executado_em', ctx.dedupeDesde)
      .in('automacao_id', aplicaveis.map((a) => a.id))

    const jaFeitas = new Set((jaRodaram ?? []).map((r) => r.automacao_id))
    aplicaveis = aplicaveis.filter((a) => !jaFeitas.has(a.id))
    if (aplicaveis.length === 0) return
  }

  // Checagem de profundidade aqui, e não na entrada, pra saber QUAIS
  // automações foram cortadas e registrar cada uma.
  if (profundidade >= PROFUNDIDADE_MAXIMA) {
    await Promise.all(
      aplicaveis.map((a) =>
        registrarExecucao(supabase, a.id, cartaoId, 'cortado', 0, `Encadeamento passou de ${PROFUNDIDADE_MAXIMA} níveis.`)
      )
    )
    return
  }

  for (const automacao of aplicaveis) {
    let executadas = 0
    try {
      for (const acao of ordenarAcoes(automacao.acoes)) {
        await executarAcao(acao.tipo as TipoAcao, acao.config, { ...ctx, profundidade })
        executadas += 1
      }
      await registrarExecucao(supabase, automacao.id, cartaoId, 'ok', executadas, null)
    } catch (erro) {
      // Para no primeiro erro desta automação, mas as seguintes ainda rodam:
      // uma automação quebrada não pode calar as outras do quadro.
      const mensagem = erro instanceof Error ? erro.message : String(erro)
      await registrarExecucao(supabase, automacao.id, cartaoId, 'erro', executadas, mensagem.slice(0, 500))
    }
  }
}

async function registrarExecucao(
  supabase: Supabase,
  automacaoId: string,
  cartaoId: string,
  status: 'ok' | 'erro' | 'cortado',
  acoesExecutadas: number,
  erro: string | null
) {
  const { error } = await supabase.from('automacoes_execucoes').insert({
    automacao_id: automacaoId,
    cartao_id: cartaoId,
    status,
    erro,
    acoes_executadas: acoesExecutadas,
  })
  if (error) console.error('automacoes: falha ao registrar execução: %o', error)
}

// --- Ações ---------------------------------------------------------------

type ConfigAcaoBruta = Record<string, unknown>

async function executarAcao(tipo: TipoAcao, configBruta: unknown, ctx: ContextoEvento): Promise<void> {
  const config = (configBruta ?? {}) as ConfigAcaoBruta
  const { supabase, cartaoId } = ctx

  switch (tipo) {
    case 'criar_tarefa':
    case 'criar_subtarefa':
      return criarCartaoDerivado(ctx, config, tipo === 'criar_subtarefa')

    case 'mover_cartao':
      return moverCartao(ctx, config)

    case 'marcar_urgente':
      return alterarPrioridade(supabase, cartaoId, 'alta')

    case 'desmarcar_urgente':
      return alterarPrioridade(supabase, cartaoId, 'media')

    case 'solicitar_aprovacao': {
      const aprovadorId = texto(config.colaboradorId)
      if (!aprovadorId) throw new Error('Ação "solicitar aprovação" sem aprovador configurado.')
      const { error } = await supabase.rpc('solicitar_aprovacao_cartao', {
        p_cartao_id: cartaoId,
        p_aprovador_id: aprovadorId,
      })
      if (error) throw new Error(error.message)
      return
    }

    case 'adicionar_responsavel':
      return vincularColaborador(supabase, 'cartoes_responsaveis', cartaoId, config, true)

    case 'remover_responsavel':
      return vincularColaborador(supabase, 'cartoes_responsaveis', cartaoId, config, false)

    case 'adicionar_seguidor':
      return vincularColaborador(supabase, 'cartoes_seguidores', cartaoId, config, true)

    case 'remover_seguidor':
      return vincularColaborador(supabase, 'cartoes_seguidores', cartaoId, config, false)

    case 'enviar_email':
      return enviarEmail(ctx, config)

    case 'alterar_campo':
      return alterarCampo(ctx, config)
  }
}

async function criarCartaoDerivado(ctx: ContextoEvento, config: ConfigAcaoBruta, subtarefa: boolean) {
  const { supabase, cartaoId, atorId } = ctx

  const titulo = texto(config.titulo)
  if (!titulo) throw new Error('Ação de criar tarefa sem título configurado.')

  const { data: origem } = await supabase.from('cartoes').select('coluna_id, demanda_id').eq('id', cartaoId).single()
  const colunaDestinoId = texto(config.colunaId) ?? origem?.coluna_id
  if (!colunaDestinoId) throw new Error('Não foi possível determinar a etapa da tarefa nova.')

  const { count } = await supabase
    .from('cartoes')
    .select('id', { count: 'exact', head: true })
    .eq('coluna_id', colunaDestinoId)

  const { error } = await supabase.from('cartoes').insert({
    coluna_id: colunaDestinoId,
    titulo,
    descricao: texto(config.descricao) ?? null,
    cartao_pai_id: subtarefa ? cartaoId : null,
    // Subtarefa herda a demanda do card que disparou a automação — mesmo
    // raciocínio de criarSubtarefa: o tempo dela precisa contar no índice.
    demanda_id: subtarefa ? (origem?.demanda_id ?? null) : null,
    posicao: count ?? 0,
    criado_por: atorId,
  })
  if (error) throw new Error(error.message)

  await comentarSistema(supabase, cartaoId, atorId, `Automação criou ${subtarefa ? 'a subtarefa' : 'a tarefa'} "${titulo}".`)
}

async function moverCartao(ctx: ContextoEvento, config: ConfigAcaoBruta) {
  const { supabase, cartaoId, quadroId, atorId } = ctx

  const colunaDestinoId = texto(config.colunaId)
  if (!colunaDestinoId) throw new Error('Ação "mover tarefa" sem etapa de destino configurada.')

  const { data: destino } = await supabase
    .from('colunas')
    .select('id, nome, quadro_id')
    .eq('id', colunaDestinoId)
    .maybeSingle()
  if (!destino) throw new Error('Etapa de destino não existe mais.')

  const { data: origem } = await supabase.from('cartoes').select('coluna_id').eq('id', cartaoId).single()
  if (origem?.coluna_id === colunaDestinoId) return // já está lá, nada a fazer

  const { count } = await supabase
    .from('cartoes')
    .select('id', { count: 'exact', head: true })
    .eq('coluna_id', colunaDestinoId)

  const { error } = await supabase
    .from('cartoes')
    .update({ coluna_id: colunaDestinoId, posicao: count ?? 0 })
    .eq('id', cartaoId)
  // As regras do bloco 29 (pré-requisito, requisito da etapa, WIP) valem
  // também pra automação — o trigger não distingue quem move.
  if (error) throw new Error(error.message)

  await comentarSistema(supabase, cartaoId, atorId, `Automação moveu o card para "${destino.nome}".`)

  // Encadeia: mover é o evento que mais dispara outras automações.
  const proxima = (ctx.profundidade ?? 0) + 1
  if (origem?.coluna_id) {
    await executarEvento({ ...ctx, evento: 'cartao_saiu_etapa', dados: { colunaId: origem.coluna_id }, profundidade: proxima })
  }
  await executarEvento({
    ...ctx,
    evento: 'cartao_entrou_etapa',
    quadroId: destino.quadro_id ?? quadroId,
    dados: { colunaId: colunaDestinoId },
    profundidade: proxima,
  })
}

async function alterarPrioridade(supabase: Supabase, cartaoId: string, prioridade: PrioridadeCartao) {
  const { error } = await supabase.from('cartoes').update({ prioridade }).eq('id', cartaoId)
  if (error) throw new Error(error.message)
}

async function vincularColaborador(
  supabase: Supabase,
  tabela: 'cartoes_responsaveis' | 'cartoes_seguidores',
  cartaoId: string,
  config: ConfigAcaoBruta,
  adicionar: boolean
) {
  const colaboradorId = texto(config.colaboradorId)
  if (!colaboradorId) throw new Error('Ação de alocação sem colaborador configurado.')

  if (adicionar) {
    // ignoreDuplicates: rodar a automação duas vezes não pode explodir na PK.
    const { error } = await supabase
      .from(tabela)
      .upsert({ cartao_id: cartaoId, colaborador_id: colaboradorId }, { onConflict: 'cartao_id,colaborador_id', ignoreDuplicates: true })
    if (error) throw new Error(error.message)
    return
  }

  const { error } = await supabase.from(tabela).delete().eq('cartao_id', cartaoId).eq('colaborador_id', colaboradorId)
  if (error) throw new Error(error.message)
}

async function enviarEmail(ctx: ContextoEvento, config: ConfigAcaoBruta) {
  const { supabase, cartaoId, atorId } = ctx

  const destinatario = texto(config.destinatario)
  if (!destinatario) throw new Error('Ação "enviar e-mail" sem destinatário configurado.')

  const { data: cartao } = await supabase.from('cartoes').select('titulo, codigo').eq('id', cartaoId).single()
  const assunto = texto(config.assunto) ?? `[${cartao?.codigo ?? 'Card'}] ${cartao?.titulo ?? ''}`.trim()
  const corpo = texto(config.corpo) ?? `O card "${cartao?.titulo ?? ''}" acionou uma automação do quadro.`

  const resultado = await sendEmail({
    to: destinatario,
    subject: assunto,
    html: layoutEmail(assunto, `<p>${corpo.replace(/\n/g, '<br/>')}</p>`),
  })
  if (!resultado.sent) {
    throw new Error(resultado.error ?? (resultado.skipped ? `Envio desabilitado: ${resultado.skipped}` : 'Falha ao enviar o e-mail.'))
  }

  // `cartoes_emails.colaborador_id` é NOT NULL, e evento vindo do cron não tem
  // ator. O e-mail sai de qualquer forma; só o registro na aba Emails do card
  // é que depende de haver alguém a quem atribuí-lo.
  if (atorId) {
    await supabase.from('cartoes_emails').insert({
      cartao_id: cartaoId,
      colaborador_id: atorId,
      destinatario,
      assunto,
      corpo,
    })
  }
}

async function alterarCampo(ctx: ContextoEvento, config: ConfigAcaoBruta) {
  const { supabase, cartaoId } = ctx

  // Campo customizado (definido no quadro) x campo fixo do card.
  const campoId = texto(config.campoId)
  if (campoId) {
    const valor = config.valor ?? null
    if (valor === null || valor === '') {
      const { error } = await supabase
        .from('cartoes_campos_valores')
        .delete()
        .eq('cartao_id', cartaoId)
        .eq('campo_id', campoId)
      if (error) throw new Error(error.message)
      return
    }
    const { error } = await supabase
      .from('cartoes_campos_valores')
      .upsert({ cartao_id: cartaoId, campo_id: campoId, valor, atualizado_em: new Date().toISOString() }, { onConflict: 'cartao_id,campo_id' })
    if (error) throw new Error(error.message)
    return
  }

  // Campo fixo: montado num objeto tipado por campo em vez de chave dinâmica,
  // pra o TypeScript conferir o tipo do valor de cada coluna.
  const campo = texto(config.campo)
  const valor = config.valor
  const patch: Database['public']['Tables']['cartoes']['Update'] = {}

  switch (campo) {
    case 'prioridade':
      if (valor !== 'baixa' && valor !== 'media' && valor !== 'alta') {
        throw new Error('Prioridade inválida na ação "alterar campo".')
      }
      patch.prioridade = valor
      break
    case 'tipo':
      if (valor !== 'Padrão' && valor !== 'Bug' && valor !== 'Melhoria' && valor !== 'Solicitação') {
        throw new Error('Tipo inválido na ação "alterar campo".')
      }
      patch.tipo = valor
      break
    case 'centro_id':
      patch.centro_id = texto(valor) ?? null
      break
    case 'tag_referencia':
      patch.tag_referencia = texto(valor) ?? null
      break
    default:
      throw new Error('Ação "alterar campo" sem campo válido configurado.')
  }

  const { error } = await supabase.from('cartoes').update(patch).eq('id', cartaoId)
  if (error) throw new Error(error.message)
}

async function comentarSistema(supabase: Supabase, cartaoId: string, atorId: string | null, conteudo: string) {
  if (!atorId) return // comentarios_cartao.colaborador_id é NOT NULL
  await supabase.from('comentarios_cartao').insert({
    cartao_id: cartaoId,
    colaborador_id: atorId,
    conteudo,
    tipo: 'sistema',
  })
}

function texto(valor: unknown): string | undefined {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : undefined
}
