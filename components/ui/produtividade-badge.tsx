import { cn } from '@/lib/utils'
import { faixaDe, formatarProdutividade, ROTULO_FAIXA, type Faixa } from '@/lib/produtividade'

/**
 * Cor por faixa de produtividade.
 *
 * Sai da escala semântica de `globals.css`, não de `emerald-*`/`amber-*`
 * crus: os tokens `--x-texto` têm contraste medido (>= 4.5:1) nos DOIS temas,
 * e o par `emerald-600 / emerald-400` que já esteve neste projeto dá 3,49:1
 * no claro — foi exatamente o problema que `painel-capacidade.tsx` corrigiu.
 *
 * São três matizes, e não quatro, de propósito. O `--primary` deste projeto é
 * o verde-limão Tera (#D7F75B): como TEXTO sobre papel ele fica ilegível, e
 * não existe uma quarta escala com contraste verificado. Em vez de inventar
 * um token novo sem poder medi-lo, "acima do esperado" e "no ritmo"
 * compartilham o mint e se separam pelo PESO — sólido contra tingido. São
 * dois estados bons; a diferença entre eles é de intensidade, não de
 * natureza, e a forma acompanha isso.
 */
export const CLASSE_FAIXA: Record<Faixa, { selo: string; texto: string; barra: string }> = {
  acima: {
    selo: 'bg-success text-success-foreground border-transparent',
    texto: 'text-success-texto',
    barra: 'bg-success',
  },
  no_ritmo: {
    selo: 'bg-success-superficie text-success-texto border-success-borda',
    texto: 'text-success-texto',
    barra: 'bg-success/60',
  },
  atencao: {
    selo: 'bg-warning-superficie text-warning-texto border-warning-borda',
    texto: 'text-warning-texto',
    barra: 'bg-warning',
  },
  abaixo: {
    selo: 'bg-danger-superficie text-danger-texto border-danger-borda',
    texto: 'text-danger-texto',
    barra: 'bg-danger',
  },
  sem_medicao: {
    selo: 'bg-muted text-muted-foreground border-border',
    texto: 'text-muted-foreground',
    barra: 'bg-muted-foreground/30',
  },
}

/**
 * A porcentagem com a cor da faixa.
 *
 * `title` com o rótulo por extenso porque cor sozinha não é informação
 * acessível — quem não distingue as matizes precisa do texto, e o número
 * sozinho ("87%") não diz se é bom ou ruim sem a régua.
 */
export function ProdutividadeBadge({
  produtividade,
  className,
}: {
  produtividade: number | null
  className?: string
}) {
  const faixa = faixaDe(produtividade)
  return (
    <span
      title={ROTULO_FAIXA[faixa]}
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-xs font-semibold tabular-nums',
        CLASSE_FAIXA[faixa].selo,
        className
      )}
    >
      {formatarProdutividade(produtividade)}
    </span>
  )
}
