import { redirect } from 'next/navigation'
import { comSearchParams, type SearchParams } from '@/lib/preservar-search-params'

export const dynamic = 'force-dynamic'

/**
 * O lançamento diário mudou de casa: agora ele é o topo de /minha-semana, que
 * passou a ser o hub do dia a dia.
 *
 * Esta rota continua existindo porque muita coisa aponta para ela e não dá
 * para reescrever: e-mails de lembrete já enviados, o start_url do PWA já
 * instalado no celular de quem usa, favoritos do navegador. Um 404 aqui
 * quebraria o link do cron de lembrete diário para todo mundo que tem o app
 * instalado.
 *
 * `comSearchParams` preserva a query — `?modo=lote` é o caso real, e
 * /minha-semana lê o mesmo nome de parâmetro justamente para não precisar de
 * uma tabela de tradução entre as duas rotas.
 */
export default async function ApontamentoPage(props: { searchParams: Promise<SearchParams> }) {
  const searchParams = await props.searchParams
  redirect(comSearchParams('/minha-semana', searchParams))
}
