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
     */
    '/((?!_next/static|_next/image|favicon.ico|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
