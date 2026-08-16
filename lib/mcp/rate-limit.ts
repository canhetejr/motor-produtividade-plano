import 'server-only'
import { createAdminClient } from '@/utils/supabase/admin'

// Gate 3 do docs/PLANO-MCP-PRODUTO.md. O contador vive no Postgres
// (mcp_consumir_rate_limit, 20260816120000_mcp_rate_limit.sql) e não em
// memória do processo: o app roda em container no Coolify, que reinicia a
// cada deploy, e cada réplica teria seu próprio contador — o limite real
// seria o configurado vezes o número de réplicas, sem aviso nenhum.

/** Requisições por janela, por token resolvido. */
const LIMITE_POR_TOKEN = Number(process.env.MCP_RATE_LIMIT_TOKEN ?? 120)
/**
 * Teto por IP, anterior à autenticação. Mais alto que o do token de propósito:
 * várias pessoas de uma mesma empresa saem pelo mesmo IP de saída, e um teto
 * baixo aqui puniria o vizinho de rede em vez do abusador. O que este limite
 * contém é varredura de token por força bruta, não uso normal.
 */
const LIMITE_POR_IP = Number(process.env.MCP_RATE_LIMIT_IP ?? 240)
const JANELA_SEGUNDOS = Number(process.env.MCP_RATE_LIMIT_JANELA_SEGUNDOS ?? 60)

export type ResultadoLimite = { permitido: boolean; reiniciaEm: Date | null }

const LIBERADO: ResultadoLimite = { permitido: true, reiniciaEm: null }

async function consumir(chave: string, limite: number): Promise<ResultadoLimite> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('mcp_consumir_rate_limit', {
      p_chave: chave,
      p_limite: limite,
      p_janela_segundos: JANELA_SEGUNDOS,
    })
    if (error) throw error

    const linha = Array.isArray(data) ? data[0] : data
    if (!linha) return LIBERADO
    return {
      permitido: linha.permitido,
      reiniciaEm: linha.reinicia_em ? new Date(linha.reinicia_em) : null,
    }
  } catch (err) {
    // Falha ABERTA, e a escolha é deliberada: o recurso protegido aqui é o
    // próprio banco que acabou de falhar. Toda tool do MCP consulta esse mesmo
    // Postgres, então uma requisição que passe por cima do limitador não vai
    // conseguir ler nem escrever nada — não há acesso a mais nada sendo
    // concedido. Falhar fechado, em troca, transformaria uma instabilidade
    // momentânea numa onda de 429 que aponta para o lugar errado na hora de
    // investigar.
    console.error('MCP: limitador indisponível, seguindo sem limite nesta requisição:', err)
    return LIBERADO
  }
}

export function limitarPorIp(ip: string) {
  return consumir(`ip:${ip}`, LIMITE_POR_IP)
}

export function limitarPorToken(tokenId: string) {
  return consumir(`token:${tokenId}`, LIMITE_POR_TOKEN)
}

/**
 * IP de origem para fins de limite.
 *
 * Em produção o app está atrás do proxy do Coolify, que preenche
 * `x-forwarded-for`; o primeiro elemento é o cliente. Vale registrar o limite
 * disso: um cliente que fale DIRETO com o container pode forjar o header e
 * escolher o próprio balde. Isso não enfraquece nada que dependa de
 * identidade — o limite por token, esse sim, usa o id resolvido do banco.
 */
export function ipDaRequisicao(headers: Headers): string {
  const encaminhado = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return encaminhado || headers.get('x-real-ip')?.trim() || 'desconhecido'
}
