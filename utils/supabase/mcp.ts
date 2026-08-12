import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

/**
 * Client Supabase "vestido" de sessão para o servidor MCP: em vez de cookie
 * (não há navegador aqui), usa um JWT assinado por lib/mcp-jwt.ts como
 * Authorization Bearer. RLS continua ativa e continua sendo a única fonte
 * de verdade — diferente do client de service role (utils/supabase/admin.ts),
 * este client NÃO bypassa nada, por isso não entra na allowlist de
 * __tests__/isolamento/admin-client-estatico.test.ts.
 */
export function createImpersonatedClient(jwt: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY ausentes.')
  }
  return createSupabaseClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })
}
