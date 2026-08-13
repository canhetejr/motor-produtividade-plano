// Normalização de cabeçalho e de valor de planilha, sem dependência de
// runtime — por isso fora de lib/import-planilha.ts, que é 'server-only' por
// causa do ExcelJS. Aqui mora a parte que dá para testar no vitest.

/**
 * Reduz um rótulo de coluna à chave que o import usa.
 *
 * Existe porque o arquivo que a pessoa sobe quase nunca tem o cabeçalho
 * exato: ela exporta o catálogo (que sai com rótulos para humanos — "Área",
 * "Tempo padrão (min)"), mexe no Excel e sobe de volta. Sem normalizar,
 * `raw.area` vem indefinido em toda linha e o relatório acusa
 * `Área "" não encontrada` cinquenta vezes, escondendo que o problema era o
 * cabeçalho e não o dado.
 *
 * "Tempo padrão (min)" → "tempo_padrao_min"; "Área" → "area";
 * "BLOCOS TOTAIS" → "blocos_totais".
 */
export function normalizarCabecalho(rotulo: string): string {
  return rotulo
    .normalize('NFD')
    // Remove os diacríticos que o NFD separou das letras.
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    // Qualquer coisa que não seja letra ou número (parênteses, hífen, ponto)
    // vira separador — é o que faz "(min)" colar como sufixo em vez de virar
    // uma chave com pontuação que ninguém consegue prever.
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/ /g, '_')
}

/** Sinônimos aceitos por chave canônica, depois de normalizar. */
const ALIASES: Record<string, string> = {
  ativa: 'ativo',
  e_mail: 'email',
  perfil: 'role',
  papel: 'role',
  senha_inicial: 'senha',
  password: 'senha',
  tempo_padrao: 'tempo_padrao_min',
  tempo_padrao_minutos: 'tempo_padrao_min',
  carga_horaria: 'carga_horaria_min',
  carga_horaria_minutos: 'carga_horaria_min',
  blocos: 'blocos_totais',
  area_nome: 'area',
  nome_da_area: 'area',
}

export function chaveDeColuna(rotulo: string): string {
  const base = normalizarCabecalho(rotulo)
  return ALIASES[base] ?? base
}

/**
 * Desfaz, na leitura, o apóstrofo que `sanitizeFormula` (lib/csv.ts) põe no
 * export à frente de célula que começa com `=`, `+`, `-` ou `@`.
 *
 * Aquele apóstrofo é o que impede o Excel de tratar a célula como fórmula, e
 * ele precisa continuar existindo. Mas sem tirá-lo aqui a volta não fecha: a
 * área "+Vendas" sai como "'+Vendas" e não casa com área nenhuma na
 * reimportação, e a demanda "-Retrabalho" entra renomeada, em silêncio.
 *
 * Só o par exato (apóstrofo + caractere de fórmula) é desfeito — um nome que
 * legitimamente comece com apóstrofo continua intacto.
 */
export function limparCelula(valor: string): string {
  const v = valor.trim()
  return /^'[=+\-@]/.test(v) ? v.slice(1) : v
}

const VERDADEIROS = new Set(['true', '1', 'sim', 's', 'yes', 'y', 'x', 'verdadeiro'])

/**
 * Lê booleano de planilha. O export escreve "Sim"/"Não" porque o arquivo é
 * lido por gente; o Excel em inglês grava TRUE/FALSE; quem digita à mão põe
 * "x". Todos precisam significar a mesma coisa na volta.
 */
export function lerBooleano(valor: string | undefined, padrao = false): boolean {
  const v = (valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
  if (v === '') return padrao
  return VERDADEIROS.has(v)
}

const SEPARADORES = [',', ';', '\t', '|'] as const

/**
 * Descobre o separador olhando só a primeira linha, ignorando o que está
 * entre aspas.
 *
 * O Excel em português salva CSV com `;`, e é o formato que volta para cá
 * depois de a pessoa editar a planilha. Lido como `,`, o arquivo inteiro vira
 * uma coluna só: nenhuma chave bate, e o erro que aparece na tela é sobre o
 * dado, não sobre o separador.
 */
export function detectarSeparador(primeiraLinha: string): string {
  let melhor = ','
  let maior = 0
  for (const sep of SEPARADORES) {
    let contagem = 0
    let dentroDeAspas = false
    for (const ch of primeiraLinha) {
      if (ch === '"') dentroDeAspas = !dentroDeAspas
      else if (ch === sep && !dentroDeAspas) contagem++
    }
    if (contagem > maior) {
      maior = contagem
      melhor = sep
    }
  }
  return melhor
}
