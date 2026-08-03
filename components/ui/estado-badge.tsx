import { cva, type VariantProps } from 'class-variance-authority'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Selo de estado — sucesso, atenção, erro, neutro.
 *
 * Existe para encerrar um padrão medido nesta base: 134 usos de `emerald-*`,
 * `amber-*` e `rose-*` escritos à mão, cada um repetindo a mesma tríade de
 * texto, fundo e borda com valores levemente diferentes.
 *
 * A causa não era desleixo: o token `--success` é o mint, que como TEXTO sobre
 * papel dá 1,20:1 de contraste. Era inutilizável, então cada tela improvisou. A
 * escala semântica em globals.css resolve isso com papéis separados; este
 * componente é a porta por onde ela entra na interface.
 *
 * **O estado nunca é só cor.** Todas as variantes aceitam ícone, e o texto
 * carrega o significado — quem não distingue verde de âmbar continua lendo
 * "Atrasado".
 */
const estadoBadgeVariants = cva(
  'inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-2xs font-bold [&_svg]:size-3 [&_svg]:shrink-0',
  {
    variants: {
      estado: {
        sucesso: 'border-success-borda bg-success-superficie text-success-texto',
        atencao: 'border-warning-borda bg-warning-superficie text-warning-texto',
        erro: 'border-danger-borda bg-danger-superficie text-danger-texto',
        neutro: 'border-border bg-muted text-muted-foreground',
        // Marca: para seleção e conexão, onde o roxo é a cor estrutural.
        marca: 'border-primary/20 bg-primary/10 text-primary',
      },
      tamanho: {
        sm: 'text-3xs [&_svg]:size-2.5',
        md: '',
      },
    },
    defaultVariants: { estado: 'neutro', tamanho: 'md' },
  }
)

export function EstadoBadge({
  estado,
  tamanho,
  icone: Icone,
  children,
  className,
  ...props
}: React.ComponentProps<'span'> &
  VariantProps<typeof estadoBadgeVariants> & {
    /** Reforça o significado sem depender de cor. */
    icone?: LucideIcon
  }) {
  return (
    <span className={cn(estadoBadgeVariants({ estado, tamanho }), className)} {...props}>
      {Icone && <Icone aria-hidden />}
      {children}
    </span>
  )
}

export { estadoBadgeVariants }

/** Tipo nomeado para quem monta um mapa `Record<X, EstadoBadgeEstado>` fora deste arquivo. */
export type EstadoBadgeEstado = NonNullable<VariantProps<typeof estadoBadgeVariants>['estado']>
