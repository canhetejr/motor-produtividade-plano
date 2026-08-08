import { requireUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { agruparPorFaixa } from '@/lib/semana'
import { SemanaLista } from './semana-lista'
import { GestorDemandas, type DemandaCatalogoSemana, type QuadroSemana } from './gestor-demandas'
import { CalendarDays } from 'lucide-react'
import { PageHeader, PageShell } from '@/components/layout/page-shell'

export const dynamic = 'force-dynamic'

/**
 * Agenda pessoal por prazo, atravessando quadros.
 *
 * O Kanban mostra um quadro por vez; quem participa de vários não tem onde ver
 * "o que é meu e quando vence". Esta rota responde só isso.
 */
export default async function MinhaSemanaPage() {
  const { user, profile } = await requireUser()
  const supabase = await createClient()

  // Um único nível: tudo depende só do id do usuário, que já veio do cookie.
  // A RLS restringe aos quadros de que a pessoa é membro; o filtro por
  // responsável é sobre isso.
  const cartoesPromise = supabase
    .from('cartoes')
    .select(
      'id, codigo, titulo, prazo, prioridade, colunas!inner(nome, quadro_id, etapa_final, quadros!inner(nome)), cartoes_responsaveis!inner(colaborador_id)'
    )
    .not('prazo', 'is', null)
    .eq('cartoes_responsaveis.colaborador_id', user.id)
    .order('prazo', { ascending: true })
    .limit(200)

  const quadrosPromise = profile.role === 'gestor'
    ? supabase
        .from('quadros')
        .select('id, nome, colunas(id, nome, posicao, etapa_final), quadros_membros(colaborador_id, colaboradores(nome, area_id, ativo))')
        .eq('ativo', true)
        .order('nome')
    : Promise.resolve({ data: null, error: null })

  // Filtro direto por organizacao_id: sem ele, o client de service role
  // traria para este processo os ids de conexão de todas as organizações.
  const conexoesPromise = profile.role === 'gestor'
    ? import('@/utils/supabase/admin')
        .then(({ createAdminClient }) =>
          createAdminClient()
            .from('google_workspace_conexoes')
            .select('colaborador_id')
            .eq('organizacao_id', profile.organizacao_id)
        )
        .then(({ data: conexoes }) => new Set((conexoes ?? []).map((conexao) => conexao.colaborador_id)))
        .catch(() => new Set<string>())
    : Promise.resolve(new Set<string>())

  const demandasPromise = profile.role === 'gestor'
    ? supabase.from('demandas').select('id, nome, area_id').eq('ativo', true).order('nome')
    : Promise.resolve({ data: null, error: null })

  const [{ data, error }, { data: quadros, error: quadrosError }, googleIds, { data: demandasCatalogo, error: demandasError }] = await Promise.all([
    cartoesPromise,
    quadrosPromise,
    conexoesPromise,
    demandasPromise,
  ])

  let quadrosGestor: QuadroSemana[] = []
  let demandasGestor: DemandaCatalogoSemana[] = []
  if (profile.role === 'gestor') {
    if (quadrosError) {
      console.error('Falha ao carregar quadros para Minha semana: code=%s message=%s', quadrosError.code, quadrosError.message)
    } else {
      quadrosGestor = (quadros ?? []).map((quadro) => ({
        id: quadro.id,
        nome: quadro.nome,
        colunas: ((quadro.colunas as unknown as Array<{ id: string; nome: string; posicao: number; etapa_final: boolean }>) ?? [])
          .sort((a, b) => a.posicao - b.posicao)
          .map((coluna) => ({ id: coluna.id, nome: coluna.nome, posicao: coluna.posicao, etapaFinal: coluna.etapa_final })),
        membros: ((quadro.quadros_membros as unknown as Array<{ colaborador_id: string; colaboradores: { nome: string; area_id: string | null; ativo: boolean } | null }>) ?? [])
          .filter((membro) => membro.colaboradores?.ativo)
          .map((membro) => ({
            id: membro.colaborador_id,
            nome: membro.colaboradores?.nome ?? '—',
            areaId: membro.colaboradores?.area_id ?? null,
            googleConectado: googleIds.has(membro.colaborador_id),
          }))
          .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      })).filter((quadro) => quadro.colunas.length > 0)
    }
    if (demandasError) {
      console.error('Falha ao carregar catálogo para Minha semana: code=%s message=%s', demandasError.code, demandasError.message)
    } else {
      demandasGestor = (demandasCatalogo ?? []).map((demanda) => ({
        id: demanda.id,
        nome: demanda.nome,
        areaId: demanda.area_id,
      }))
    }
  }

  if (error) {
    console.error('Falha ao carregar Minha semana: code=%s message=%s', error.code, error.message)
  }

  const cartoes = (data ?? []).map((c) => {
    // Embed !inner de um-para-um chega como objeto, mas o tipo gerado descreve
    // como array — normalizar aqui evita `any` espalhado.
    const coluna = Array.isArray(c.colunas) ? c.colunas[0] : c.colunas
    const quadro = Array.isArray(coluna?.quadros) ? coluna.quadros[0] : coluna?.quadros
    return {
      id: c.id,
      codigo: c.codigo ?? '',
      titulo: c.titulo,
      prazo: c.prazo as string,
      prioridade: c.prioridade,
      etapa: coluna?.nome ?? '',
      etapaFinal: Boolean(coluna?.etapa_final),
      quadroId: coluna?.quadro_id ?? '',
      quadroNome: quadro?.nome ?? '',
    }
  })

  // Card em etapa final já foi entregue; mantê-lo aqui transformaria a lista
  // num histórico, e a pergunta que ela responde é sobre o que ainda falta.
  const pendentes = cartoes.filter((c) => !c.etapaFinal)
  const faixas = agruparPorFaixa(pendentes)

  return (
    <PageShell>
      <PageHeader
        title="Minha semana"
        description="Seus cards com prazo, reunidos de todos os quadros."
        icon={CalendarDays}
        actions={profile.role === 'gestor' ? <GestorDemandas quadros={quadrosGestor} demandas={demandasGestor} /> : undefined}
      />

      <SemanaLista faixas={faixas} total={pendentes.length} />
    </PageShell>
  )
}
