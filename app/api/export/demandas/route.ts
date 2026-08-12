import { NextResponse } from 'next/server'
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

export async function GET() {
  const session = await getProfile()
  if (!session) return new NextResponse('Unauthorized', { status: 401 })
  // Mesmo critério do export de apontamentos: o catálogo é tela
  // administrativa, colaborador não chega nele.
  if (session.profile.role !== 'gestor') return new NextResponse('Forbidden', { status: 403 })

  const supabase = await createClient()

  // Sem filtro de organizacao_id explícito: é o client de sessão, não o de
  // service role, então a política restritiva do eixo já amarra a leitura a
  // org_atual(). O join com areas passa pela política de areas do mesmo jeito.
  const { data, error } = await supabase
    .from('demandas')
    .select('nome, tempo_padrao_min, variavel, blocos_totais, finita, ativo, areas (nome)')
    .order('nome')
    .limit(TETO_LINHAS)

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
