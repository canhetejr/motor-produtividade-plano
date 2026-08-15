import 'server-only'
import { createAdminClient } from '@/utils/supabase/admin'
import { registrarAuditoria } from '@/lib/auditoria'
import { ERROS_RPC_APONTAMENTO } from '@/lib/apontamento-erros'
import { traduzirRegraCartao } from '@/lib/kanban-regras'
import { dispararEvento } from '@/lib/automacoes'
import { agendarSincronizacaoGoogle } from '@/lib/google-calendar'
import { ErroDeDominioMcp } from '@/lib/mcp/erros'
import type { Json, PrioridadeCartao } from '@/lib/database.types'

// Escritas do servidor MCP. Contraparte de lib/mcp/queries.ts e, junto com
// ele e lib/mcp-auth.ts, o único lugar do fluxo MCP autorizado a importar
// createAdminClient (allowlist em
// __tests__/isolamento/admin-client-estatico.test.ts).
//
// Três regras que valem para TODA função deste arquivo:
//
// 1. `identidade` vem sempre do McpSessao resolvido pelo token. Nenhum
//    colaboradorId/organizacaoId/tokenId entra por parâmetro de tool — se
//    entrasse, um agente escreveria no nome de outra pessoa só mudando o
//    JSON da chamada.
// 2. Todo id que VEM do cliente (cartão, coluna, demanda) é relido do banco
//    com `.eq('organizacao_id', identidade.organizacaoId)` antes de qualquer
//    escrita. Sem RLS por trás, esse filtro é a única coisa entre um id
//    adivinhado e uma escrita cross-tenant.
// 3. Toda escrita bem-sucedida deixa duas trilhas: `mcp_escritas` (que também
//    é a chave de idempotência) e `auditoria` (a mesma trilha das ações de
//    UI, para que "quem alterou este cartão" tenha uma resposta só).

export type IdentidadeEscrita = {
  tokenId: string
  colaboradorId: string
  organizacaoId: string
}

type Ferramenta = 'apontamento_registrar' | 'cartao_criar' | 'cartao_mover' | 'cartao_comentar'

type Efeito = {
  entidade: string
  entidadeId: string | null
  resultado: Record<string, Json>
  /** Ação registrada em `auditoria` — mesmo vocabulário das Server Actions. */
  acaoAuditoria: string
}

export type ResultadoEscrita = {
  resultado: Record<string, Json>
  /**
   * true quando a chave de idempotência já tinha sido usada por este token:
   * nada foi escrito agora, o retorno é o registro da primeira chamada.
   */
  repetido: boolean
}

/**
 * Reserva a chave de idempotência ANTES de escrever, executa o efeito e só
 * então grava o resultado na reserva.
 *
 * A ordem importa. Se a linha de `mcp_escritas` fosse gravada depois do
 * efeito, duas chamadas simultâneas com a mesma chave (um agente que repetiu
 * porque a resposta demorou) passariam as duas pela checagem "já existe?" e
 * criariam dois apontamentos — a janela entre a leitura e a escrita é
 * exatamente o bug que a idempotência deveria fechar. Reservando primeiro, o
 * índice único idx_mcp_escritas_idempotencia decide o vencedor no banco.
 *
 * Se o efeito falhar, a reserva é apagada: um erro de regra de negócio não
 * pode "queimar" a chave e impedir a correção do agente.
 */
async function executarComIdempotencia(
  identidade: IdentidadeEscrita,
  ferramenta: Ferramenta,
  chaveIdempotencia: string,
  entidade: string,
  executar: () => Promise<Efeito>
): Promise<ResultadoEscrita> {
  const admin = createAdminClient()

  const { data: reserva, error: erroReserva } = await admin
    .from('mcp_escritas')
    .insert({
      organizacao_id: identidade.organizacaoId,
      token_id: identidade.tokenId,
      colaborador_id: identidade.colaboradorId,
      ferramenta,
      chave_idempotencia: chaveIdempotencia,
      entidade,
      // `{}` marca "em andamento": só vira resultado real depois do efeito.
      resultado: {},
    })
    .select('id')
    .single()

  if (erroReserva) {
    // 23505 = unique_violation no índice da chave. É o caminho feliz da
    // repetição, não uma falha.
    if (erroReserva.code !== '23505') {
      console.error('MCP: falha ao reservar idempotência: code=%s', erroReserva.code)
      throw new Error('Falha ao reservar a escrita.')
    }

    const { data: anterior } = await admin
      .from('mcp_escritas')
      .select('resultado')
      .eq('token_id', identidade.tokenId)
      .eq('ferramenta', ferramenta)
      .eq('chave_idempotencia', chaveIdempotencia)
      .maybeSingle()

    const resultado = (anterior?.resultado ?? {}) as Record<string, Json>
    if (Object.keys(resultado).length === 0) {
      throw new ErroDeDominioMcp(
        'Uma chamada com esta mesma chave de idempotência ainda está em andamento. Aguarde e consulte o resultado antes de repetir.'
      )
    }
    return { resultado, repetido: true }
  }

  let efeito: Efeito
  try {
    efeito = await executar()
  } catch (err) {
    await admin.from('mcp_escritas').delete().eq('id', reserva.id)
    throw err
  }

  const { error: erroFinal } = await admin
    .from('mcp_escritas')
    .update({
      entidade: efeito.entidade,
      entidade_id: efeito.entidadeId,
      resultado: efeito.resultado as Json,
    })
    .eq('id', reserva.id)
  if (erroFinal) {
    // O efeito já aconteceu — não dá para desfazer nem faz sentido devolver
    // erro por causa da trilha. Fica logado; a linha permanece com resultado
    // `{}`, que a próxima repetição trata como "em andamento".
    console.error('MCP: escrita concluída mas trilha não fechou: code=%s', erroFinal.code)
  }

  await registrarAuditoria(
    {
      atorId: identidade.colaboradorId,
      acao: efeito.acaoAuditoria,
      entidade: efeito.entidade,
      entidadeId: efeito.entidadeId ?? undefined,
      depois: { ...efeito.resultado, via: 'mcp', mcp_token_id: identidade.tokenId },
    },
    identidade.organizacaoId
  )

  return { resultado: efeito.resultado, repetido: false }
}

// ============================================================
// Apontamentos
// ============================================================

export async function registrarApontamentoMcp(
  identidade: IdentidadeEscrita,
  params: {
    demandaId: string
    quantidade: number
    tempoManualMin: number | null
    motivo: string | null
    observacoes: string | null
    chaveIdempotencia: string
  }
): Promise<ResultadoEscrita> {
  return executarComIdempotencia(
    identidade,
    'apontamento_registrar',
    params.chaveIdempotencia,
    'apontamentos',
    async () => {
      const admin = createAdminClient()
      // registrar_apontamento_para() carrega TODA a regra de negócio (demanda
      // ativa e da mesma organização, motivo obrigatório em demanda variável,
      // teto de blocos, carga horária, demanda finita esgotada) — a mesma
      // função que registrar_apontamento() usa para a UI. Reimplementar isso
      // aqui em TypeScript criaria duas verdades sobre o mesmo assunto.
      const { data, error } = await admin.rpc('registrar_apontamento_para', {
        p_colaborador_id: identidade.colaboradorId,
        p_demanda_id: params.demandaId,
        p_quantidade: params.quantidade,
        p_tempo_manual_min: params.tempoManualMin as unknown as number,
        p_motivo: params.motivo as unknown as string,
        p_observacoes: params.observacoes as unknown as string,
      })

      if (error || !data) {
        const codigo = error?.message ?? ''
        const conhecido = Object.keys(ERROS_RPC_APONTAMENTO).find((c) => codigo.includes(c))
        if (!conhecido) console.error('MCP: falha ao registrar apontamento: code=%s', error?.code)
        throw new ErroDeDominioMcp(
          conhecido ? ERROS_RPC_APONTAMENTO[conhecido] : 'Não foi possível registrar o apontamento.'
        )
      }

      return {
        entidade: 'apontamentos',
        entidadeId: data.id,
        acaoAuditoria: 'mcp.apontamento.criar',
        resultado: {
          id: data.id,
          data: data.data,
          demandaId: data.demanda_id,
          quantidade: data.quantidade,
          tempoManualMin: data.tempo_manual_min,
        },
      }
    }
  )
}

// ============================================================
// Kanban
// ============================================================

type ColunaResolvida = { id: string; nome: string; quadroId: string; etapaFinal: boolean }

/**
 * Lê a coluna dentro da organização do token e confirma que o colaborador
 * alcança o quadro dela.
 *
 * `pode_acessar_quadro` é a mesma regra de `is_quadro_membro` usada pelas
 * políticas do app (gestor ativo da organização OU membro do quadro),
 * parametrizada por colaborador porque `auth.uid()` é NULL sob service role.
 * Sem esta checagem, um token válido escreveria em qualquer quadro da própria
 * empresa — inclusive nos que a pessoa não vê na interface.
 */
async function resolverColunaAcessivel(
  identidade: IdentidadeEscrita,
  colunaId: string
): Promise<ColunaResolvida> {
  const admin = createAdminClient()
  const { data: coluna } = await admin
    .from('colunas')
    .select('id, nome, quadro_id, etapa_final')
    .eq('id', colunaId)
    .eq('organizacao_id', identidade.organizacaoId)
    .maybeSingle()

  // Mesma mensagem para "não existe" e "é de outra empresa": distinguir as
  // duas transformaria a tool num oráculo de existência de ids alheios.
  if (!coluna) throw new ErroDeDominioMcp('Coluna não encontrada.')

  const { data: permitido, error } = await admin.rpc('pode_acessar_quadro', {
    p_quadro_id: coluna.quadro_id,
    p_colaborador_id: identidade.colaboradorId,
  })
  if (error) {
    console.error('MCP: falha ao checar acesso ao quadro: code=%s', error.code)
    throw new Error('Falha ao validar o acesso ao quadro.')
  }
  if (!permitido) throw new ErroDeDominioMcp('Você não participa do quadro desta coluna.')

  return { id: coluna.id, nome: coluna.nome, quadroId: coluna.quadro_id, etapaFinal: coluna.etapa_final }
}

async function resolverCartaoAcessivel(identidade: IdentidadeEscrita, cartaoId: string) {
  const admin = createAdminClient()
  const { data: cartao } = await admin
    .from('cartoes')
    .select('id, codigo, titulo, coluna_id')
    .eq('id', cartaoId)
    .eq('organizacao_id', identidade.organizacaoId)
    .maybeSingle()
  if (!cartao) throw new ErroDeDominioMcp('Cartão não encontrado.')

  const coluna = await resolverColunaAcessivel(identidade, cartao.coluna_id)
  return { cartao, coluna }
}

export async function criarCartaoMcp(
  identidade: IdentidadeEscrita,
  params: {
    colunaId: string
    titulo: string
    descricao: string | null
    prioridade: PrioridadeCartao
    prazo: string | null
    chaveIdempotencia: string
  }
): Promise<ResultadoEscrita> {
  return executarComIdempotencia(identidade, 'cartao_criar', params.chaveIdempotencia, 'cartoes', async () => {
    const admin = createAdminClient()
    const coluna = await resolverColunaAcessivel(identidade, params.colunaId)

    const { count } = await admin
      .from('cartoes')
      .select('id', { count: 'exact', head: true })
      .eq('coluna_id', coluna.id)
      .eq('organizacao_id', identidade.organizacaoId)

    const { data: cartao, error } = await admin
      .from('cartoes')
      .insert({
        coluna_id: coluna.id,
        // Sobrescrito pelo trigger tr_gerar_codigo_cartao (BEFORE INSERT);
        // o tipo gerado exige a coluna porque não sabe do trigger — mesma
        // observação de app/(app)/kanban/actions.ts::criarCartao.
        codigo: '',
        titulo: params.titulo,
        descricao: params.descricao,
        prioridade: params.prioridade,
        prazo: params.prazo,
        posicao: count ?? 0,
        criado_por: identidade.colaboradorId,
        organizacao_id: identidade.organizacaoId,
      })
      .select('id, codigo, titulo')
      .single()

    if (error || !cartao) {
      console.error('MCP: falha ao criar cartão: code=%s', error?.code)
      throw new ErroDeDominioMcp(traduzirRegraCartao(error) ?? 'Não foi possível criar o cartão.')
    }

    // Mesma regra da interface para quem não é gestor: o cartão nasce
    // atribuído a quem o criou, nunca a um colega escolhido pelo agente.
    const { error: erroResponsavel } = await admin
      .from('cartoes_responsaveis')
      .insert({
        cartao_id: cartao.id,
        colaborador_id: identidade.colaboradorId,
        organizacao_id: identidade.organizacaoId,
      })
    if (erroResponsavel) console.error('MCP: cartão criado sem responsável: code=%s', erroResponsavel.code)

    agendarSincronizacaoGoogle(cartao.id)

    return {
      entidade: 'cartoes',
      entidadeId: cartao.id,
      acaoAuditoria: 'mcp.cartao.criar',
      resultado: {
        id: cartao.id,
        codigo: cartao.codigo,
        titulo: cartao.titulo,
        colunaId: coluna.id,
        quadroId: coluna.quadroId,
      },
    }
  })
}

export async function moverCartaoMcp(
  identidade: IdentidadeEscrita,
  params: { cartaoId: string; colunaDestinoId: string; chaveIdempotencia: string }
): Promise<ResultadoEscrita> {
  return executarComIdempotencia(identidade, 'cartao_mover', params.chaveIdempotencia, 'cartoes', async () => {
    const admin = createAdminClient()
    const { cartao, coluna: origem } = await resolverCartaoAcessivel(identidade, params.cartaoId)
    const destino = await resolverColunaAcessivel(identidade, params.colunaDestinoId)

    if (destino.quadroId !== origem.quadroId) {
      // Mover entre quadros é outra operação no domínio (moverCartaoDeQuadro,
      // com regras próprias de responsáveis e etiquetas). Não é o que esta
      // tool faz, e fazer "quase isso" seria pior do que recusar.
      throw new ErroDeDominioMcp('A coluna de destino pertence a outro quadro. Mover entre quadros não é suportado por MCP.')
    }
    if (destino.id === origem.id) {
      throw new ErroDeDominioMcp('O cartão já está nesta coluna.')
    }

    const { count } = await admin
      .from('cartoes')
      .select('id', { count: 'exact', head: true })
      .eq('coluna_id', destino.id)
      .eq('organizacao_id', identidade.organizacaoId)

    // As regras de movimentação (pré-requisito pendente, requisito
    // obrigatório da etapa, limite de WIP) vivem no trigger
    // trg_cartoes_validar_saida_etapa e continuam valendo aqui: trigger roda
    // para service role igual roda para a sessão do browser. É por isso que
    // esta função não reimplementa nenhuma delas — só traduz a exceção.
    const { error } = await admin
      .from('cartoes')
      .update({ coluna_id: destino.id, posicao: count ?? 0 })
      .eq('id', cartao.id)
      .eq('organizacao_id', identidade.organizacaoId)

    if (error) {
      const regra = traduzirRegraCartao(error)
      if (!regra) console.error('MCP: falha ao mover cartão: code=%s', error.code)
      throw new ErroDeDominioMcp(regra ?? 'Não foi possível mover o cartão.')
    }

    await admin.from('comentarios_cartao').insert({
      cartao_id: cartao.id,
      colaborador_id: identidade.colaboradorId,
      conteudo: `Moveu o card de "${origem.nome}" para "${destino.nome}" (via MCP).`,
      tipo: 'sistema',
      organizacao_id: identidade.organizacaoId,
    })

    // Paridade com a interface: mover pela UI dispara as automações do quadro
    // e a sincronização de agenda. Se o MCP não disparasse, o mesmo movimento
    // teria efeitos diferentes conforme a porta de entrada — e a automação de
    // "entrou na etapa" simplesmente não rodaria para quem usa o agente.
    const base = {
      supabase: admin,
      cartaoId: cartao.id,
      quadroId: origem.quadroId,
      atorId: identidade.colaboradorId,
      organizacaoId: identidade.organizacaoId,
    }
    await dispararEvento({ ...base, evento: 'cartao_saiu_etapa', dados: { colunaId: origem.id } })
    await dispararEvento({ ...base, evento: 'cartao_entrou_etapa', dados: { colunaId: destino.id } })
    agendarSincronizacaoGoogle(cartao.id)

    return {
      entidade: 'cartoes',
      entidadeId: cartao.id,
      acaoAuditoria: 'mcp.cartao.mover',
      resultado: {
        id: cartao.id,
        codigo: cartao.codigo,
        titulo: cartao.titulo,
        de: origem.nome,
        para: destino.nome,
        quadroId: origem.quadroId,
      },
    }
  })
}

export async function comentarCartaoMcp(
  identidade: IdentidadeEscrita,
  params: { cartaoId: string; conteudo: string; chaveIdempotencia: string }
): Promise<ResultadoEscrita> {
  return executarComIdempotencia(
    identidade,
    'cartao_comentar',
    params.chaveIdempotencia,
    'comentarios_cartao',
    async () => {
      const admin = createAdminClient()
      const { cartao, coluna } = await resolverCartaoAcessivel(identidade, params.cartaoId)

      const { data: comentario, error } = await admin
        .from('comentarios_cartao')
        .insert({
          cartao_id: cartao.id,
          colaborador_id: identidade.colaboradorId,
          // Sempre 'usuario': comentário de agente é um comentário de quem
          // operou o agente. 'sistema' é reservado ao rastro automático
          // (movimentação, entrega) e some da conversa na interface.
          tipo: 'usuario',
          conteudo: params.conteudo,
          organizacao_id: identidade.organizacaoId,
        })
        .select('id, created_at')
        .single()

      if (error || !comentario) {
        console.error('MCP: falha ao comentar cartão: code=%s', error?.code)
        throw new ErroDeDominioMcp('Não foi possível publicar o comentário.')
      }

      return {
        entidade: 'comentarios_cartao',
        entidadeId: comentario.id,
        acaoAuditoria: 'mcp.cartao.comentar',
        resultado: {
          id: comentario.id,
          cartaoId: cartao.id,
          codigo: cartao.codigo,
          quadroId: coluna.quadroId,
          criadoEm: comentario.created_at,
        },
      }
    }
  )
}
