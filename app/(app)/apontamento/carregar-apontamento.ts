import 'server-only'
import { format, subDays } from 'date-fns'
import { createClient } from '@/utils/supabase/server'
import { hoje } from '@/lib/dates'

// Dados do painel de lançamento diário, extraídos da página para o painel
// poder ser montado dentro de /minha-semana sem duplicar a consulta.
//
// Continua sendo uma leitura só do próprio usuário: a política do eixo amarra
// tudo a org_atual(), e o filtro por colaborador_id vem da sessão.

export type DemandaApontavel = {
  id: string
  nome: string
  variavel: boolean
  tempo_padrao_min: number | null
  blocos_totais: number
  finita: boolean
  blocos_restantes: number | null
}

export type DadosApontamento = {
  demandas: DemandaApontavel[]
  apontamentosDia: { id: string; quantidade: number; tempo_total_min: number; demanda_nome: string }[]
  indicadores: { data: string; indice: number }[]
  tempoEntregueHoje: number
  dataSelecionada: string
  hojeIso: string
}

export async function carregarApontamento(
  perfil: { id: string; area_id: string | null },
  dataSelecionada?: string
): Promise<DadosApontamento> {
  const supabase = await createClient()
  const hojeIso = hoje()
  const selectedDate = dataSelecionada || hojeIso

  const [demandasRes, apontamentosRes, indicadoresRes, areasRes] = await Promise.all([
    // Sem filtro de área na consulta: quais áreas a pessoa alcança vem da RPC
    // ao lado, e esperar por ela para só então buscar demandas criaria um
    // waterfall. O catálogo de uma organização é pequeno o bastante para o
    // recorte acontecer em memória logo abaixo.
    supabase
      .from('demandas')
      .select('id, nome, area_id, variavel, tempo_padrao_min, blocos_totais, finita')
      .eq('ativo', true)
      .or('variavel.eq.true,tempo_padrao_min.not.is.null')
      .order('nome'),

    supabase
      .from('apontamentos_calculado')
      .select('id, quantidade, tempo_total_min, demandas(nome)')
      .eq('colaborador_id', perfil.id)
      .eq('data', selectedDate),

    supabase
      .from('indicadores_diarios')
      .select('data, indice')
      .eq('colaborador_id', perfil.id)
      .gte('data', format(subDays(new Date(), 180), 'yyyy-MM-dd'))
      .lte('data', hojeIso)
      .order('data', { ascending: true }),

    supabase.rpc('areas_do_colaborador', { p_colaborador_id: perfil.id }),
  ])

  // A área principal entra mesmo se a RPC falhar (migration ainda não
  // aplicada, por exemplo): a alternativa seria a pessoa abrir a tela sem
  // demanda nenhuma, que é pior que ver só as da área principal.
  const areasPermitidas = new Set<string>(
    (areasRes.data as string[] | null) ?? (perfil.area_id ? [perfil.area_id] : [])
  )
  if (perfil.area_id) areasPermitidas.add(perfil.area_id)

  const demandasBrutas = (demandasRes.data ?? []).filter((d) => areasPermitidas.has(d.area_id))

  const idsFinitas = demandasBrutas.filter((d) => d.finita).map((d) => d.id)
  const acumuladoPorDemanda = new Map<string, number>()
  if (idsFinitas.length > 0) {
    const { data: acumulados } = await supabase
      .from('demandas_acumulado')
      .select('demanda_id, acumulado')
      .in('demanda_id', idsFinitas)
    for (const a of acumulados ?? []) {
      if (a.demanda_id) acumuladoPorDemanda.set(a.demanda_id, a.acumulado ?? 0)
    }
  }

  // Demanda finita já esgotada some do formulário: deixá-la na lista só produz
  // um erro do banco depois de a pessoa preencher tudo.
  const demandas = demandasBrutas
    .map((d) => ({
      ...d,
      blocos_restantes: d.finita ? d.blocos_totais - (acumuladoPorDemanda.get(d.id) ?? 0) : null,
    }))
    .filter((d) => d.blocos_restantes === null || d.blocos_restantes > 0)

  const apontamentosDia = (apontamentosRes.data ?? []).map((a) => ({
    id: a.id ?? '',
    quantidade: a.quantidade ?? 0,
    tempo_total_min: a.tempo_total_min ?? 0,
    demanda_nome: a.demandas?.nome ?? 'Desconhecida',
  }))

  const indicadores = (indicadoresRes.data ?? [])
    .filter((d): d is typeof d & { data: string } => d.data !== null)
    .map((d) => ({ data: d.data, indice: d.indice ?? 0 }))

  return {
    demandas,
    apontamentosDia,
    indicadores,
    // Só faz sentido para hoje: a carga do dia é comparada com o que já foi
    // entregue hoje, não com o que foi entregue numa data que se está olhando.
    tempoEntregueHoje:
      selectedDate === hojeIso ? apontamentosDia.reduce((soma, a) => soma + a.tempo_total_min, 0) : 0,
    dataSelecionada: selectedDate,
    hojeIso,
  }
}
