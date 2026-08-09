import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { cronAuthorized, tentarReservarExecucaoGlobal } from '@/lib/cron'

export const dynamic = 'force-dynamic'

// Cron diário (0 5 * * *, 2h em Maringá): move trial vencido → expirada.
//
// É o único cron que age sobre a plataforma, não sobre organizações uma a uma
// — por isso usa a trava global de idempotência, e não paraCadaOrganizacao().
//
// A transição inteira mora em transicionar_organizacoes() (migration
// 20260809170000), security definer: a regra de qual estado sucede qual é do
// banco, junto com a constraint organizacoes_trial_coerente que a valida.
// Duplicar esse critério aqui em TypeScript criaria duas fontes de verdade
// que divergem no primeiro ajuste.
//
// O que este cron NÃO faz: apagar. Organização em 'excluindo' fica marcada e
// espera ação manual e explícita do operador no console — delete em cascata
// por 43 tabelas disparado por relógio é irreversível, e uma data errada
// levaria o dado de um cliente junto (PLANO-PRODUTO.md, risco 5).
export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const hoje = new Date().toISOString().slice(0, 10)

  if (!(await tentarReservarExecucaoGlobal(admin, 'organizacoes-ciclo', hoje))) {
    return NextResponse.json({ ok: true, hoje, skipped: 'já executado' })
  }

  const { data, error } = await admin.rpc('transicionar_organizacoes')

  if (error) {
    console.error('organizacoes-ciclo: falha ao transicionar organizações:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  const transicionadas = data ?? []
  if (transicionadas.length > 0) {
    // Vai para o log do servidor de propósito: é uma conta que perdeu acesso
    // sem ninguém ter clicado em nada, e o operador precisa conseguir
    // reconstruir depois por que aconteceu.
    console.info('organizacoes-ciclo: %d organização(ões) expiradas: %j', transicionadas.length, transicionadas)
  }

  return NextResponse.json({ ok: true, hoje, expiradas: transicionadas.length })
}
