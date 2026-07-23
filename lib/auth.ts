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
    .select(
      'id, nome, role, area_id, carga_horaria_min, ativo, avatar_url, notif_lembrete_diario, notif_solicitacoes, notif_alerta_queda, notif_relatorio_semanal'
    )
    .eq('id', user.id)
    .single()

  return profile ? { user, profile } : null
})

export async function requireUser() {
  const session = await getProfile()
  if (!session) redirect('/login')
  // Desativar um colaborador/gestor em /catalogo precisa derrubar o acesso na
  // hora, não só deixar de contar nas métricas — sem isso, a sessão continua
  // válida até expirar sozinha mesmo com `ativo = false`.
  if (!session.profile.ativo) redirect('/login?message=' + encodeURIComponent('Conta desativada. Fale com o gestor.'))
  return session
}

export async function requireGestor() {
  const session = await requireUser()
  if (session.profile.role !== 'gestor') redirect('/apontamento')
  return session
}
