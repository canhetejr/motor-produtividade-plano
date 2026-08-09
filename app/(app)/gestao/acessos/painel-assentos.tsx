/**
 * Assentos do plano: o número que decide se cabe mais alguém.
 *
 * Vivia só no console do operador — invisível justamente para o gestor, que
 * é quem esbarra no limite. Componente separado da página para poder ser
 * renderizado com valores injetados (verificação visual) sem duplicar o
 * markup da tela real.
 */
export function PainelAssentos({
  ocupados,
  limite,
  ativos,
  convitesPendentes,
}: {
  ocupados: number
  limite: number
  ativos: number
  convitesPendentes: number
}) {
  const livres = Math.max(0, limite - ocupados)
  const pctOcupado = limite > 0 ? Math.min(100, Math.round((ocupados / limite) * 100)) : 0

  return (
    <section className="rounded-md border border-border bg-card p-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">Assentos do plano</p>
          <p className="mt-1 font-mono text-3xl font-medium tabular-nums">
            {ocupados}
            <span className="text-lg text-muted-foreground"> / {limite}</span>
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          {ativos} pessoa{ativos === 1 ? '' : 's'} com acesso
          {convitesPendentes > 0 &&
            ` · ${convitesPendentes} convite${convitesPendentes === 1 ? '' : 's'} pendente${convitesPendentes === 1 ? '' : 's'}`}
          {' · '}
          {livres > 0 ? `${livres} livre${livres === 1 ? '' : 's'}` : 'nenhum livre'}
        </p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" role="presentation">
        <div
          className={`h-full rounded-full ${livres === 0 ? 'bg-danger' : pctOcupado >= 80 ? 'bg-warning' : 'bg-success'}`}
          style={{ width: `${pctOcupado}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Um assento é ocupado por pessoa ativa ou convite pendente. Desativar alguém libera o assento e preserva todo o
        histórico — ninguém precisa apagar dado para caber no plano.
      </p>
    </section>
  )
}
