import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // Autenticação simples (em produção usaríamos algo mais forte ou headers específicos do Vercel Cron)
  const authHeader = request.headers.get('authorization')
  
  // Extrai o token do header 'Bearer <token>' ou de um query param (para testes manuais rápidos se precisar, mas o ideal é só header)
  const url = new URL(request.url)
  const token = authHeader?.split(' ')[1] || url.searchParams.get('token')

  if (token !== 'cron_motor_secret_2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Cria um client limpo só pra disparar a RPC
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { error } = await supabase.rpc('refresh_indicadores_diarios', { secret_key: 'cron_motor_secret_2026' })

  if (error) {
    console.error('Erro ao atualizar Materialized View:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, message: 'Indicadores diários consolidados com sucesso!' })
}
