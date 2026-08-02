'use client'

import { useState, useSyncExternalStore } from 'react'
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
  ChevronLeft,
  ChevronRight,
  BookOpen,
  ShieldAlert,
  MoreHorizontal,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/theme-toggle'
import { VerticeSymbol } from '@/components/vertice-symbol'
import { createClient } from '@/utils/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

function getInitials(nome: string) {
  const parts = nome.trim().split(' ').filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

type SidebarUser = { nome: string | null; role: string | null; admin?: boolean; avatarUrl: string | null }

// A preferência de colapso vive no localStorage — um store externo. Ler via
// useSyncExternalStore evita o setState-em-effect (render em cascata) e ainda
// mantém abas abertas em sincronia pelo evento 'storage'.
const COLLAPSE_KEY = 'sidebar_collapsed'
let collapseListeners: Array<() => void> = []

function subscribeCollapse(onChange: () => void) {
  collapseListeners.push(onChange)
  window.addEventListener('storage', onChange)
  return () => {
    collapseListeners = collapseListeners.filter((l) => l !== onChange)
    window.removeEventListener('storage', onChange)
  }
}

function getCollapse() {
  return localStorage.getItem(COLLAPSE_KEY) === 'true'
}

function getCollapseServer() {
  return false
}

function setCollapse(next: boolean) {
  localStorage.setItem(COLLAPSE_KEY, String(next))
  collapseListeners.forEach((l) => l())
}

export function Sidebar({ user }: { user: SidebarUser | null }) {
  const pathname = usePathname()
  const router = useRouter()
  const isCollapsed = useSyncExternalStore(subscribeCollapse, getCollapse, getCollapseServer)

  const toggleCollapse = () => setCollapse(!isCollapsed)

  const isGestor = user?.role === 'gestor'
  const isAdmin = Boolean(user?.admin)

  const sections = [
    {
      title: 'Rotina',
      items: [
        { name: 'Novo Apontamento', shortName: 'Apontar', href: '/apontamento', icon: Clock },
        { name: 'Histórico', shortName: 'Histórico', href: '/apontamento/historico', icon: History },
        { name: 'Kanban', shortName: 'Kanban', href: '/kanban', icon: Kanban },
      ],
    },
    {
      title: 'Gestão',
      items: [
        { name: 'Catálogo', shortName: 'Catálogo', href: '/catalogo', icon: FolderKanban },
        ...(isGestor
          ? [
              { name: 'Dashboard', shortName: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
              { name: 'Relatórios', shortName: 'Relatórios', href: '/relatorios', icon: FileSpreadsheet },
              { name: 'Auditoria', shortName: 'Auditoria', href: '/auditoria', icon: ScrollText },
            ]
          : []),
      ],
    },
    {
      title: 'Sistema',
      items: [
        ...(isAdmin
          ? [{ name: 'Administração', shortName: 'Admin', href: '/admin', icon: ShieldAlert }]
          : []),
        { name: 'Documentação', shortName: 'Docs', href: '/documentacao', icon: BookOpen },
        { name: 'Perfil', shortName: 'Perfil', href: '/perfil', icon: UserCircle },
      ],
    },
  ]

  const allItems = sections.flatMap((s) => s.items)

  // Bottom nav: 11 itens (gestor+admin) nao cabem em 375px — 4 fixos mais um
  // menu 'Mais' com o resto. Mantem o alvo de toque cheio em vez de espremer
  // tudo num scroller que ninguem percebe que rola.
  const primaryItems = allItems.slice(0, 4)
  const overflowItems = allItems.slice(4)
  const [maisAberto, setMaisAberto] = useState(false)

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
      {/* Sidebar desktop colapsável */}
      <div 
        className={cn(
          "hidden md:flex flex-col border-r border-border bg-card shadow-xs transition-all duration-300 ease-in-out relative group/sidebar",
          isCollapsed ? "w-16" : "w-64"
        )}
      >
        {/* Header da Sidebar */}
        <div className={cn(
          "flex h-16 shrink-0 items-center border-b border-border transition-all duration-300 px-3",
          isCollapsed ? "justify-center gap-0" : "justify-between px-4"
        )}>
          {!isCollapsed ? (
            <div className="flex items-center gap-2.5 min-w-0">
              <VerticeSymbol className="h-7 w-7 shrink-0" />
              <span className="font-normal text-base tracking-tight text-foreground truncate">
                vértice <span className="text-muted-foreground font-mono font-normal text-[11px] uppercase tracking-widest ml-0.5">produtividade</span>
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <VerticeSymbol className="h-7 w-7 shrink-0" />
            </div>
          )}

          {/* Toggle Button */}
          <button
            onClick={toggleCollapse}
            className={cn(
              "p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent hover:border-border transition-colors cursor-pointer",
              isCollapsed && "mt-1"
            )}
            title={isCollapsed ? "Expandir menu" : "Recolher menu"}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Navigation Items agrupados por seção */}
        <div className="flex flex-1 flex-col overflow-y-auto custom-scrollbar px-2 py-3 space-y-3">
          {sections.map((section, idx) => {
            if (section.items.length === 0) return null
            return (
              <div key={section.title} className="space-y-1">
                {!isCollapsed ? (
                  <div className="px-3 pt-1 pb-1 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/60 select-none">
                    {section.title}
                  </div>
                ) : idx > 0 ? (
                  <div className="h-px bg-border/40 my-2 mx-1" />
                ) : null}

                {section.items.map((item) => {
                  const active = isActive(item.href)
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      title={isCollapsed ? item.name : undefined}
                      className={cn(
                        active
                          ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                          : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground',
                        'group flex items-center rounded-lg px-3 py-2 text-xs sm:text-sm font-medium transition-all duration-150',
                        isCollapsed && 'justify-center px-0 py-2.5'
                      )}
                    >
                      <item.icon
                        className={cn(
                          active ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground',
                          'h-4.5 w-4.5 shrink-0 transition-colors',
                          !isCollapsed && 'mr-3'
                        )}
                        aria-hidden="true"
                      />
                      {!isCollapsed && (
                        <span className="truncate">{item.name}</span>
                      )}
                    </Link>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* User Footer */}
        <div className={cn(
          "border-t border-border p-3 flex flex-col gap-2.5 bg-secondary/20 transition-all",
          isCollapsed && "items-center px-2 py-3"
        )}>
          {!isCollapsed ? (
            <>
              <div className="flex items-center justify-between">
                <Link href="/perfil" className="flex items-center gap-2.5 min-w-0 group flex-1">
                  <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    {user?.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={user.avatarUrl} alt={user?.nome || 'Usuário'} className="h-full w-full object-cover rounded-full" />
                    ) : (
                      getInitials(user?.nome || 'Usuário')
                    )}
                  </div>
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-xs font-semibold truncate group-hover:text-primary transition-colors leading-tight">
                      {user?.nome || 'Usuário'}
                    </span>
                    <span className="text-[10px] text-muted-foreground capitalize truncate">
                      {user?.role || 'Colaborador'}
                    </span>
                  </div>
                </Link>
                <ThemeToggle />
              </div>

              <button
                onClick={handleLogout}
                className="flex items-center justify-center w-full py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors border border-border cursor-pointer"
              >
                <LogOut className="mr-2 h-3.5 w-3.5" />
                Sair
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 w-full">
              <Link href="/perfil" title={user?.nome || 'Perfil'} className="group">
                <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  {user?.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.avatarUrl} alt={user?.nome || 'Usuário'} className="h-full w-full object-cover rounded-full" />
                  ) : (
                    getInitials(user?.nome || 'Usuário')
                  )}
                </div>
              </Link>

              <ThemeToggle />

              <button
                onClick={handleLogout}
                title="Sair"
                className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors border border-border mt-1 cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom nav mobile */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 flex items-stretch border-t border-border bg-card shadow-lg pb-[env(safe-area-inset-bottom)]">
        {primaryItems.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              'flex-1 min-w-0 flex flex-col items-center justify-center gap-1 px-1 py-2 text-2xs font-medium transition-colors',
              isActive(item.href) ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="max-w-full truncate">{item.shortName}</span>
          </Link>
        ))}
        <button
          onClick={() => setMaisAberto(true)}
          aria-label="Mais opções"
          className={cn(
            'flex-1 min-w-0 flex flex-col items-center justify-center gap-1 px-1 py-2 text-2xs font-medium transition-colors',
            overflowItems.some((i) => isActive(i.href))
              ? 'text-primary font-bold'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <MoreHorizontal className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="max-w-full truncate">Mais</span>
        </button>
      </nav>

      <Dialog open={maisAberto} onOpenChange={setMaisAberto}>
        <DialogContent className="md:hidden">
          <DialogHeader>
            <DialogTitle>Navegação</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1">
            {overflowItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMaisAberto(false)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors',
                  isActive(item.href)
                    ? 'bg-primary/10 text-primary font-bold'
                    : 'text-foreground hover:bg-muted'
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                {item.name}
              </Link>
            ))}
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
              Sair
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
