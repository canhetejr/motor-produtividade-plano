import { cn } from '@/lib/utils'

// Símbolo Vértice — duotone (roxo/mint) sobre fundos escuros, monocromático
// deep-space sobre fundos claros/paper. Ver design.md seção 7 (aplicação sobre fundos).
export function VerticeSymbol({ className }: { className?: string }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/vertice-logos-svg/vertice-simbolo-preto.svg"
        alt=""
        className={cn('dark:hidden', className)}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/vertice-logos-svg/vertice-simbolo-duotone.svg"
        alt=""
        className={cn('hidden dark:block', className)}
      />
    </>
  )
}
