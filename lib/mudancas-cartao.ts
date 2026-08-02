/**
 * Descreve, em português, o que mudou num card.
 *
 * O histórico do card já registra movimentação, entrega, transferência e ajuste
 * de horas, mas não registrava edição de campo — e prazo e prioridade são
 * justamente os que geram a pergunta "quem mudou isso e quando".
 *
 * Função pura, sem acesso ao banco, para o formato da frase ser testável: é
 * texto que fica gravado para sempre no histórico e não dá para corrigir depois
 * sem reescrever linhas antigas.
 */

export type CamposCartao = {
  titulo?: string | null
  prazo?: string | null
  prioridade?: string | null
  tipo?: string | null
  inicioDesejado?: string | null
  tempoEstimadoMin?: number | null
}

const ROTULO: Record<keyof CamposCartao, string> = {
  titulo: 'título',
  prazo: 'entrega desejada',
  prioridade: 'prioridade',
  tipo: 'tipo',
  inicioDesejado: 'início desejado',
  tempoEstimadoMin: 'estimativa',
}

const PRIORIDADE_TEXTO: Record<string, string> = { baixa: 'Baixa', media: 'Média', alta: 'Alta' }

function formatar(campo: keyof CamposCartao, valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return 'vazio'
  if (campo === 'prioridade') return PRIORIDADE_TEXTO[String(valor)] ?? String(valor)
  if (campo === 'tempoEstimadoMin') return `${valor} min`
  if (campo === 'prazo' || campo === 'inicioDesejado') {
    // 'T00:00:00' força leitura local; sem isso a string curta é lida como UTC
    // e o histórico registra o dia anterior.
    const d = new Date(`${valor}T00:00:00`)
    return Number.isNaN(d.getTime()) ? String(valor) : d.toLocaleDateString('pt-BR')
  }
  return String(valor)
}

/**
 * Normaliza antes de comparar: `null`, `undefined` e `''` significam a mesma
 * coisa aqui (campo vazio), e sem isso trocar `null` por `''` num formulário
 * geraria um evento de "mudou de vazio para vazio".
 */
function vazio(v: unknown): boolean {
  return v === null || v === undefined || v === ''
}

export function descreverMudancas(antes: CamposCartao, depois: CamposCartao): string[] {
  const frases: string[] = []

  for (const campo of Object.keys(ROTULO) as Array<keyof CamposCartao>) {
    const a = antes[campo]
    const b = depois[campo]
    if (vazio(a) && vazio(b)) continue
    if (a === b) continue
    // Comparação por texto: o formulário devolve número como string, e
    // `120 !== '120'` geraria evento a cada salvamento sem mudança nenhuma.
    if (!vazio(a) && !vazio(b) && String(a) === String(b)) continue

    if (campo === 'titulo') {
      // O título antigo inteiro na frase deixa o histórico ilegível quando é
      // longo; o novo já está no cabeçalho do card.
      frases.push('Renomeou o card.')
      continue
    }
    frases.push(`Alterou ${ROTULO[campo]}: ${formatar(campo, a)} → ${formatar(campo, b)}.`)
  }

  return frases
}

/** Uma linha só para o histórico, ou `null` quando nada mudou. */
export function resumirMudancas(antes: CamposCartao, depois: CamposCartao): string | null {
  const frases = descreverMudancas(antes, depois)
  return frases.length === 0 ? null : frases.join(' ')
}
