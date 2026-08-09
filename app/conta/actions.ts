'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

/**
 * Sair a partir das telas de conta bloqueada.
 *
 * Existe porque /conta/* vive FORA de app/(app) — de propósito, senão
 * requireUser() redirecionaria para cá em loop — e é o layout de (app) que
 * monta a sidebar, onde mora o único botão de sair do produto. Sem isto,
 * quem tem a organização expirada ou suspensa fica preso: não entra no app,
 * não troca de conta e não consegue encerrar a sessão.
 */
export async function sair() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
