// Regras de nome de empresa e mensagens de erro da propriedade da
// organização, isoladas de banco e de React para caberem no vitest.
//
// O limite de 120 caracteres e o trim existem em dois lugares de propósito: a
// RPC atualizar_nome_organizacao (20260812200000) recusa do mesmo jeito. A
// checagem daqui existe para dar mensagem que explica o motivo em vez do texto
// cru da exceção do Postgres — não substitui a do banco, que é a que vale.

export const NOME_EMPRESA_MAX = 120

export type NomeEmpresaValido = { ok: true; nome: string } | { ok: false; erro: string }

export function validarNomeEmpresa(entrada: unknown): NomeEmpresaValido {
  if (typeof entrada !== 'string') {
    return { ok: false, erro: 'Informe o nome da empresa' }
  }

  // Normaliza espaço interno também: "Tera   Labs" e "Tera Labs" são o mesmo
  // nome digitado com pressa, e salvar os dois cria duas grafias da mesma
  // empresa na tela de quem convida alguém.
  const nome = entrada.trim().replace(/\s+/g, ' ')

  if (nome === '') {
    return { ok: false, erro: 'O nome da empresa não pode ficar em branco' }
  }
  if (nome.length > NOME_EMPRESA_MAX) {
    return { ok: false, erro: `O nome da empresa deve ter no máximo ${NOME_EMPRESA_MAX} caracteres` }
  }

  return { ok: true, nome }
}

/**
 * Traduz as exceções nomeadas das RPCs de propriedade. Fica separado de
 * `mensagemDeErroDoBanco` (lib/supabase-error.ts) porque aquele é o tradutor
 * geral usado em toda action; aqui as mensagens são específicas o bastante
 * para citar a tela onde se resolve.
 */
export function mensagemDeErroDaPropriedade(mensagem: string | undefined): string | null {
  if (!mensagem) return null

  if (mensagem.includes('APENAS_DONO')) {
    return 'Só o dono da empresa pode fazer isso. Peça para quem responde pela conta.'
  }
  if (mensagem.includes('JA_E_DONO')) {
    return 'Esta pessoa já é a dona da empresa.'
  }
  if (mensagem.includes('COLABORADOR_INVALIDO')) {
    return 'A pessoa escolhida não pertence a esta empresa.'
  }
  if (mensagem.includes('COLABORADOR_INATIVO')) {
    return 'A pessoa escolhida está desativada. Reative a conta dela antes de transferir.'
  }
  if (mensagem.includes('NAO_E_GESTOR')) {
    return 'Só é possível transferir a propriedade para um gestor. Promova a pessoa a gestor em Colaboradores e tente de novo.'
  }
  if (mensagem.includes('NOME_INVALIDO')) {
    return `O nome da empresa precisa ter de 1 a ${NOME_EMPRESA_MAX} caracteres.`
  }
  if (mensagem.includes('DONO_NAO_PODE_PERDER_ADMIN')) {
    return 'Esta pessoa é a dona da empresa. Transfira a propriedade antes de revogar o acesso de admin.'
  }
  if (mensagem.includes('DONO_NAO_PODE_SER_DESATIVADO')) {
    return 'Esta pessoa é a dona da empresa. Transfira a propriedade antes de desativá-la.'
  }

  return null
}
