'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, BookOpenCheck, Gauge, Settings2, ShieldCheck } from 'lucide-react'

import { cn } from '@/lib/utils'

const RECURSOS = [
  { nome: 'Visão geral', href: '/gestao', icone: Gauge, secao: 'visao-geral' },
  { nome: 'Catálogo e equipe', href: '/gestao/catalogo', icone: BookOpenCheck, secao: 'catalogo' },
  { nome: 'Relatórios', href: '/gestao/relatorios', icone: BarChart3, secao: 'relatorios' },
  { nome: 'Auditoria', href: '/gestao/auditoria', icone: ShieldCheck, secao: 'auditoria' },
] as const

function recursoAtivo(pathname: string, secao: (typeof RECURSOS)[number]['secao']) {
  if (secao === 'visao-geral') return pathname === '/gestao' || pathname.startsWith('/gestao/equipe/')
  return pathname.startsWith('/gestao/' + secao)
}

export function GestaoNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname()
  const recursos = isAdmin
    ? [...RECURSOS, { nome: 'Sistema', href: '/gestao/sistema', icone: Settings2, secao: 'sistema' as const }]
    : RECURSOS

  return (
    <nav aria-label="Recursos da Área do Gestor" className="-mx-1 overflow-x-auto px-1">
      <div className="flex min-w-max border-b border-border">
        {recursos.map(({ nome, href, icone: Icone, secao }) => {
          const ativo = secao === 'sistema' ? pathname.startsWith('/gestao/sistema') : recursoAtivo(pathname, secao)
          return (
            <Link
              key={href}
              href={href}
              aria-current={ativo ? 'page' : undefined}
              className={cn(
                'relative flex h-11 items-center gap-2 px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground sm:text-sm',
                ativo && 'text-foreground'
              )}
            >
              <Icone className={cn('h-4 w-4 shrink-0', ativo && 'text-primary')} aria-hidden="true" />
              {nome}
              {ativo && <span className="absolute inset-x-2 bottom-0 h-0.5 bg-primary" aria-hidden="true" />}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
