import { cn } from '@/lib/utils'

type MarcaProps = {
  className?: string
  alt?: string
  priority?: boolean
}

/**
 * Logo recolorável: em vez de pintar pixels (PNG), usa a imagem como máscara
 * de forma e preenche com `bg-primary` — assim ela acompanha a preferência de
 * cor (`preferencia-cor-applier.tsx`) sem precisar de um asset por cor.
 */
function Marca({
  src,
  width,
  height,
  alt,
  priority,
  className,
}: {
  src: string
  width: number
  height: number
  alt: string
  priority?: boolean
} & Pick<MarcaProps, 'className'>) {
  return (
    <>
      {priority && <link rel="preload" as="image" href={src} />}
      <span
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
        className={cn('inline-block bg-primary', className)}
        style={{
          aspectRatio: `${width} / ${height}`,
          WebkitMaskImage: `url(${src})`,
          maskImage: `url(${src})`,
          WebkitMaskSize: 'contain',
          maskSize: 'contain',
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskPosition: 'center',
          maskPosition: 'center',
        }}
      />
    </>
  )
}

export function VerticeSymbol({ className, alt = '', priority = false }: MarcaProps) {
  return <Marca src="/brand/vertice-symbol.png" width={512} height={512} alt={alt} priority={priority} className={className} />
}

export function VerticeLogo({ className, alt = 'Vértice', priority = false }: MarcaProps) {
  return <Marca src="/brand/vertice-wordmark.png" width={681} height={139} alt={alt} priority={priority} className={className} />
}

export function VerticeLockup({ className, alt = 'Vértice, um produto Tera', priority = false }: MarcaProps) {
  return <Marca src="/brand/vertice-lockup.png" width={835} height={236} alt={alt} priority={priority} className={className} />
}
