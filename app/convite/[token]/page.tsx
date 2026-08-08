import { createHash } from 'node:crypto'
import { createAdminClient } from '@/utils/supabase/admin'
import { ConviteForm } from './convite-form'

export const metadata = {
  title: 'Aceitar convite — Vértice',
}

// Fora de app/(app) e de app/(marketing): não usa o layout público (sem
// header de marketing) nem requireUser() (sem sessão ainda). Rota pública
// por token, no mesmo padrão de app/q/[token] — a autorização é o hash do
// token na URL, nunca comparado em texto puro.
export default async function ConvitePage(props: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ message?: string }>
}) {
  const { token } = await props.params
  const searchParams = await props.searchParams
  const tokenHash = createHash('sha256').update(token).digest('hex')

  const admin = createAdminClient()
  const { data: convite } = await admin
    .from('convites')
    .select('email, role, aceito_em, revogado_em, expira_em, organizacoes(nome)')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  let erroConvite: string | null = null
  if (!convite) {
    erroConvite = 'Convite inválido ou não encontrado.'
  } else if (convite.aceito_em) {
    erroConvite = 'Este convite já foi aceito. Faça login com sua conta.'
  } else if (convite.revogado_em) {
    erroConvite = 'Este convite foi revogado.'
  } else if (new Date(convite.expira_em) < new Date()) {
    erroConvite = 'Este convite expirou. Peça um novo ao seu gestor.'
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#05050b] px-6 py-16 text-white">
      <div className="w-full max-w-[444px]">
        {erroConvite || !convite ? (
          <div className="grid gap-3 text-center">
            <h1 className="font-heading text-2xl font-medium">Não foi possível abrir o convite</h1>
            <p className="text-base leading-6 text-white/70">{erroConvite}</p>
            <a href="/login" className="mt-4 text-sm text-vertice-mint hover:underline">
              Ir para o login
            </a>
          </div>
        ) : (
          <ConviteForm
            token={token}
            email={convite.email}
            organizacaoNome={convite.organizacoes?.nome ?? ''}
            erro={searchParams?.message}
          />
        )}
      </div>
    </div>
  )
}
