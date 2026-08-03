import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { createAdminClient } from '@/utils/supabase/admin'
import { decifrarToken, revokeGoogleToken } from '@/lib/google-workspace'

export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) return new NextResponse('Forbidden', { status: 403 })
  const { user } = await requireUser()
  const admin = createAdminClient()
  const { data } = await admin.from('google_workspace_conexoes').select('refresh_token_cifrado').eq('colaborador_id', user.id).maybeSingle()
  if (data) await revokeGoogleToken(decifrarToken(data.refresh_token_cifrado)).catch(() => undefined)
  await admin.from('google_workspace_conexoes').delete().eq('colaborador_id', user.id)
  return NextResponse.redirect(new URL('/perfil?google=desconectado', request.url), 303)
}
