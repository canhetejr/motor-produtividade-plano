import { cn } from '@/lib/utils'

/**
 * O vértice em 3D de verdade: um cubo em CSS puro (transform-style:
 * preserve-3d, sem lib nenhuma), girando devagar. É decoração de hero — só
 * cabe aqui porque é "grande superfície" (design.md §1.5), nunca num botão
 * ou ícone pequeno. Server Component: a rotação é CSS (@keyframes
 * girar-vertice-3d em globals.css), então não precisa de 'use client'.
 *
 * Tamanho fixo em 160px (não responsivo): as faces usam translateZ(80px), a
 * metade exata do lado — variar o tamanho por breakpoint quebraria essa
 * conta. Quem usa o componente controla onde ele aparece (ex.: `hidden
 * lg:block`), não o tamanho do cubo.
 */
export function Vertice3D({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('pointer-events-none h-40 w-40 [perspective:900px]', className)}>
      <div className="animate-girar-vertice-3d relative h-40 w-40 [transform-style:preserve-3d]">
        <Face className="bg-primary/25 [transform:translateZ(80px)]" />
        <Face className="bg-vertice-mint/15 [transform:rotateY(180deg)_translateZ(80px)]" />
        <Face className="bg-primary/15 [transform:rotateY(90deg)_translateZ(80px)]" />
        <Face className="bg-vertice-mint/20 [transform:rotateY(-90deg)_translateZ(80px)]" />
        <Face className="bg-white/10 [transform:rotateX(90deg)_translateZ(80px)]" />
        <Face className="bg-white/5 [transform:rotateX(-90deg)_translateZ(80px)]" />
      </div>
    </div>
  )
}

function Face({ className }: { className: string }) {
  return (
    <div className={cn('absolute inset-0 h-40 w-40 border border-white/20 backdrop-blur-sm', className)} />
  )
}
