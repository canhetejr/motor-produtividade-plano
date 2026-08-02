import { requireUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { agruparPorFaixa } from '@/lib/semana'
import { SemanaLista } from './semana-lista'

export const dynamic = 'force-dynamic'

/**
 * Agenda pessoal por prazo, atravessando quadros.
 *
 * O Kanban mostra um quadro por vez; quem participa de vários não tem onde ver
 * "o que é meu e quando vence". Esta rota responde só isso.
 */
export default async function MinhaSemanaPage() {
  const { user } = await requireUser()
  const supabase = await createClient()

  // Um único nível: tudo depende só do id do usuário, que já veio do cookie.
  // A RLS restringe aos quadros de que a pessoa é membro; o filtro por
  // responsável é sobre isso.
  const { data, error } = await supabase
    .from('cartoes')
    .select(
      'id, codigo, titulo, prazo, prioridade, colunas!inner(nome, quadro_id, etapa_final, quadros!inner(nome)), cartoes_responsaveis!inner(colaborador_id)'
    )
    .not('prazo', 'is', null)
    .eq('cartoes_responsaveis.colaborador_id', user.id)
    .order('prazo', { ascending: true })
    .limit(200)

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
    <div className="min-w-0 overflow-x-hidden p-4 md:p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Minha semana</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Seus cards com prazo, de todos os quadros.
        </p>
      </header>

      <SemanaLista faixas={faixas} total={pendentes.length} />
    </div>
  )
}
