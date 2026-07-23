// Normaliza e valida coerência antes de gravar uma demanda (usado no cadastro
// direto, na sugestão, na aprovação e no import em massa — pra não deixar
// combinação incoerente entrar por nenhum caminho):
//  - variável ignora tempo padrão, blocos e finita → força tempo=null,
//    blocos=1, finita=false;
//  - demanda em blocos (blocos > 1) precisa de tempo padrão, senão cada bloco
//    valeria 0 min (é a validação que não dá pra normalizar sozinho — barra);
//  - finita (bloco finito, Fase 2) só faz sentido dividida em mais de 1
//    bloco (senão não há o que "esgotar") — barra em vez de normalizar
//    silenciosamente, pra não confundir quem marcou a opção sem perceber
//    que ela não fez nada.
//
// Extraída pra módulo puro (sem 'use server') pra dar pra testar sem
// depender do runtime de Server Actions do Next.
export function prepararDemanda<
  T extends { tempo_padrao_min: number | null; variavel: boolean; blocos_totais: number; finita: boolean },
>(d: T): { error: string } | { data: T } {
  const norm: T = d.variavel ? { ...d, tempo_padrao_min: null, blocos_totais: 1, finita: false } : d
  if (!norm.variavel && norm.blocos_totais > 1 && norm.tempo_padrao_min == null) {
    return { error: 'Demanda dividida em blocos precisa de um tempo padrão definido.' }
  }
  if (norm.finita && norm.blocos_totais <= 1) {
    return { error: 'Demanda finita precisa estar dividida em mais de 1 bloco.' }
  }
  return { data: norm }
}
