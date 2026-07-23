import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { throwIfError } from '@/lib/supabase-error'
import { KanbanBoard } from './kanban-board'

export const dynamic = 'force-dynamic'

export default async function QuadroPage({ params }: { params: Promise<{ quadroId: string }> }) {
  const { quadroId } = await params
  const { user } = await requireUser()
  const supabase = await createClient()

  // RLS (quadros_select_membro) já barra quem não é gestor nem membro — aqui
  // só distinguimos "não existe" de "existe mas RLS escondeu" pra decidir
  // entre notFound (ambos os casos, do ponto de vista do usuário, dão 404).
  const { data: quadro, error: quadroError } = await supabase.from('quadros').select('*').eq('id', quadroId).maybeSingle()
  throwIfError(quadroError)
  if (!quadro) notFound()

  const [
    { data: colunas, error: colunasError },
    { data: etiquetas, error: etiquetasError },
    { data: membros, error: membrosError },
    { data: formularios, error: formulariosError },
  ] = await Promise.all([
    supabase.from('colunas').select('*').eq('quadro_id', quadroId).order('posicao'),
    supabase.from('etiquetas').select('*').eq('quadro_id', quadroId).order('nome'),
    supabase.from('quadros_membros').select('colaborador_id, colaboradores(nome)').eq('quadro_id', quadroId),
    supabase.from('formularios').select('*, formularios_campos(*)').eq('quadro_id', quadroId).order('created_at'),
  ])
  throwIfError(colunasError, etiquetasError, membrosError, formulariosError)

  const colunaIds = (colunas ?? []).map((c) => c.id)
  const { data: cartoes, error: cartoesError } =
    colunaIds.length > 0
      ? await supabase
          .from('cartoes')
          .select('*, cartoes_responsaveis(colaborador_id), cartoes_etiquetas(etiqueta_id)')
          .in('coluna_id', colunaIds)
          .order('posicao')
      : { data: [], error: null }
  throwIfError(cartoesError)

  const membrosQuadro = (membros ?? []).map((m) => ({
    id: m.colaborador_id,
    nome: (m.colaboradores as { nome: string } | null)?.nome ?? '—',
  }))

  const cartoesFormatados = (cartoes ?? []).map((c) => ({
    id: c.id,
    coluna_id: c.coluna_id,
    titulo: c.titulo,
    descricao: c.descricao,
    posicao: c.posicao,
    prioridade: c.prioridade,
    prazo: c.prazo,
    codigo: c.codigo,
    responsaveis: (c.cartoes_responsaveis ?? []).map((r: { colaborador_id: string }) => r.colaborador_id),
    etiquetas: (c.cartoes_etiquetas ?? []).map((e: { etiqueta_id: string }) => e.etiqueta_id),
  }))

  const formulariosFormatados = (formularios ?? []).map((f) => ({
    id: f.id,
    coluna_id: f.coluna_id,
    titulo: f.titulo,
    descricao: f.descricao,
    slug: f.slug,
    ativo: f.ativo,
    cor_tema: f.cor_tema,
    mensagem_sucesso: f.mensagem_sucesso,
    mostrar_marca: f.mostrar_marca,
    campos: (f.formularios_campos ?? [])
      .slice()
      .sort((a, b) => a.posicao - b.posicao)
      .map((c) => ({
        id: c.id,
        rotulo: c.rotulo,
        tipo: c.tipo,
        placeholder: c.placeholder ?? '',
        obrigatorio: c.obrigatorio,
        opcoes: c.opcoes,
        mapeado_para: c.mapeado_para,
      })),
  }))

  return (
    <KanbanBoard
      quadro={quadro}
      colunasIniciais={colunas ?? []}
      cartoesIniciais={cartoesFormatados}
      etiquetasIniciais={etiquetas ?? []}
      membrosQuadro={membrosQuadro}
      formulariosIniciais={formulariosFormatados}
      currentUserId={user.id}
    />
  )
}
