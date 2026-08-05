import { resumirCapacidade, ROTULO_SITUACAO, type CargaColaborador, type Situacao } from '@/lib/capacidade'
import { cn } from '@/lib/utils'

/**
 * Cada situação usa a escala semântica, não cor crua.
 *
 * `texto` sai de `--x-texto`, calibrado para >= 4.5:1 em ambos os temas — o par
 * `emerald-600 / emerald-400` que estava aqui dá 3,49:1 no claro, abaixo do
 * mínimo. `barra` sai do sólido, onde saturação importa mais que contraste.
 */
const CLASSE: Record<Situacao, { texto: string; barra: string }> = {
  sobrecarregado: { texto: 'text-danger-texto', barra: 'bg-danger' },
  no_limite: { texto: 'text-warning-texto', barra: 'bg-warning' },
  // Equilibrado é o estado bom: leva o mint, que é a cor de energia da marca.
  equilibrado: { texto: 'text-success-texto', barra: 'bg-success' },
  ocioso: { texto: 'text-muted-foreground', barra: 'bg-muted-foreground/60' },
  sem_carga: { texto: 'text-muted-foreground', barra: 'bg-muted-foreground/30' },
}

/**
 * Quem está acima da conta e quem está com folga, agora.
 *
 * O índice médio achata as duas pontas num número só, e elas pedem ação oposta
 * do gestor: uma é redistribuir, a outra é atribuir.
 */
export function PainelCapacidade({ cargas }: { cargas: CargaColaborador[] }) {
  const resumo = resumirCapacidade(cargas)
  if (resumo.length === 0) return null

  return (
    <section className="rounded-md border border-border bg-card p-4">
      <h2 className="text-sm font-bold">Capacidade da equipe</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Entregue sobre a meta de cada um no período. Sem meta definida, o alvo é
        100% da jornada.
      </p>

      <div className="mt-4 flex flex-col gap-4">
        {resumo.map(({ situacao, pessoas }) => (
          <div key={situacao}>
            <h3 className={cn('mb-1.5 text-2xs font-bold uppercase tracking-wide', CLASSE[situacao].texto)}>
              {ROTULO_SITUACAO[situacao]} · {pessoas.length}
            </h3>
            <ul className="flex flex-col gap-1.5">
              {pessoas.map((p) => {
                const pct = Math.round(p.razao * 100)
                return (
                  <li key={p.colaborador_id} className="flex items-center gap-2.5">
                    <span className="min-w-0 flex-1 truncate text-sm">{p.nome}</span>
                    <div
                      className="hidden h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-muted sm:block"
                      role="presentation"
                    >
                      <div
                        className={cn('h-full rounded-full', CLASSE[situacao].barra)}
                        // Acima de 100% a barra satura: o excedente já está no
                        // número, e deixar a barra estourar quebra o alinhamento.
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                    <span
                      className={cn('w-12 shrink-0 text-right text-xs font-semibold tabular-nums', CLASSE[situacao].texto)}
                    >
                      {situacao === 'sem_carga' ? '—' : `${pct}%`}
                    </span>
                    {/* A porcentagem e sobre a META, nao sobre a jornada cheia.
                        Sem dizer qual meta, 93% e um numero sem referencia. */}
                    {p.meta !== undefined && p.meta !== 1 && (
                      <span className="hidden w-16 shrink-0 text-right text-3xs text-muted-foreground sm:block">
                        meta {Math.round(p.meta * 100)}%
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
