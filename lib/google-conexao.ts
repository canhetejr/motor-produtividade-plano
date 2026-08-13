import 'server-only'

import { createAdminClient } from '@/utils/supabase/admin'

/**
 * E-mail da conta Google conectada por esta pessoa, ou null.
 *
 * `google_workspace_conexoes` guarda o refresh token cifrado e por isso não é
 * legível por `authenticated` — só service role chega nela. O bypass é seguro
 * aqui porque nenhum dos dois filtros vem do cliente: `colaboradorId` sai de
 * requireUser() e `organizacaoId` do perfil da sessão.
 *
 * Vive em lib/ porque duas telas fazem a mesma leitura (/configuracoes e
 * /setup) — duplicar o uso de service role seria duplicar a chance de esquecer
 * um dos dois filtros.
 */
export async function emailGoogleConectado(
  colaboradorId: string,
  organizacaoId: string
): Promise<string | null> {
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('google_workspace_conexoes')
      .select('email')
      .eq('colaborador_id', colaboradorId)
      .eq('organizacao_id', organizacaoId)
      .maybeSingle()
    return data?.email ?? null
  } catch {
    // Sem service role em desenvolvimento, a conexão só fica indisponível.
    return null
  }
}

/** O OAuth do Google só existe se as credenciais estiverem no ambiente. */
export function integracaoGoogleConfigurada(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.NEXT_PUBLIC_APP_URL
  )
}
