import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import type { Role } from '@/lib/database.types'

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
      'id, nome, role, admin, area_id, carga_horaria_min, ativo, avatar_url, notif_lembrete_diario, notif_solicitacoes, notif_alerta_queda, notif_relatorio_semanal, mfa_email_ativo, troca_senha_obrigatoria, organizacao_id, organizacoes(status, trial_expira_em, nome, limite_assentos, dono_colaborador_id)'
    )
    .eq('id', user.id)
    .single()

  // `colaboradores.role` chega do banco como `string` (o `check (role in
  // ('colaborador', 'gestor'))` da tabela garante os dois valores, mas o tipo
  // gerado não sabe disso) — normaliza aqui, na única leitura da sessão, em
  // vez de cada chamador castar às cegas.
  return profile ? { user, profile: { ...profile, role: profile.role as Role } } : null
})

export async function requireUser() {
  const session = await getProfile()
  if (!session) redirect('/login')
  // Desativar um colaborador/gestor em /catalogo precisa derrubar o acesso na
  // hora, não só deixar de contar nas métricas — sem isso, a sessão continua
  // válida até expirar sozinha mesmo com `ativo = false`.
  if (!session.profile.ativo) redirect('/login?message=' + encodeURIComponent('Conta desativada. Fale com o gestor.'))
  // Gate de status da organização (Fase 7): org_atual() no banco já devolve
  // NULL para organização não-trialing/ativa, então RLS protegia o dado
  // mesmo sem isto — mas sem o redirect a pessoa via telas vazias em vez de
  // uma explicação. /conta/suspensa e /conta/expirada ficam FORA de
  // app/(app) e NÃO chamam requireUser(), senão o redirect delas apontaria
  // de volta para si mesmas.
  const status = session.profile.organizacoes?.status
  if (status === 'expirada') redirect('/conta/expirada')
  // 'suspensa' e 'excluindo' (organização marcada para exclusão, mas ainda
  // não apagada — ver docs/PLANO-PRODUTO.md) bloqueiam acesso do mesmo jeito;
  // só existe a tela /conta/suspensa para os dois, o texto genérico serve.
  if (status === 'suspensa' || status === 'excluindo') redirect('/conta/suspensa')
  return session
}

export async function requireGestor() {
  const session = await requireUser()
  if (session.profile.role !== 'gestor') redirect('/apontamento')
  return session
}

// Admin global (bloco 33). Não precisa checar role: a constraint
// colaboradores_admin_exige_gestor garante no banco que admin ⊃ gestor, então
// quem passa aqui já passaria em requireGestor().
export async function requireAdmin() {
  const session = await requireUser()
  if (!session.profile.admin) redirect('/apontamento')
  return session
}

// Versão que não redireciona — para actions que só querem *saber* se quem
// chamou é admin (ex.: decidir se pode mexer no papel de alguém) em vez de
// barrar a rota inteira.
export async function isAdmin() {
  const session = await getProfile()
  return Boolean(session?.profile.ativo && session.profile.admin)
}
