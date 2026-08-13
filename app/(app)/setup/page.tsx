import { requireUser } from '@/lib/auth'
import { emailGoogleConectado, integracaoGoogleConfigurada } from '@/lib/google-conexao'
import { SetupInicial } from './setup-inicial'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Primeiros passos — Vértice',
}

// Primeira tela de quem acabou de entrar: gestor e colaborador fazem o mesmo
// caminho, porque a conexão com o Google é por pessoa (cada um autoriza o
// próprio calendário e o próprio Drive). Fica dentro de app/(app) de propósito
// — precisa da sessão, da sidebar e do bloqueio de troca de senha que o layout
// autenticado já aplica.
export default async function SetupPage() {
  const { user, profile } = await requireUser()

  const googleEmail = await emailGoogleConectado(user.id, profile.organizacao_id)

  return (
    <SetupInicial
      nome={profile.nome}
      organizacaoNome={profile.organizacoes?.nome ?? 'sua empresa'}
      isGestor={profile.role === 'gestor'}
      googleEmail={googleEmail}
      googleDisponivel={integracaoGoogleConfigurada()}
      jaConcluido={Boolean(profile.setup_concluido_em)}
    />
  )
}
