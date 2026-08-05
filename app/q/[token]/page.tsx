import type { Metadata } from 'next'

import { createAdminClient } from '@/utils/supabase/admin'
import { verificarLink, tokenBemFormado, paraPublico, type CartaoPublico } from '@/lib/compartilhamento'
import { VerticeSymbol } from '@/components/vertice-symbol'

export const dynamic = 'force-dynamic'

// Link de acompanhamento nao pertence a busca de ninguem. `noindex` nao e
// seguranca — o token e —, mas evita que um link colado num lugar publico acabe
// indexado.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

const RECUSA: Record<string, string> = {
  inexistente: 'Este link não existe.',
  revogado: 'Este link foi revogado por quem o criou.',
  expirado: 'Este link expirou.',
}

/**
 * Acompanhamento público de um quadro.
 *
 * Roda com cliente de serviço, que enxerga o banco inteiro — por isso a leitura
 * é deliberadamente estreita e o que sai passa por `paraPublico`, que é lista de
 * permissão. Nada aqui depende de RLS para anônimo: a tabela de
 * compartilhamentos não tem grant para `anon`, então este é o único caminho.
 */
export default async function QuadroPublicoPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params

  // Forma errada nem chega ao banco.
  if (!tokenBemFormado(token)) return <Recusa mensagem={RECUSA.inexistente} />

  const admin = createAdminClient()

  const { data: link } = await admin
    .from('quadros_compartilhamentos')
    .select('quadro_id, ativo, expira_em')
    .eq('token', token)
    .maybeSingle()

  const verificacao = verificarLink(
    link ? { quadroId: link.quadro_id, ativo: link.ativo, expiraEm: link.expira_em } : null,
    new Date()
  )
  if (!verificacao.valido) return <Recusa mensagem={RECUSA[verificacao.motivo]} />

  const [{ data: quadro }, { data: colunas }] = await Promise.all([
    admin.from('quadros').select('nome, codigo').eq('id', verificacao.quadroId).single(),
    admin
      .from('colunas')
      .select('id, nome, posicao')
      .eq('quadro_id', verificacao.quadroId)
      .order('posicao'),
  ])

  const colunaIds = (colunas ?? []).map((c) => c.id)
  const { data: cartoes } = colunaIds.length
    ? await admin
        // Select explícito e curto: `select('*')` aqui despejaria toda coluna
        // futura de `cartoes` numa página pública.
        .from('cartoes')
        .select('codigo, titulo, prazo, entregue_em, coluna_id, posicao')
        .in('coluna_id', colunaIds)
        .order('posicao')
    : { data: [] }

  const nomePorColuna = new Map((colunas ?? []).map((c) => [c.id, c.nome]))
  const porColuna = new Map<string, CartaoPublico[]>()
  for (const c of cartoes ?? []) {
    const nome = nomePorColuna.get(c.coluna_id) ?? ''
    const lista = porColuna.get(c.coluna_id)
    const publico = paraPublico(c, nome)
    if (lista) lista.push(publico)
    else porColuna.set(c.coluna_id, [publico])
  }

  // Registrar o acesso ajuda quem compartilhou a saber se o link está em uso —
  // e a decidir revogar. Best-effort: falhar aqui não pode derrubar a página.
  await admin
    .from('quadros_compartilhamentos')
    .update({ ultimo_acesso_em: new Date().toISOString() })
    .eq('token', token)

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center gap-3 p-4 md:p-6">
          <VerticeSymbol className="h-7 w-7 shrink-0" />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">{quadro?.nome ?? 'Quadro'}</h1>
            <p className="text-xs text-muted-foreground">Acompanhamento · somente leitura</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-4 md:p-6">
        <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar">
          {(colunas ?? []).map((coluna) => {
            const lista = porColuna.get(coluna.id) ?? []
            return (
              <section
                key={coluna.id}
                className="flex w-[85vw] max-w-[300px] shrink-0 flex-col rounded-md border border-border bg-muted/30 sm:w-[300px]"
              >
                <h2 className="border-b border-border p-3 text-xs font-bold uppercase tracking-wide text-foreground/80">
                  {coluna.nome}{' '}
                  <span className="font-normal normal-case text-muted-foreground">
                    ({lista.length})
                  </span>
                </h2>
                <ul className="flex flex-col gap-2 p-2">
                  {lista.map((c) => (
                    <li
                      key={`${c.codigo}-${c.titulo}`}
                      className="rounded-md border border-border bg-card p-3"
                    >
                      {c.codigo && (
                        <p className="font-mono text-3xs text-muted-foreground">{c.codigo}</p>
                      )}
                      <p className="mt-0.5 text-sm leading-snug font-semibold">{c.titulo}</p>
                      {(c.prazo || c.entregue) && (
                        <p className="mt-1.5 flex items-center gap-2 text-3xs text-muted-foreground">
                          {c.entregue && (
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              Entregue
                            </span>
                          )}
                          {c.prazo && (
                            <span>{new Date(`${c.prazo}T00:00:00`).toLocaleDateString('pt-BR')}</span>
                          )}
                        </p>
                      )}
                    </li>
                  ))}
                  {lista.length === 0 && (
                    <li className="px-1 py-4 text-center text-xs italic text-muted-foreground">
                      Nada aqui.
                    </li>
                  )}
                </ul>
              </section>
            )
          })}
        </div>
      </main>
    </div>
  )
}

function Recusa({ mensagem }: { mensagem: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="max-w-sm text-center">
        <VerticeSymbol className="mx-auto h-10 w-10" />
        <p className="mt-4 text-sm font-medium">{mensagem}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Peça um novo link a quem compartilhou o quadro com você.
        </p>
      </div>
    </div>
  )
}
