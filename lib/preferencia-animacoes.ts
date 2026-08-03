/**
 * Preferência de fundo animado.
 *
 * Fica no armazenamento local, e não no perfil do banco, porque é decisão de
 * DESEMPENHO e desempenho é do aparelho: a mesma pessoa pode querer o fundo no
 * desktop e não no celular antigo. Guardar no banco imporia uma escolha só para
 * todos os aparelhos dela.
 */

export const CHAVE_ANIMACOES = 'vertice:fundo-animado'

export type PreferenciaAnimacao = 'ligado' | 'desligado'

/**
 * O padrão é ligado, exceto quando o sistema pede menos movimento.
 *
 * `prefers-reduced-motion` não é preferência estética — é acessibilidade, e para
 * parte das pessoas movimento de fundo causa desconforto real. Respeitar isso
 * por omissão, e não só quando alguém encontra o interruptor, é o comportamento
 * correto.
 */
export function preferenciaPadrao(reduzirMovimento: boolean): PreferenciaAnimacao {
  return reduzirMovimento ? 'desligado' : 'ligado'
}

export function lerPreferencia(
  bruto: string | null,
  reduzirMovimento: boolean
): PreferenciaAnimacao {
  if (bruto === 'ligado' || bruto === 'desligado') return bruto
  // Valor inválido ou ausente cai no padrão, em vez de deixar o fundo num
  // estado indefinido.
  return preferenciaPadrao(reduzirMovimento)
}

/**
 * Uma escolha explícita vence `prefers-reduced-motion`.
 *
 * Quem liga o fundo no interruptor sabendo que o sistema pede menos movimento
 * está dizendo algo mais específico que a configuração geral do sistema
 * operacional. O padrão respeita; a escolha manual manda.
 */
export function deveAnimar(bruto: string | null, reduzirMovimento: boolean): boolean {
  return lerPreferencia(bruto, reduzirMovimento) === 'ligado'
}
