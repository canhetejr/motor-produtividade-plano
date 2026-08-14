import { NextResponse } from 'next/server'

import { getProfile } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { gerarIcs, type EventoPrazo } from '@/lib/ics'
import { urlPublica } from '@/lib/base-url'

// Prazos mudam o tempo todo; um feed cacheado mostraria data errada.
export const dynamic = 'force-dynamic'

const BASE = urlPublica()

/**
 * Feed iCalendar com os prazos dos cards de quem está autenticado.
 *
 * Autenticado por sessão, e não por token de URL: um feed de calendário fica
 * gravado no cliente para sempre, e um link com segredo embutido acabaria
 * vazando em compartilhamento de tela ou sincronização de conta. O custo é que
 * a assinatura só funciona em cliente que mande o cookie — para uso interno,
 * troca aceitável.
 */
export async function GET() {
  const session = await getProfile()
  if (!session) return new NextResponse('Unauthorized', { status: 401 })

  const supabase = await createClient()

  // A RLS já restringe aos quadros de que a pessoa é membro; o filtro por
  // responsável é sobre isso, para o feed trazer só o que é dela.
  const { data, error } = await supabase
    .from('cartoes')
    .select('id, codigo, titulo, prazo, colunas!inner(nome, quadro_id, quadros!inner(nome)), cartoes_responsaveis!inner(colaborador_id)')
    .not('prazo', 'is', null)
    .eq('cartoes_responsaveis.colaborador_id', session.user.id)
    .order('prazo', { ascending: true })
    .limit(500)

  if (error) {
    console.error('Falha ao montar o feed de calendário: code=%s message=%s', error.code, error.message)
    return new NextResponse('Erro ao gerar calendário', { status: 500 })
  }

  const eventos: EventoPrazo[] = (data ?? []).map((c) => {
    // O embed do PostgREST vem como objeto quando é !inner de um-para-um, mas o
    // tipo gerado o descreve como array — normalizar aqui evita `any`.
    const coluna = Array.isArray(c.colunas) ? c.colunas[0] : c.colunas
    const quadro = Array.isArray(coluna?.quadros) ? coluna.quadros[0] : coluna?.quadros
    return {
      id: c.id,
      codigo: c.codigo ?? '',
      titulo: c.titulo,
      prazo: c.prazo as string,
      quadro: quadro?.nome ?? '',
      coluna: coluna?.nome ?? '',
      url: `${BASE}/kanban/${coluna?.quadro_id}?cartao=${c.id}`,
    }
  })

  return new NextResponse(gerarIcs(eventos), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="vertice-prazos.ics"',
      'Cache-Control': 'no-store',
    },
  })
}
