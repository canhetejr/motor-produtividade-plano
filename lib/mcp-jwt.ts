import 'server-only'
import { createHmac, randomUUID } from 'node:crypto'

// Curto de propósito: o JWT só precisa sobreviver ao tempo de uma chamada
// MCP (resolver token → montar client → rodar a tool), nunca a uma sessão
// inteira. Expiração curta reduz o estrago de um JWT vazado em log.
const DURACAO_SEGUNDOS = 90

function base64url(input: string): string {
  return Buffer.from(input).toString('base64url')
}

/**
 * Assina um JWT HS256 com `sub = colaboradorId`, no mesmo formato que o
 * Supabase Auth emite para uma sessão de cookie comum. Para o
 * PostgREST/Postgres, este JWT é indistinguível de uma sessão real —
 * `auth.uid()` resolve, `org_atual()` funciona, e toda RLS/RPC continuam
 * sendo a única fonte de verdade (ver docs/PLANO-MCP.md). Isto NÃO é um
 * bypass como o client de service role (utils/supabase/admin.ts): é
 * impersonação por assinatura.
 *
 * Requer o "Legacy JWT Secret" (HS256) do projeto Supabase — Settings >
 * API > JWT Settings. Projetos migrados para chaves assimétricas (JWKS)
 * precisam reativar o modo legado antes disso funcionar (Fase 0 do plano).
 */
export function assinarJwtImpersonado(colaboradorId: string): string {
  const secret = process.env.SUPABASE_JWT_SECRET
  if (!secret) {
    throw new Error(
      'SUPABASE_JWT_SECRET não configurada — necessária para o servidor MCP impersonar sessão de colaborador. Ver docs/PLANO-MCP.md.'
    )
  }

  const agora = Math.floor(Date.now() / 1000)
  const header = { alg: 'HS256', typ: 'JWT' }
  const payload = {
    sub: colaboradorId,
    role: 'authenticated',
    aud: 'authenticated',
    iat: agora,
    exp: agora + DURACAO_SEGUNDOS,
    jti: randomUUID(),
  }

  const semAssinatura = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`
  const assinatura = createHmac('sha256', secret).update(semAssinatura).digest('base64url')
  return `${semAssinatura}.${assinatura}`
}
