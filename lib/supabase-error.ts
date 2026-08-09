import type { PostgrestError } from '@supabase/supabase-js'

/**
 * Traduz as exceções que as funções do banco levantam por nome (as
 * `raise exception 'X'` das migrations) para uma frase que o gestor
 * entende. Sem isto, quem estoura o teto de assentos recebe o texto cru do
 * Postgres — que não diz o que fazer nem quantos assentos existem.
 *
 * `LIMITE_ASSENTOS_EXCEDIDO` chega com `detail = 'ocupados/limite'` (ver
 * trg_assentos_verificar em 20260809170000_fase5_assentos_ciclo_vida.sql);
 * o número entra na mensagem porque "não cabe" sem dizer o teto obriga o
 * gestor a ir procurar em outra tela.
 */
export function mensagemDeErroDoBanco(error: { message?: string; details?: string | null } | null): string | null {
  if (!error?.message) return null

  if (error.message.includes('LIMITE_ASSENTOS_EXCEDIDO')) {
    const [ocupados, limite] = (error.details ?? '').split('/')
    const contagem = ocupados && limite ? ` Seu plano permite ${limite} e já há ${ocupados} em uso.` : ''
    return `Limite de assentos atingido.${contagem} Desative alguém que não usa mais o sistema, revogue um convite pendente, ou fale com a gente para aumentar o plano.`
  }

  if (error.message.includes('ORGANIZACAO_INATIVA')) {
    return 'A conta da sua empresa não está ativa. Fale com o administrador ou com o suporte.'
  }

  // 23505 = unique_violation. Em convites, o índice parcial impede dois
  // convites pendentes para o mesmo e-mail na mesma organização.
  if (error.message.includes('duplicate key') && error.message.includes('convites')) {
    return 'Já existe um convite pendente para este e-mail. Revogue o anterior antes de enviar outro.'
  }

  return null
}

// Server components fazem select direto (sem passar por uma action) e só
// desestruturam `data`; sem isso, uma falha de RLS/rede vira lista vazia
// silenciosa em vez de aparecer no error.tsx.
export function throwIfError(...errors: (PostgrestError | null)[]) {
  const error = errors.find((e) => e !== null)
  if (!error) return

  console.error(
    'Falha na consulta ao Supabase: code=%s message=%s details=%s hint=%s',
    error.code,
    error.message,
    error.details,
    error.hint
  )
  throw new Error(`Falha ao carregar dados [${error.code}]: ${error.message}`)
}
