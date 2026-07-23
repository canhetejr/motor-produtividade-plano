'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Clock,
  History,
  FolderKanban,
  FileSpreadsheet,
  ScrollText,
  UserCircle,
  LogOut,
  Kanban,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/theme-toggle'
import { createClient } from '@/utils/supabase/client'

function getInitials(nome: string) {
  const parts = nome.trim().split(' ').filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

type SidebarUser = { nome: string | null; role: string | null; avatarUrl: string | null }

export function Sidebar({ user, email }: { user: SidebarUser | null, email: string }) {
  const pathname = usePathname()
  const router = useRouter()

  const isGestor = user?.role === 'gestor'

  const navigation = [
    { name: 'Novo Apontamento', shortName: 'Apontar', href: '/apontamento', icon: Clock },
    { name: 'Histórico', shortName: 'Histórico', href: '/apontamento/historico', icon: History },
    { name: 'Catálogo', shortName: 'Catálogo', href: '/catalogo', icon: FolderKanban },
    { name: 'Kanban', shortName: 'Kanban', href: '/kanban', icon: Kanban },
    ...(isGestor ? [
      { name: 'Dashboard', shortName: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Relatórios', shortName: 'Relatórios', href: '/relatorios', icon: FileSpreadsheet },
      { name: 'Auditoria', shortName: 'Auditoria', href: '/auditoria', icon: ScrollText },
    ] : []),
    { name: 'Perfil', shortName: 'Perfil', href: '/perfil', icon: UserCircle },
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
      <div className="hidden md:flex flex-col w-64 border-r border-border bg-card shadow-xs">
        <div className="flex h-16 shrink-0 items-center px-6 gap-2.5 border-b border-border">
          <div className="h-7 w-7 rounded-none bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
            M
          </div>
          <span className="font-bold text-base tracking-tight text-foreground">
            Motor <span className="text-muted-foreground font-normal text-xs uppercase tracking-wider ml-1">Produtividade</span>
          </span>
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto">
          <nav className="flex-1 space-y-1 px-2 py-4">
            {navigation.map((item) => {
              const active = isActive(item.href)
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    active
                      ? 'bg-primary text-primary-foreground font-semibold'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                    'group flex items-center rounded-none px-3 py-2 text-sm font-medium transition-colors'
                  )}
                >
                  <item.icon
                    className={cn(
                      active ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground',
                      'mr-3 h-4.5 w-4.5 shrink-0 transition-colors'
                    )}
                    aria-hidden="true"
                  />
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="border-t border-border p-4 flex flex-col gap-3 bg-secondary/30">
          <div className="flex items-center justify-between">
            <Link href="/perfil" className="flex items-center gap-3 min-w-0 group flex-1">
              <div className="h-9 w-9 rounded-none bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                {user?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatarUrl} alt={user?.nome || 'Usuário'} className="h-full w-full object-cover rounded-none" />
                ) : (
                  getInitials(user?.nome || 'Usuário')
                )}
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-semibold truncate group-hover:text-primary transition-colors leading-tight">
                  {user?.nome || 'Usuário'}
                </span>
                <span className="text-[11px] text-muted-foreground capitalize truncate">
                  {user?.role || 'Colaborador'}
                </span>
              </div>
            </Link>
            <ThemeToggle />
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center justify-center w-full py-1.5 rounded-none text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors border border-border"
          >
            <LogOut className="mr-2 h-3.5 w-3.5" />
            Sair
          </button>
        </div>
      </div>

      {/* Bottom nav mobile */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 flex items-stretch border-t border-border bg-card shadow-lg pb-[env(safe-area-inset-bottom)]">
        {navigation.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors',
              isActive(item.href) ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <item.icon className="h-5 w-5" aria-hidden="true" />
            {item.shortName}
          </Link>
        ))}
        <button
          onClick={handleLogout}
          className="flex-1 flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium text-muted-foreground hover:text-destructive transition-colors"
        >
          <LogOut className="h-5 w-5" aria-hidden="true" />
          Sair
        </button>
      </nav>
    </>
  )
}
