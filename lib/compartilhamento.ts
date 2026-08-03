/**
 * Regras do link público de acompanhamento de quadro.
 *
 * A parte perigosa desta funcionalidade não é gerar o link — é decidir o que o
 * link mostra. Estas funções existem para essa decisão ficar num lugar só,
 * testada, em vez de espalhada por um route handler que roda com cliente de
 * serviço e enxerga o banco inteiro.
 */

export type Compartilhamento = {
  quadroId: string
  ativo: boolean
  expiraEm: string | null
}

export type MotivoRecusa = 'inexistente' | 'revogado' | 'expirado'

export type Verificacao =
  | { valido: true; quadroId: string }
  | { valido: false; motivo: MotivoRecusa }

/**
 * `agora` entra como parâmetro para o corte por validade ser testável sem
 * esperar o tempo passar.
 */
export function verificarLink(
  compartilhamento: Compartilhamento | null,
  agora: Date
): Verificacao {
  if (!compartilhamento) return { valido: false, motivo: 'inexistente' }
  if (!compartilhamento.ativo) return { valido: false, motivo: 'revogado' }
  if (compartilhamento.expiraEm && new Date(compartilhamento.expiraEm) <= agora) {
    return { valido: false, motivo: 'expirado' }
  }
  return { valido: true, quadroId: compartilhamento.quadroId }
}

/**
 * Um token só é aceito se tiver a forma exata que geramos.
 *
 * Validar antes de consultar evita que qualquer string vire uma ida ao banco, e
 * fecha a porta para tentativa de injeção por um caminho que roda com cliente
 * de serviço.
 */
export function tokenBemFormado(token: string): boolean {
  return /^[0-9a-f]{64}$/.test(token)
}

export type CartaoPublico = {
  codigo: string | null
  titulo: string
  coluna: string
  prazo: string | null
  entregue: boolean
}

type CartaoInterno = {
  codigo: string | null
  titulo: string
  prazo: string | null
  entregue_em: string | null
  [chave: string]: unknown
}

/**
 * O que sai para fora.
 *
 * Lista de permissão, e não de exclusão: campo novo em `cartoes` não vaza por
 * padrão. Uma lista de exclusão exigiria lembrar de atualizá-la a cada coluna
 * nova — e no dia em que alguém esquecer, o campo aparece na internet.
 *
 * Descrição, comentários, anexos, responsáveis e tempo ficam de fora: um link
 * de acompanhamento responde "em que pé está", não "o que a equipe conversou".
 */
export function paraPublico(cartao: CartaoInterno, nomeColuna: string): CartaoPublico {
  return {
    codigo: cartao.codigo,
    titulo: cartao.titulo,
    coluna: nomeColuna,
    prazo: cartao.prazo,
    entregue: Boolean(cartao.entregue_em),
  }
}
