import { KeyRound } from 'lucide-react'

import { requireGestor, isAdmin } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { throwIfError } from '@/lib/supabase-error'
import { PageHeader, PageShell } from '@/components/layout/page-shell'
import { EstadoBadge, type EstadoBadgeEstado } from '@/components/ui/estado-badge'
import { ColaboradoresManager } from '../../colaboradores/colaboradores-manager'
import { ConvitesManager, type ConvitePendente } from './convites-manager'
import { PainelAssentos } from './painel-assentos'

export const dynamic = 'force-dynamic'

const STATUS_ORG: Record<string, { estado: EstadoBadgeEstado; rotulo: string }> = {
  trialing: { estado: 'atencao', rotulo: 'Em teste' },
  ativa: { estado: 'sucesso', rotulo: 'Ativa' },
  suspensa: { estado: 'erro', rotulo: 'Suspensa' },
  expirada: { estado: 'erro', rotulo: 'Expirada' },
  excluindo: { estado: 'erro', rotulo: 'Em exclusão' },
}

function diasAte(iso: string | null): number | null {
  if (!iso) return null
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

/**
 * Equipe e acessos — a tela onde a gestão de gente da empresa acontece
 * inteira: quantos assentos o plano dá, quem já ocupa, quem foi convidado e
 * ainda não entrou, e a equipe em si.
 *
 * Antes disto a informação estava partida: contas nasciam em
 * /gestao/catalogo, assentos só existiam no console do operador (fora do
 * alcance de quem esbarra no limite) e convite não tinha tela nenhuma.
 */
export default async function AcessosPage() {
  const { profile } = await requireGestor()
  const admin = await isAdmin()
  const supabase = await createClient()

  const [
    { data: areas, error: areasError },
    { data: colaboradores, error: colaboradoresError },
    { data: convites, error: convitesError },
    { data: assentosOcupados, error: assentosError },
    { data: vinculosAreas },
  ] = await Promise.all([
    supabase.from('areas').select('id, nome, ativo').order('nome'),
    supabase.from('colaboradores').select('*').order('nome'),
    supabase
      .from('convites')
      .select('id, email, role, expira_em, areas(nome)')
      .is('aceito_em', null)
      .is('revogado_em', null)
      .gt('expira_em', new Date().toISOString())
      .order('criado_em', { ascending: false }),
    supabase.rpc('assentos_ocupados', { p_org: profile.organizacao_id }),
    // Áreas adicionais de cada pessoa. Sem `error` desestruturado: a tabela é
    // nova e a tela de equipe não pode cair se a migration ainda não rodou.
    supabase.from('colaboradores_areas').select('colaborador_id, area_id'),
  ])
  throwIfError(areasError, colaboradoresError, convitesError, assentosError)

  // A área principal fica de fora do mapa: no formulário ela é o select
  // acima, e repeti-la marcada nas caixas sugeriria que dá para desmarcar.
  const areasExtrasPorColaborador: Record<string, string[]> = {}
  const principalPorId = new Map((colaboradores ?? []).map((c) => [c.id, c.area_id]))
  for (const v of vinculosAreas ?? []) {
    if (v.area_id === principalPorId.get(v.colaborador_id)) continue
    ;(areasExtrasPorColaborador[v.colaborador_id] ??= []).push(v.area_id)
  }

  const limite = profile.organizacoes?.limite_assentos ?? 0
  const ocupados = assentosOcupados ?? 0
  const livres = Math.max(0, limite - ocupados)

  const status = profile.organizacoes?.status ?? 'ativa'
  const estadoOrg = STATUS_ORG[status] ?? { estado: 'neutro' as const, rotulo: status }
  const diasTrial = status === 'trialing' ? diasAte(profile.organizacoes?.trial_expira_em ?? null) : null

  const convitesPendentes: ConvitePendente[] = (convites ?? []).map((c) => ({
    id: c.id,
    email: c.email,
    role: c.role,
    areaNome: c.areas?.nome ?? null,
    expiraEm: c.expira_em,
    diasRestantes: diasAte(c.expira_em) ?? 0,
  }))

  const ativos = (colaboradores ?? []).filter((c) => c.ativo).length

  return (
    <PageShell contentClassName="space-y-6">
      <PageHeader
        title="Equipe e acessos"
        description="Assentos do plano, convites e quem tem acesso ao Vértice na sua empresa."
        icon={KeyRound}
        level={2}
        className="mb-0"
        actions={
          <div className="flex items-center gap-2">
            <EstadoBadge estado={estadoOrg.estado}>{estadoOrg.rotulo}</EstadoBadge>
            {diasTrial !== null && (
              <span className="text-xs text-muted-foreground">
                {diasTrial > 0 ? `${diasTrial} dia${diasTrial === 1 ? '' : 's'} de teste restante${diasTrial === 1 ? '' : 's'}` : 'teste encerrado'}
              </span>
            )}
          </div>
        }
      />

      <PainelAssentos
        ocupados={ocupados}
        limite={limite}
        ativos={ativos}
        convitesPendentes={convitesPendentes.length}
      />

      <ConvitesManager
        convites={convitesPendentes}
        areas={(areas ?? []).filter((a) => a.ativo)}
        isAdmin={admin}
        semAssentoLivre={livres === 0}
      />

      <section>
        <h2 className="mb-3 text-base font-semibold">Pessoas com acesso</h2>
        <ColaboradoresManager
          areas={areas ?? []}
          colaboradores={colaboradores ?? []}
          isAdmin={admin}
          areasExtrasPorColaborador={areasExtrasPorColaborador}
        />
      </section>
    </PageShell>
  )
}
