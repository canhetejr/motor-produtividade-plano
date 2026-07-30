import { cn } from "@/lib/utils"

/**
 * Placeholder de carregamento.
 *
 * Existe porque várias abas do card buscavam dados no mount e devolviam
 * `null` até a resposta chegar: o painel ficava vazio por um instante e o
 * conteúdo aparecia de estalo, empurrando o resto — parecia tela quebrada.
 * Reservar o espaço com a forma aproximada do conteúdo remove o pulo.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      // aria-hidden: é ruído para leitor de tela. Quem anuncia o carregamento
      // é o container, com aria-busy.
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

/** Linhas de texto — o caso mais comum (listas, parágrafos). */
function SkeletonTexto({ linhas = 3, className }: { linhas?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-busy="true">
      {Array.from({ length: linhas }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-4"
          // A última linha mais curta imita parágrafo de verdade; sem isso o
          // bloco parece uma tabela.
          style={{ width: i === linhas - 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  )
}

/** Cartões/itens de lista com borda, como as abas do card usam. */
function SkeletonLista({ itens = 3, className }: { itens?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-busy="true">
      {Array.from({ length: itens }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border/60 p-3">
          <Skeleton className="h-3.5 w-1/3" />
          <Skeleton className="mt-2 h-3 w-2/3" />
        </div>
      ))}
    </div>
  )
}

export { Skeleton, SkeletonTexto, SkeletonLista }
