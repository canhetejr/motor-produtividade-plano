import Link from 'next/link'
import { SlidersHorizontal, UserRound } from 'lucide-react'

import { MfaToggle } from './mfa-toggle'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { PerfilManager } from './perfil-manager'
import { McpTokensManager, type McpTokenListado } from './mcp-tokens-manager'
import { EmailCard } from './email-card'
import { PageHeader, PageShell } from '@/components/layout/page-shell'
import { buttonVariants } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

// Aparência, notificações, push, Google Workspace e ICS saíram desta tela para
// /configuracoes: são preferência e integração, não identidade. O que fica
// aqui é quem a pessoa é (nome, foto, e-mail, área, carga) e como ela prova
// que é ela (senha, segundo fator, tokens de API).
export default async function PerfilPage(props: {
  searchParams: Promise<{ email_atualizado?: string; erro_email?: string }>
}) {
  const { user, profile } = await requireUser()
  const supabase = await createClient()
  const searchParams = await props.searchParams

  const { data: areas } = await supabase.from('areas').select('id, nome, ativo').order('nome')
  const areaNome = (areas ?? []).find((a) => a.id === profile.area_id)?.nome ?? null

  // RLS de mcp_tokens já restringe a leitura ao próprio colaborador
  // (política mcp_tokens_proprio) — nenhum filtro manual é necessário aqui.
  const { data: mcpTokensRaw } = await supabase
    .from('mcp_tokens')
    .select('id, nome, token_prefixo, escopos, criado_em, ultimo_uso_em, expira_em')
    .is('revogado_em', null)
    .order('criado_em', { ascending: false })
  const mcpTokens: McpTokenListado[] = (mcpTokensRaw ?? []).map((t) => ({
    id: t.id,
    nome: t.nome,
    tokenPrefixo: t.token_prefixo,
    escopos: t.escopos,
    criadoEm: t.criado_em,
    ultimoUsoEm: t.ultimo_uso_em,
    expiraEm: t.expira_em,
  }))

  return (
    <PageShell width="narrow">
        <PageHeader
          title="Meu perfil"
          description="Seus dados, seu e-mail de acesso e a segurança da sua conta."
          icon={UserRound}
          actions={
            <Link href="/configuracoes" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              <SlidersHorizontal className="h-4 w-4" /> Configurações
            </Link>
          }
        />

        <PerfilManager
          nome={profile.nome}
          email={user.email || ''}
          avatarUrl={profile.avatar_url}
          areaId={profile.area_id}
          areaNome={areaNome}
          areas={(areas ?? []).filter((a) => a.ativo || a.id === profile.area_id)}
          cargaHorariaMin={profile.carga_horaria_min}
          role={profile.role}
        />

        {/* O e-mail não vem de `colaboradores` — ele é `auth.users.email`, e o
            pedido pendente é `new_email`, também do Auth. Por isso os dois
            saem de `user`, não de `profile`. */}
        <EmailCard
          email={user.email ?? ''}
          emailPendente={user.new_email ?? null}
          resultado={searchParams.email_atualizado ?? null}
          erro={searchParams.erro_email ?? null}
        />

        <MfaToggle ativoInicial={profile.mfa_email_ativo ?? false} />

        {/* Tokens MCP continuam aqui, e não em /configuracoes: são credencial
            de acesso à conta, da mesma família de senha e segundo fator. */}
        <McpTokensManager tokens={mcpTokens} />
    </PageShell>
  )
}
