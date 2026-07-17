import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

// React.cache: uma única query de perfil por request, mesmo que layout,
// página e actions chamem getProfile no mesmo render.
export const getProfile = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('colaboradores')
    .select('id, nome, role, area_id, carga_horaria_min, ativo')
    .eq('id', user.id)
    .single()

  return profile ? { user, profile } : null
})

export async function requireUser() {
  const session = await getProfile()
  if (!session) redirect('/login')
  return session
}

export async function requireGestor() {
  const session = await requireUser()
  if (session.profile.role !== 'gestor') redirect('/apontamento')
  return session
}
