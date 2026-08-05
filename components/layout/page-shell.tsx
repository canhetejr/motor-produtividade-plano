import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

const WIDTHS = {
  narrow: 'max-w-3xl',
  content: 'max-w-5xl',
  wide: 'max-w-7xl',
  full: 'max-w-none',
} as const

export function PageShell({
  children,
  width = 'wide',
  className,
  contentClassName,
}: {
  children: React.ReactNode
  width?: keyof typeof WIDTHS
  className?: string
  contentClassName?: string
}) {
  return (
    <div className={cn('min-h-full min-w-0 overflow-x-clip px-4 py-5 md:px-6 md:py-7 lg:px-8 lg:py-8', className)}>
      <div className={cn('mx-auto w-full', WIDTHS[width], contentClassName)}>{children}</div>
    </div>
  )
}

export function PageHeader({
  title,
  description,
  eyebrow,
  icon: Icon,
  actions,
  back,
  level = 1,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  eyebrow?: React.ReactNode
  icon?: LucideIcon
  actions?: React.ReactNode
  back?: React.ReactNode
  level?: 1 | 2
  className?: string
}) {
  const Heading = level === 1 ? 'h1' : 'h2'

  return (
    <header className={cn('mb-6 border-b border-border/70 pb-5', className)}>
      {back ? <div className="mb-4">{back}</div> : null}
      <div className="flex min-w-0 flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="flex min-w-0 items-start gap-3">
          {Icon ? (
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
              <Icon className="size-4.5" aria-hidden="true" />
            </div>
          ) : null}
          <div className="min-w-0">
            {eyebrow ? <p className="mb-1 text-xs font-medium text-primary">{eyebrow}</p> : null}
            <Heading className="wrap-break-word text-2xl font-semibold leading-tight text-foreground">{title}</Heading>
            {description ? <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:justify-end">{actions}</div> : null}
      </div>
    </header>
  )
}

export function SectionHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-end', className)}>
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  )
}
