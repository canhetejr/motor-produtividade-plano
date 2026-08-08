import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, PrioridadeCartao } from '@/lib/database.types'
import { htmlParaTexto } from '@/lib/rich-text'
import { formatarDataCompletaBR, formatarDataHoraBR } from '@/lib/dates'
import { getEmailsPorId } from '@/lib/cron'
import { createAdminClient } from '@/utils/supabase/admin'
import { variaveisUsadas } from '@/lib/variaveis'

// Lado servidor das variáveis: transforma `{{titulo}}`, `{{alocados}}`,
// `{{link_da_tarefa}}` nos valores reais do card que disparou a automação.
// O catálogo e a substituição em si moram em lib/variaveis.ts (puros, também
// importados pelo browser); aqui é só a leitura do banco.

type Supabase = SupabaseClient<Database>

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://vertice.teralabs.cloud'

const ROTULO_PRIORIDADE: Record<PrioridadeCartao, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
}

/** URL que abre o card já expandido — o quadro lê `?cartao=` na montagem. */
export function linkDoCartao(quadroId: string, cartaoId: string): string {
  return `${APP_URL}/kanban/${quadroId}?cartao=${cartaoId}`
}

/**
 * Valores das variáveis do card, prontos para `aplicarVariaveis`.
 *
 * Só busca o que os textos citam. Uma automação que manda "Tarefa entregue"
 * sem nenhuma variável não faz consulta nenhuma; uma que cita `{{alocados}}`
 * paga por uma. Isso importa porque o executor roda DENTRO da ação do
 * usuário (arrastar um card), e o custo aparece na mão de quem arrastou.
 *
 * Chave conhecida cujo dado não existe (card sem prazo) volta como string
 * vazia, nunca "null" — o texto do e-mail some, que é o comportamento certo.
 */
export async function valoresDoCartao(
  supabase: Supabase,
  cartaoId: string,
  quadroId: string,
  textos: (string | null | undefined)[]
): Promise<Record<string, string>> {
  const usadas = new Set(variaveisUsadas(...textos))
  if (usadas.size === 0) return {}

  const precisa = (...chaves: string[]) => chaves.some((c) => usadas.has(c))

  const valores: Record<string, string> = {}
  // Preenchido antes de qualquer consulta: não depende do banco, e um card
  // recém-criado já tem link.
  if (usadas.has('link_da_tarefa')) valores.link_da_tarefa = linkDoCartao(quadroId, cartaoId)

  // Tudo que é coluna do próprio card sai de uma consulta só.
  const { data: cartao } = await supabase
    .from('cartoes')
    .select(
      'titulo, codigo, descricao, tipo, prioridade, prazo, inicio_desejado, created_at, etapa_desde, tag_referencia, centro_id, criado_por, coluna_id'
    )
    .eq('id', cartaoId)
    .maybeSingle()

  // Card apagado entre o disparo e a execução: devolve o que já dá (o link) em
  // vez de derrubar a automação inteira.
  if (!cartao) return valores

  if (usadas.has('titulo')) valores.titulo = cartao.titulo ?? ''
  if (usadas.has('codigo')) valores.codigo = cartao.codigo ?? ''
  // A descrição virou HTML (editor rico) — no corpo do e-mail ela precisa
  // voltar a ser texto, senão sai `<p>` cru pro destinatário.
  if (usadas.has('descricao')) valores.descricao = htmlParaTexto(cartao.descricao)
  if (usadas.has('tipo')) valores.tipo = cartao.tipo ?? ''
  if (usadas.has('prioridade')) valores.prioridade = ROTULO_PRIORIDADE[cartao.prioridade] ?? ''
  if (usadas.has('tag_referencia')) valores.tag_referencia = cartao.tag_referencia ?? ''
  if (usadas.has('prazo')) valores.prazo = cartao.prazo ? formatarDataCompletaBR(cartao.prazo) : ''
  if (usadas.has('inicio_desejado')) {
    valores.inicio_desejado = cartao.inicio_desejado ? formatarDataCompletaBR(cartao.inicio_desejado) : ''
  }
  if (usadas.has('criada_em')) valores.criada_em = formatarDataHoraBR(cartao.created_at)
  if (usadas.has('na_etapa_desde')) {
    valores.na_etapa_desde = cartao.etapa_desde ? formatarDataHoraBR(cartao.etapa_desde) : ''
  }

  // O resto são consultas independentes — em paralelo, cada uma condicionada
  // à variável que a justifica.
  const [etapa, quadro, centro, alocados, seguidores, tags, criador] = await Promise.all([
    precisa('etapa_atual')
      ? supabase.from('colunas').select('nome').eq('id', cartao.coluna_id).maybeSingle()
      : null,
    precisa('quadro') ? supabase.from('quadros').select('nome').eq('id', quadroId).maybeSingle() : null,
    precisa('centro') && cartao.centro_id
      ? supabase.from('areas').select('nome').eq('id', cartao.centro_id).maybeSingle()
      : null,
    precisa('alocados', 'emails_alocados')
      ? supabase
          .from('cartoes_responsaveis')
          .select('colaborador_id, colaboradores(nome)')
          .eq('cartao_id', cartaoId)
      : null,
    precisa('seguidores')
      ? supabase.from('cartoes_seguidores').select('colaboradores(nome)').eq('cartao_id', cartaoId)
      : null,
    precisa('tags')
      ? supabase.from('cartoes_etiquetas').select('etiquetas(nome)').eq('cartao_id', cartaoId)
      : null,
    precisa('criada_por') && cartao.criado_por
      ? supabase.from('colaboradores').select('nome').eq('id', cartao.criado_por).maybeSingle()
      : null,
  ])

  if (usadas.has('etapa_atual')) valores.etapa_atual = etapa?.data?.nome ?? ''
  if (usadas.has('quadro')) valores.quadro = quadro?.data?.nome ?? ''
  if (usadas.has('centro')) valores.centro = centro?.data?.nome ?? ''
  if (usadas.has('criada_por')) valores.criada_por = criador?.data?.nome ?? ''

  if (usadas.has('alocados')) {
    valores.alocados = listar((alocados?.data ?? []).map((r) => nomeDe(r.colaboradores)))
  }
  if (usadas.has('seguidores')) {
    valores.seguidores = listar((seguidores?.data ?? []).map((r) => nomeDe(r.colaboradores)))
  }
  if (usadas.has('tags')) {
    valores.tags = listar((tags?.data ?? []).map((r) => nomeDe(r.etiquetas)))
  }

  // E-mail não é coluna de `colaboradores` — mora em auth.users e só o service
  // role lê. Fica por último e isolado: sem SUPABASE_SERVICE_ROLE_KEY (ou com
  // o Auth fora do ar) as variáveis de e-mail saem vazias, mas o resto do
  // texto continua resolvido.
  if (precisa('emails_alocados', 'email_criador')) {
    try {
      const idsNecessarios = [
        ...(cartao.criado_por ? [cartao.criado_por] : []),
        ...(alocados?.data ?? []).map((r) => r.colaborador_id),
      ]
      const emails = await getEmailsPorId(createAdminClient(), idsNecessarios)
      if (usadas.has('email_criador')) {
        valores.email_criador = (cartao.criado_por && emails.get(cartao.criado_por)) || ''
      }
      if (usadas.has('emails_alocados')) {
        valores.emails_alocados = (alocados?.data ?? [])
          .map((r) => emails.get(r.colaborador_id))
          .filter((e): e is string => !!e)
          .join(', ')
      }
    } catch (erro) {
      console.error('variaveis: não foi possível resolver e-mails: %o', erro)
      if (usadas.has('email_criador')) valores.email_criador = ''
      if (usadas.has('emails_alocados')) valores.emails_alocados = ''
    }
  }

  return valores
}

/**
 * PostgREST devolve o embed como objeto ou array conforme a cardinalidade que
 * ele infere; normalizar aqui evita `[object Object]` no meio do e-mail.
 */
function nomeDe(relacao: { nome: string } | { nome: string }[] | null): string {
  if (!relacao) return ''
  return Array.isArray(relacao) ? relacao[0]?.nome ?? '' : relacao.nome
}

function listar(nomes: string[]): string {
  return nomes.filter(Boolean).join(', ')
}
