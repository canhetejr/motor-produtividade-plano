// Sem `import 'server-only'`: ele lanca no vitest e este modulo tem teste. A
// protecao contra ir parar num bundle de cliente ja existe e e mais forte —
// `node:crypto` nao empacota para o navegador, entao o build quebra sozinho se
// alguem importar isto de um componente cliente.
import { createHash } from 'node:crypto'

/**
 * Checagem de senha vazada contra o Have I Been Pwned.
 *
 * O advisor do Supabase aponta que a proteção nativa está desligada, e ligá-la é
 * uma chave no painel. Isto faz a mesma verificação no app, no momento em que a
 * senha é definida — o único momento em que dá para recusar.
 *
 * Usa k-anonimato: só os 5 primeiros caracteres do SHA-1 saem daqui. A API
 * devolve todos os sufixos que começam com esse prefixo (tipicamente ~800), e a
 * comparação acontece localmente. A senha, nem o hash completo, nunca trafega.
 */

const API = 'https://api.pwnedpasswords.com/range'

export type ResultadoVazamento =
  | { vazada: true; ocorrencias: number }
  | { vazada: false }
  /** A API não respondeu. Não é o mesmo que "senha segura". */
  | { indisponivel: true }

export async function verificarSenhaVazada(
  senha: string,
  buscar: typeof fetch = fetch
): Promise<ResultadoVazamento> {
  // SHA-1 aqui não é escolha de segurança — é o protocolo da API. O hash nunca
  // sai completo daqui.
  const hash = createHash('sha1').update(senha, 'utf8').digest('hex').toUpperCase()
  const prefixo = hash.slice(0, 5)
  const sufixo = hash.slice(5)

  try {
    const resposta = await buscar(`${API}/${prefixo}`, {
      headers: { 'Add-Padding': 'true' },
      // A verificação não pode travar o cadastro se a API estiver lenta.
      signal: AbortSignal.timeout(3000),
    })
    if (!resposta.ok) return { indisponivel: true }

    const corpo = await resposta.text()
    for (const linha of corpo.split('\n')) {
      const [suf, contagem] = linha.trim().split(':')
      if (suf === sufixo) {
        const n = Number(contagem)
        // O padding da API devolve entradas falsas com contagem 0; elas não são
        // vazamentos reais.
        if (n > 0) return { vazada: true, ocorrencias: n }
        return { vazada: false }
      }
    }
    return { vazada: false }
  } catch {
    return { indisponivel: true }
  }
}

/**
 * Mensagem de recusa, ou `null` se a senha pode ser aceita.
 *
 * API indisponível NÃO bloqueia o cadastro: deixar alguém sem conseguir criar
 * usuário porque um serviço de terceiro caiu é pior que aceitar uma senha que
 * talvez esteja numa lista. A checagem é uma camada, não a única.
 */
export function mensagemDeRecusa(resultado: ResultadoVazamento): string | null {
  if ('indisponivel' in resultado) return null
  if (!resultado.vazada) return null
  return `Esta senha aparece em ${resultado.ocorrencias.toLocaleString('pt-BR')} vazamentos conhecidos. Escolha outra.`
}
