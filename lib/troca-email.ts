// Regras da troca de e-mail da própria conta.
//
// O e-mail não vive em `colaboradores` — ele é `auth.users.email`, e o estado
// "pedido feito, ainda não confirmado" também é do Supabase Auth
// (`user.new_email` / `user.email_change_sent_at`). Por isso esta feature não
// tem migration: modelar o pendente numa coluna nossa criaria uma segunda
// fonte de verdade que dessincroniza no primeiro link expirado.
//
// Aqui mora só o que é decidível sem rede, para caber no vitest.

export type EmailValidado = { ok: true; email: string } | { ok: false; erro: string }

/**
 * Validação deliberadamente frouxa, com uma exigência só: um `@` com texto dos
 * dois lados e um ponto no domínio. Regex de e-mail "completa" recusa endereço
 * válido com mais frequência do que aceita inválido, e quem valida de verdade
 * é o link de confirmação — se o endereço não existe, o e-mail não chega e a
 * troca simplesmente não acontece.
 */
export function validarNovoEmail(entrada: unknown, emailAtual: string): EmailValidado {
  if (typeof entrada !== 'string') {
    return { ok: false, erro: 'Informe o novo e-mail' }
  }

  const email = entrada.trim().toLowerCase()

  if (email === '') {
    return { ok: false, erro: 'Informe o novo e-mail' }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, erro: 'Informe um e-mail válido' }
  }
  if (email === emailAtual.trim().toLowerCase()) {
    return { ok: false, erro: 'Este já é o seu e-mail atual' }
  }

  return { ok: true, email }
}

/**
 * Traduz a recusa do Supabase Auth.
 *
 * O caso do e-mail duplicado é o que mais importa: `auth.users.email` é único
 * GLOBALMENTE, atravessando organizações (limitação conhecida e assumida — ver
 * docs/PLANO-PRODUTO.md). Quem tenta usar um endereço que já tem conta em
 * outra empresa recebe um erro de unicidade que não explica nada, e a pessoa
 * fica tentando de novo achando que foi falha de rede.
 */
export function mensagemDeErroDaTrocaDeEmail(mensagem: string | undefined): string {
  const texto = (mensagem ?? '').toLowerCase()

  if (
    texto.includes('already registered') ||
    texto.includes('already been registered') ||
    texto.includes('already exists') ||
    texto.includes('duplicate key')
  ) {
    return 'Este e-mail já está em uso por outra conta do Vértice. Se ele pertence a você em outra empresa, não é possível reutilizá-lo aqui — use um endereço diferente.'
  }
  if (texto.includes('rate limit') || texto.includes('too many')) {
    return 'Você pediu a troca de e-mail várias vezes seguidas. Espere alguns minutos e tente de novo.'
  }
  if (texto.includes('invalid') && texto.includes('email')) {
    return 'O Supabase recusou este endereço. Confira se está escrito corretamente.'
  }

  return 'Não foi possível pedir a troca de e-mail. Tente de novo em alguns minutos.'
}
