import { type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

// Next 16: proxy.ts substitui middleware.ts (runtime nodejs).
export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Todas as rotas exceto:
     * - _next/static, _next/image, favicon e imagens estáticas
     * - api/cron (validado por CRON_SECRET, não por sessão)
     * - api/mcp (validado por Bearer token de mcp_tokens, lib/mcp-auth.ts —
     *   mesmo motivo de api/cron: sem cookie de sessão, updateSession()
     *   redirecionaria todo agente MCP para /login antes do guard rodar)
     * - api/webhooks (validado por Bearer token de formularios_webhooks,
     *   lib/formulario-webhook-auth.ts — mesmo motivo de api/mcp: quem chama
     *   é uma automação externa, ex. n8n, sem cookie de sessão)
     * - offline: o service worker faz precache dessa página; um redirect pro
     *   /login gravaria a página errada no cache
     * - manifest.webmanifest e sw.js: precisam responder 200 sem sessão —
     *   o browser busca os dois direto (registro do service worker, PWA
     *   install prompt), um redirect pro /login quebra o registro do SW
     *   (content-type vira text/html) e o manifest não carrega deslogado.
     */
    '/((?!_next/static|_next/image|favicon.ico|api/cron|api/mcp|api/webhooks|offline|manifest\\.webmanifest|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
