import { cn } from '@/lib/utils'

/**
 * Moldura de janela em volta das maquetes do produto na landing. Existe para
 * enquadrar: sem a moldura, a maquete lê como "mais um bloco da página"; com
 * ela, lê como "isto é o produto".
 */
export function JanelaApp({
  titulo,
  children,
  className,
}: {
  titulo: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-white/12 bg-[#0b0a14] shadow-[0_24px_70px_-20px_rgba(0,0,0,.9)]',
        className
      )}
    >
      <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.03] px-3 py-2">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2 rounded-full bg-white/15" />
          <span className="size-2 rounded-full bg-white/15" />
          <span className="size-2 rounded-full bg-white/15" />
        </span>
        <span className="ml-1 truncate font-mono text-[10px] text-white/40">{titulo}</span>
      </div>
      <div className="p-3 sm:p-4">{children}</div>
    </div>
  )
}
