'use client'

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'

import { cn } from '@/lib/utils'

/**
 * Painel que sobe pela borda inferior.
 *
 * No celular, um diálogo centralizado força a mão a atravessar a tela e o
 * teclado o empurra para fora. O painel inferior nasce onde o polegar está.
 *
 * Reaproveita o primitivo de diálogo do base-ui em vez de trazer uma biblioteca
 * nova: acessibilidade, foco preso e fechar com Esc já vêm resolvidos, e o que
 * muda é posição e animação.
 */
export const BottomSheet = DialogPrimitive.Root
export const BottomSheetTrigger = DialogPrimitive.Trigger
export const BottomSheetClose = DialogPrimitive.Close
export const BottomSheetTitle = DialogPrimitive.Title
export const BottomSheetDescription = DialogPrimitive.Description

export function BottomSheetContent({
  className,
  children,
  ...props
}: DialogPrimitive.Popup.Props) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop
        className={cn(
          'fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]',
          'transition-opacity duration-200',
          'data-[starting-style]:opacity-0 data-[ending-style]:opacity-0'
        )}
      />
      <DialogPrimitive.Popup
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-2xl border-t border-border bg-card',
          // Respeita o indicador de home do iPhone; sem isso o último botão
          // fica sob a faixa do sistema.
          'pb-[env(safe-area-inset-bottom)]',
          'transition-transform duration-250 ease-out',
          'data-[starting-style]:translate-y-full data-[ending-style]:translate-y-full',
          // Acima de sm vira um diálogo comum: painel inferior no desktop é
          // gesto de celular fora de contexto.
          'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[calc(100dvh-4rem)] sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border',
          'sm:data-[starting-style]:translate-y-[calc(-50%+1rem)] sm:data-[starting-style]:opacity-0',
          'sm:data-[ending-style]:translate-y-[calc(-50%+1rem)] sm:data-[ending-style]:opacity-0',
          className
        )}
        {...props}
      >
        {/* Alça: sinaliza que dá para arrastar e serve de alvo de toque para
            fechar. Só no celular, onde o gesto existe. */}
        <div className="flex shrink-0 justify-center pt-2.5 pb-1 sm:hidden">
          <span aria-hidden className="h-1 w-9 rounded-full bg-muted-foreground/30" />
        </div>
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  )
}

export function BottomSheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('shrink-0 px-5 pt-2 pb-3 sm:pt-5', className)} {...props} />
}

/** O corpo rola; cabeçalho e rodapé ficam fixos. */
export function BottomSheetBody({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div className={cn('min-h-0 flex-1 overflow-y-auto px-5 custom-scrollbar', className)} {...props} />
  )
}

export function BottomSheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('shrink-0 border-t border-border px-5 py-3', className)}
      {...props}
    />
  )
}
