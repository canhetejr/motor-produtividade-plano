import { NextResponse, type NextRequest } from 'next/server'
import { getProfile } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { montarCsvDemandas, type DemandaExportavel } from '@/lib/csv-demandas'
import { hoje } from '@/lib/dates'

// Rota própria, e não `?recurso=demandas` no export existente: o de
// apontamentos já resolve quatro formatos (csv/xlsx/pdf/json) com filtro de
// período e área, e o shape de colunas daqui não tem nada em comum com o de
// lá. Somar um condicional àquele arquivo aumentaria a complexidade de algo
// que já é o mais ramificado do diretório.

// Teto defensivo. O catálogo é de dezenas a poucas centenas de linhas por
// organização — não é histórico transacional, e não se espera chegar perto
// disso. O limite existe para o dia em que uma importação em massa mal feita
// criar dez mil linhas e alguém clicar em exportar.
const TETO_LINHAS = 5000

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  const session = await getProfile()
  if (!session) return new NextResponse('Unauthorized', { status: 401 })
  // Mesmo critério do export de apontamentos: o catálogo é tela
  // administrativa, colaborador não chega nele.
  if (session.profile.role !== 'gestor') return new NextResponse('Forbidden', { status: 403 })

  const supabase = await createClient()

  // Os mesmos filtros da tela. Antes a rota devolvia o catálogo inteiro
  // sempre, e a tela de demandas nunca mostra o catálogo inteiro — ela é
  // sempre de uma área. Baixar 400 linhas para conferir as 12 que estavam na
  // frente é o tipo de coisa que faz a pessoa desistir do arquivo e editar na
  // mão. Parâmetro inválido é ignorado, não vira erro: isto é um download,
  // e devolver 400 para um link só produz uma aba em branco.
  const { searchParams } = new URL(request.url)
  const area = searchParams.get('area')
  const status = searchParams.get('status')
  const classificacao = searchParams.get('classificacao')
  const busca = (searchParams.get('busca') ?? '').trim()

  let query = supabase
    .from('demandas')
    .select('nome, tempo_padrao_min, variavel, blocos_totais, finita, ativo, areas (nome)')
    .order('nome')
    .limit(TETO_LINHAS)

  // Sem filtro de organizacao_id explícito: é o client de sessão, não o de
  // service role, então a política restritiva do eixo já amarra a leitura a
  // org_atual(). O join com areas passa pela política de areas do mesmo jeito.
  if (area && UUID_RE.test(area)) query = query.eq('area_id', area)
  if (status === 'ativo') query = query.eq('ativo', true)
  if (status === 'inativo') query = query.eq('ativo', false)
  if (classificacao === 'fixo') query = query.eq('variavel', false)
  if (classificacao === 'variavel') query = query.eq('variavel', true)
  // `%` e `_` são curingas do LIKE; escapá-los faz a busca por texto se
  // comportar como a da tela, que compara substring literal.
  if (busca) query = query.ilike('nome', `%${busca.replace(/[\\%_]/g, '\\$&')}%`)

  const { data, error } = await query

  if (error) {
    console.error('Erro ao exportar demandas: code=%s message=%s', error.code, error.message)
    return new NextResponse('Falha ao gerar o arquivo', { status: 500 })
  }

  const demandas: DemandaExportavel[] = (data ?? []).map((d) => ({
    nome: d.nome,
    areaNome: (d.areas as { nome?: string } | null)?.nome ?? null,
    tempo_padrao_min: d.tempo_padrao_min,
    variavel: d.variavel,
    blocos_totais: d.blocos_totais,
    finita: d.finita,
    ativo: d.ativo,
  }))

  return new NextResponse(montarCsvDemandas(demandas), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="demandas-${hoje()}.csv"`,
    },
  })
}
