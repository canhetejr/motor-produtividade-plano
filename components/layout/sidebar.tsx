'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Clock,
  History,
  FolderKanban,
  Users,
  FileSpreadsheet,
  LogOut,
  Layers
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/theme-toggle'
import { createClient } from '@/utils/supabase/client'

export function Sidebar({ user, email }: { user: { nome: string | null, role: string | null } | null, email: string }) {
  const pathname = usePathname()
  const router = useRouter()

  const isGestor = user?.role === 'gestor'

  const navigation = [
    { name: 'Novo Apontamento', shortName: 'Apontar', href: '/apontamento', icon: Clock },
    { name: 'Histórico', shortName: 'Histórico', href: '/apontamento/historico', icon: History },
    { name: 'Catálogo', shortName: 'Catálogo', href: '/catalogo', icon: FolderKanban },
    ...(isGestor ? [
      { name: 'Dashboard', shortName: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Áreas', shortName: 'Áreas', href: '/areas', icon: Layers },
      { name: 'Colaboradores', shortName: 'Equipe', href: '/colaboradores', icon: Users },
      { name: 'Relatórios', shortName: 'Relatórios', href: '/relatorios', icon: FileSpreadsheet },
    ] : [])
  ]

  const isActive = (href: string) =>
    href === '/apontamento'
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`)

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* Sidebar desktop */}
      <div className="hidden md:flex flex-col w-64 border-r bg-card/50 backdrop-blur-md">
        <div className="flex h-16 shrink-0 items-center px-6 font-bold text-lg tracking-tight">
          Motor
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto">
          <nav className="flex-1 space-y-1 px-4 py-4">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  isActive(item.href)
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  'group flex items-center rounded-md px-2 py-2 text-sm font-medium transition-colors'
                )}
              >
                <item.icon
                  className={cn(
                    isActive(item.href) ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground',
                    'mr-3 h-5 w-5 shrink-0 transition-colors'
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            ))}
          </nav>
        </div>

        <div className="border-t p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-medium truncate">{user?.nome || 'Usuário'}</span>
              <span className="text-xs text-muted-foreground truncate">{email}</span>
            </div>
            <ThemeToggle />
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </button>
        </div>
      </div>

      {/* Bottom nav mobile */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 flex items-stretch border-t bg-card/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
        {navigation.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors',
              isActive(item.href) ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <item.icon className="h-5 w-5" aria-hidden="true" />
            {item.shortName}
          </Link>
        ))}
        <button
          onClick={handleLogout}
          className="flex-1 flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <LogOut className="h-5 w-5" aria-hidden="true" />
          Sair
        </button>
      </nav>
    </>
  )
}
