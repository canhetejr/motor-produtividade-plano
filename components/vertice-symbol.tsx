import Image from 'next/image'
import { cn } from '@/lib/utils'

type MarcaProps = {
  className?: string
  alt?: string
  priority?: boolean
}

export function VerticeSymbol({ className, alt = '', priority = false }: MarcaProps) {
  return (
    <Image
      src="/brand/vertice-symbol.png"
      alt={alt}
      width={512}
      height={512}
      priority={priority}
      className={cn('object-contain', className)}
    />
  )
}

export function VerticeLogo({ className, alt = 'Vértice', priority = false }: MarcaProps) {
  return (
    <Image
      src="/brand/vertice-wordmark.png"
      alt={alt}
      width={681}
      height={139}
      priority={priority}
      className={cn('object-contain', className)}
    />
  )
}

export function VerticeLockup({ className, alt = 'Vértice, um produto Tera', priority = false }: MarcaProps) {
  return (
    <Image
      src="/brand/vertice-lockup.png"
      alt={alt}
      width={835}
      height={236}
      priority={priority}
      className={cn('object-contain', className)}
    />
  )
}
