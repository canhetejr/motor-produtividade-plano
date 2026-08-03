'use client'

import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip'

import { cn } from '@/lib/utils'

/**
 * Dica contextual.
 *
 * **Nunca é o único lugar onde a informação existe.** Tooltip não abre no toque
 * e não é lido por parte dos leitores de tela em todos os modos — o que estiver
 * só aqui está invisível para quem usa celular ou teclado. Serve para reforçar,
 * não para esconder.
 */
export const TooltipProvider = TooltipPrimitive.Provider
export const TooltipRoot = TooltipPrimitive.Root
export const TooltipTrigger = TooltipPrimitive.Trigger

export function TooltipContent({
  className,
  sideOffset = 6,
  side,
  children,
  ...props
}: TooltipPrimitive.Popup.Props & {
  sideOffset?: number
  side?: TooltipPrimitive.Positioner.Props['side']
}) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner sideOffset={sideOffset} side={side}>
        <TooltipPrimitive.Popup
          className={cn(
            'z-50 max-w-[calc(100vw-2rem)] rounded-md border border-border bg-popover px-2 py-1 text-2xs text-popover-foreground shadow-md',
            // Entrada curta: uma dica que demora a aparecer é ruído, não ajuda.
            'origin-(--transform-origin) transition-[transform,opacity] duration-150',
            'data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
            'data-[ending-style]:scale-95 data-[ending-style]:opacity-0',
            className
          )}
          {...props}
        >
          {children}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  )
}

/** Atalho para o caso comum: um gatilho, um texto. */
export function Tooltip({
  texto,
  children,
  side,
  ...props
}: {
  texto: React.ReactNode
  children: React.ReactNode
  side?: TooltipPrimitive.Positioner.Props['side']
} & TooltipPrimitive.Root.Props) {
  return (
    <TooltipRoot {...props}>
      <TooltipTrigger render={children as React.ReactElement} />
      <TooltipContent side={side}>{texto}</TooltipContent>
    </TooltipRoot>
  )
}
