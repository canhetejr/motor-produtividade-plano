import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      // `md:px-2.5` foi removido daqui de propósito, e não pode voltar.
      // tailwind-merge trata `md:px-2.5` e `px-10` como grupos diferentes (o
      // modificador entra na chave de conflito), então os dois sobreviviam ao
      // cn() — e a partir de 768px a variante vencia. O efeito: todo campo
      // que passava `pl-*` para abrir espaço para um ícone perdia o padding no
      // desktop e o texto digitado caía em cima do ícone. Estava assim em 13
      // telas, incluindo o login. `md:h-8` fica: altura é densidade
      // deliberada, e os poucos campos que querem outra (as telas de auth)
      // declaram `md:h-[...]` explicitamente.
      // Ver components/ui/input.test.ts.
      className={cn(
        "h-11 w-full min-w-0 touch-manipulation rounded-sm border border-input bg-transparent px-3 py-1 text-base transition-colors outline-none md:h-8 md:text-sm file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
