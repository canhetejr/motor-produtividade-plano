/**
 * Produtividade: quanto do tempo esperado a pessoa gastou de verdade.
 *
 * O índice que já existia responde "a jornada foi ocupada?" — e, para
 * demanda de tempo padrão, o tempo creditado É o tempo padrão, então quem
 * faz a mesma coisa em 20 min e quem faz em 90 recebem crédito idêntico.
 * Aqui a pergunta é outra: dado o que se esperava daquela execução, quanto
 * de fato levou.
 *
 * Acima de 100% = mais rápido que o esperado.
 */

export type Medicao = {
  /** Minutos que a régua da demanda previa. */
  esperado_min: number
  /** Minutos efetivamente gastos. */
  real_min: number
}

/**
 * Limiares em fração do esperado.
 *
 * Nomeados aqui pelo mesmo motivo dos de `capacidade.ts`: não são lei, mas
 * precisa haver um lugar só onde discuti-los. A banda de 95–115% é
 * deliberadamente larga — abaixo disso a variação normal de qualquer
 * trabalho humano viraria alarme, e um painel que alarma sempre não é lido.
 */
export const LIMIAR_ACIMA = 1.15
export const LIMIAR_NO_RITMO = 0.95
export const LIMIAR_ATENCAO = 0.75

export type Faixa = 'acima' | 'no_ritmo' | 'atencao' | 'abaixo' | 'sem_medicao'

export const ROTULO_FAIXA: Record<Faixa, string> = {
  acima: 'Acima do esperado',
  no_ritmo: 'No ritmo',
  atencao: 'Atenção',
  abaixo: 'Abaixo do esperado',
  sem_medicao: 'Sem medição',
}

/**
 * Razão esperado/real de um conjunto de execuções.
 *
 * **Soma sobre soma, nunca média de razões.** Uma execução de 2 min contra
 * um esperado de 60 tem razão 30 e sequestraria qualquer média aritmética;
 * ponderar pelo tempo resolve isso sem precisar descartar outlier na mão.
 *
 * Devolve `null` — e não zero — quando não há o que medir: zero é um
 * resultado ruim, ausência de medição não é resultado nenhum, e pintar as
 * duas coisas da mesma cor mentiria para o gestor.
 */
export function produtividadeDe(medicoes: Medicao[]): number | null {
  let esperado = 0
  let real = 0
  for (const m of medicoes) {
    if (m.real_min <= 0 || m.esperado_min <= 0) continue
    esperado += m.esperado_min
    real += m.real_min
  }
  if (real <= 0) return null
  return esperado / real
}

/** Atalho para uma execução só, com a mesma regra de ausência. */
export function produtividadeDaExecucao(m: Medicao): number | null {
  return produtividadeDe([m])
}

export function faixaDe(produtividade: number | null): Faixa {
  if (produtividade === null || !Number.isFinite(produtividade) || produtividade <= 0) {
    return 'sem_medicao'
  }
  if (produtividade >= LIMIAR_ACIMA) return 'acima'
  if (produtividade >= LIMIAR_NO_RITMO) return 'no_ritmo'
  if (produtividade >= LIMIAR_ATENCAO) return 'atencao'
  return 'abaixo'
}

/** "112%" — arredondado, porque casa decimal em produtividade é ruído. */
export function formatarProdutividade(produtividade: number | null): string {
  if (produtividade === null) return '—'
  return `${Math.round(produtividade * 100)}%`
}

// ---------------------------------------------------------------------
// Virada de tempo variável para tempo fixo
// ---------------------------------------------------------------------

/**
 * Execuções mínimas antes de sugerir fixar o tempo.
 *
 * Dez é pouco para estatística e muito para a paciência de quem cadastrou a
 * demanda semana passada. O número existe para a sugestão não aparecer
 * depois de duas execuções, quando a média ainda é o acaso.
 */
export const EXECUCOES_PARA_SUGERIR = 10

export type ResumoDemanda = {
  execucoes: number
  media_real_min: number
  min_real_min: number
  max_real_min: number
}

export type SugestaoTempoFixo = {
  minutos: number
  execucoes: number
  min_real_min: number
  max_real_min: number
  /** Amplitude sobre a média. Acima de 1 os extremos são maiores que a média. */
  dispersao: number
}

/**
 * O que propor ao gestor, ou nada.
 *
 * Devolve a dispersão junto com a média de propósito: é ela que distingue
 * uma demanda que sempre leva 45 min de uma que leva 10 ou 90 conforme o
 * caso. Fixar tempo padrão na segunda seria trocar "não sei medir" por
 * "meço errado", e só quem vê a variação consegue recusar.
 *
 * Nada é aplicado automaticamente — a decisão de mudar a régua é do gestor.
 */
export function sugerirTempoFixo(resumo: ResumoDemanda): SugestaoTempoFixo | null {
  if (resumo.execucoes < EXECUCOES_PARA_SUGERIR) return null
  const minutos = Math.max(1, Math.round(resumo.media_real_min))
  if (!Number.isFinite(minutos) || minutos <= 0) return null
  return {
    minutos,
    execucoes: resumo.execucoes,
    min_real_min: resumo.min_real_min,
    max_real_min: resumo.max_real_min,
    dispersao: (resumo.max_real_min - resumo.min_real_min) / minutos,
  }
}

/** Acima disto a demanda é heterogênea demais para virar tempo fixo sem aviso. */
export const DISPERSAO_ALTA = 1

// ---------------------------------------------------------------------
// Níveis de complexidade
// ---------------------------------------------------------------------

export const NIVEIS_COMPLEXIDADE = ['baixa', 'media', 'alta', 'muito_alta'] as const
export type NivelComplexidade = (typeof NIVEIS_COMPLEXIDADE)[number]

export const ROTULO_COMPLEXIDADE: Record<NivelComplexidade, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  muito_alta: 'Muito alta',
}

/** Mesmos valores do seed da migration — a tela mostra estes até o gestor calibrar. */
export const MINUTOS_PADRAO_COMPLEXIDADE: Record<NivelComplexidade, number> = {
  baixa: 15,
  media: 30,
  alta: 60,
  muito_alta: 120,
}

export function ehNivelComplexidade(v: unknown): v is NivelComplexidade {
  return typeof v === 'string' && (NIVEIS_COMPLEXIDADE as readonly string[]).includes(v)
}

/**
 * Régua da organização a partir das linhas de `complexidade_niveis`, caindo
 * no padrão para o que faltar.
 *
 * O fallback não é zelo excessivo: a tabela é populada por migration e por
 * `criar_organizacao`, mas uma organização criada antes da migration num
 * ambiente que ainda não a rodou ficaria com a tela mostrando `undefined min`
 * em vez de um número.
 */
export function reguaDeComplexidade(
  linhas: Array<{ nivel: string; minutos_referencia: number }> | null | undefined
): Record<NivelComplexidade, number> {
  const regua = { ...MINUTOS_PADRAO_COMPLEXIDADE }
  for (const l of linhas ?? []) {
    if (ehNivelComplexidade(l.nivel) && l.minutos_referencia > 0) {
      regua[l.nivel] = l.minutos_referencia
    }
  }
  return regua
}

/**
 * Lê o nível como ele sai de uma planilha, não como o banco o guarda.
 *
 * O export escreve o rótulo ("Muito alta"); o import precisa aceitar isso de
 * volta, senão o ciclo exportar → corrigir → reimportar quebra numa coluna
 * que a própria tela gerou. Acento, caixa e espaço são normalizados; o que
 * não for um dos quatro níveis vira `null` em vez de erro, porque demanda
 * sem complexidade continua sendo demanda válida.
 */
export function lerComplexidade(v: unknown): NivelComplexidade | null {
  if (typeof v !== 'string') return null
  const normalizado = v
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
  return ehNivelComplexidade(normalizado) ? normalizado : null
}
