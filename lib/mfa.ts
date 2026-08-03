import { createHash, randomInt, timingSafeEqual } from 'node:crypto'

/**
 * Segundo fator por código enviado ao e-mail.
 *
 * A lógica fica aqui, separada da action, porque cada decisão abaixo é uma
 * decisão de segurança e precisa de teste: comprimento do código, validade,
 * teto de tentativas e comparação em tempo constante.
 */

/** Seis dígitos: um milhão de possibilidades contra 5 tentativas em 10 minutos. */
export const TAMANHO_CODIGO = 6
export const VALIDADE_MIN = 10
export const MAX_TENTATIVAS = 5

/**
 * `randomInt` do node, e não `Math.random`: este número é credencial. Zeros à
 * esquerda são preservados — cortá-los reduziria o espaço de busca.
 */
export function gerarCodigo(): string {
  return String(randomInt(0, 10 ** TAMANHO_CODIGO)).padStart(TAMANHO_CODIGO, '0')
}

/**
 * O que vai para o banco.
 *
 * Sal por desafio, para dois códigos iguais não gerarem o mesmo hash — sem ele,
 * quem lesse a tabela veria quais desafios compartilham código.
 */
export function hashCodigo(codigo: string, sal: string): string {
  return createHash('sha256').update(`${sal}:${codigo}`).digest('hex')
}

/**
 * Comparação em tempo constante.
 *
 * `===` em string vaza, pelo tempo de resposta, quantos caracteres iniciais
 * batem. Num código de seis dígitos isso reduz um espaço de um milhão a
 * sessenta tentativas.
 */
export function hashConfere(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  // timingSafeEqual lança se os comprimentos diferem, o que já vazaria a
  // informação; comparar o tamanho antes é o comportamento correto porque o
  // tamanho do hash é público e fixo.
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export type Desafio = {
  codigoHash: string
  sal: string
  expiraEm: string
  tentativas: number
  verificadoEm: string | null
}

export type ResultadoVerificacao =
  | { ok: true }
  | { ok: false; motivo: 'inexistente' | 'expirado' | 'usado' | 'excedido' | 'incorreto' }

export function verificarCodigo(
  desafio: Desafio | null,
  codigoInformado: string,
  agora: Date
): ResultadoVerificacao {
  if (!desafio) return { ok: false, motivo: 'inexistente' }
  if (desafio.verificadoEm) return { ok: false, motivo: 'usado' }
  if (new Date(desafio.expiraEm) <= agora) return { ok: false, motivo: 'expirado' }
  // O teto é checado ANTES de comparar: sem isso, a tentativa que estoura o
  // limite ainda testaria um código.
  if (desafio.tentativas >= MAX_TENTATIVAS) return { ok: false, motivo: 'excedido' }

  const informadoHash = hashCodigo(codigoInformado.trim(), desafio.sal)
  if (!hashConfere(informadoHash, desafio.codigoHash)) return { ok: false, motivo: 'incorreto' }
  return { ok: true }
}

export const MENSAGEM_RECUSA: Record<
  Exclude<ResultadoVerificacao, { ok: true }>['motivo'],
  string
> = {
  inexistente: 'Nenhum código pendente. Faça login de novo.',
  expirado: 'O código expirou. Faça login de novo para receber outro.',
  usado: 'Este código já foi usado. Faça login de novo.',
  excedido: 'Tentativas demais. Faça login de novo para receber outro código.',
  incorreto: 'Código incorreto.',
}

export function expiraEm(agora: Date): string {
  return new Date(agora.getTime() + VALIDADE_MIN * 60_000).toISOString()
}
