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
     * - offline: o service worker faz precache dessa página; um redirect pro
     *   /login gravaria a página errada no cache
     * - manifest.webmanifest e sw.js: precisam responder 200 sem sessão —
     *   o browser busca os dois direto (registro do service worker, PWA
     *   install prompt), um redirect pro /login quebra o registro do SW
     *   (content-type vira text/html) e o manifest não carrega deslogado.
     */
    '/((?!_next/static|_next/image|favicon.ico|api/cron|offline|manifest\\.webmanifest|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
