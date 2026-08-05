'use client'

import { useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LibraryBig,
  Clock,
  History,
  UserCircle,
  LogOut,
  Kanban,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Settings2,
  MoreHorizontal,
  CalendarCheck2,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'
import { Tooltip, TooltipProvider } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import { ThemeToggle } from '@/components/theme-toggle'
import { VerticeLogo, VerticeSymbol } from '@/components/vertice-symbol'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetClose,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetHeader,
  BottomSheetTitle,
} from '@/components/ui/bottom-sheet'


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
  // `storage` só dispara nas outras abas. Este evento mantém componentes da
  // própria aba (como o mini timer) alinhados à largura da barra lateral.
  window.dispatchEvent(new CustomEvent('vertice:sidebar-collapse'))
}

export function Sidebar({ user }: { user: SidebarUser | null }) {
  const pathname = usePathname()
  const router = useRouter()
  const isCollapsed = useSyncExternalStore(subscribeCollapse, getCollapse, getCollapseServer)

  const toggleCollapse = () => setCollapse(!isCollapsed)

  const isGestor = user?.role === 'gestor'
  const trabalhoItems = [
    { name: 'Novo apontamento', shortName: 'Apontar', href: '/apontamento', icon: Clock },
    { name: 'Minha semana', shortName: 'Semana', href: '/minha-semana', icon: CalendarCheck2 },
    { name: 'Quadros', shortName: 'Quadros', href: '/kanban', icon: Kanban },
    { name: 'Histórico', shortName: 'Histórico', href: '/apontamento/historico', icon: History },
    ...(isGestor
      ? []
      : [{ name: 'Minhas demandas', shortName: 'Demandas', href: '/minhas-demandas', icon: LibraryBig }]),
  ]
  const gestaoItem = {
    name: 'Área do Gestor',
    shortName: 'Gestor',
    href: '/gestao',
    icon: Settings2,
    activePaths: ['/gestao', '/admin', '/dashboard', '/catalogo', '/relatorios', '/auditoria', '/areas', '/colaboradores'],
  }
  const sections = [
    {
      title: 'Trabalho',
      items: trabalhoItems,
    },
    ...(isGestor
      ? [
          {
            title: 'Gestão',
            items: [gestaoItem],
          },
        ]
      : []),
    {
      title: 'Conta',
      items: [
        { name: 'Ajuda', shortName: 'Ajuda', href: '/documentacao', icon: BookOpen },
        { name: 'Perfil', shortName: 'Perfil', href: '/perfil', icon: UserCircle },
      ],
    },
  ]

  const allItems = sections.flatMap((s) => s.items)

  // Quatro destinos fixos por papel e um menu Mais. Assim a barra inferior
  // prioriza as jornadas diarias sem esconder demandas ou gestao.
  const primaryHrefs = isGestor
    ? ['/apontamento', '/minha-semana', '/kanban', '/gestao']
    : ['/apontamento', '/minha-semana', '/kanban', '/minhas-demandas']
  const primaryItems = primaryHrefs.map((href) => allItems.find((item) => item.href === href)!)
  const overflowItems = allItems.filter((item) => !primaryHrefs.includes(item.href))
  const [maisAberto, setMaisAberto] = useState(false)

  const isActive = (item: { href: string; activePaths?: string[] }) => {
    const paths = item.activePaths ?? [item.href]
    return paths.some((href) =>
      href === '/apontamento'
        ? pathname === href
        : pathname === href || pathname.startsWith(`${href}/`)
    )
  }

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
          "relative z-10 hidden md:flex flex-col border-r border-border bg-card shadow-xs transition-all duration-300 ease-in-out group/sidebar",
          isCollapsed ? "w-16" : "w-64"
        )}
      >
        {/* Header da Sidebar */}
        <div className={cn(
          "relative flex h-[calc(4rem+env(safe-area-inset-top))] shrink-0 items-center border-b border-border px-3 pt-[env(safe-area-inset-top)] transition-all duration-300",
          isCollapsed ? "justify-center gap-0" : "justify-between px-4"
        )}>
          {!isCollapsed ? (
            <div className="flex min-w-0 items-center">
              <VerticeLogo className="h-[23px] w-auto max-w-[154px]" priority />
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <VerticeSymbol className="h-8 w-8 shrink-0" priority />
            </div>
          )}

          {/* Toggle Button */}
          <button
            type="button"
            onClick={toggleCollapse}
            aria-label={isCollapsed ? "Expandir menu" : "Recolher menu"}
            className={cn(
              "touch-manipulation cursor-pointer rounded-md border border-transparent p-1.5 text-muted-foreground transition-colors hover:border-border hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              isCollapsed && "absolute -right-3 top-[calc(50%+env(safe-area-inset-top)/2)] z-20 -translate-y-1/2 border-border bg-card shadow-sm"
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

        {/* Navigation Items agrupados por seção. TooltipProvider agrupa o delay:
            passar de um icone pro outro (recolhida) nao espera o atraso inteiro
            de novo — mesmo comportamento de Linear/Raycast numa barra de icones. */}
        <TooltipProvider delay={300}>
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
                  <Separator className="my-2 mx-1 bg-border/40" />
                ) : null}

                {section.items.map((item) => {
                  const active = isActive(item)
                  const link = (
                    <Link
                      href={item.href}
                      className={cn(
                        active
                          ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                          : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground',
                        'group flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
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

                  // Recolhida, o icone sozinho nao diz o que e — e o `title`
                  // nativo que estava aqui e lento pra aparecer, sem estilo, e
                  // invisivel pra quem navega por teclado (so dispara no
                  // hover do mouse). O Tooltip aparece em foco tambem. Expandida,
                  // o rotulo ja esta escrito ao lado — repetir seria ruido.
                  return isCollapsed ? (
                    <Tooltip key={item.name} texto={item.name} side="right">
                      {link}
                    </Tooltip>
                  ) : (
                    <div key={item.name}>{link}</div>
                  )
                })}
              </div>
            )
          })}
        </div>
        </TooltipProvider>

        {/* User Footer */}
        <div className={cn(
          "border-t border-border p-3 flex flex-col gap-2.5 bg-secondary/20 transition-all",
          isCollapsed && "items-center px-2 py-3"
        )}>
          {!isCollapsed ? (
            <>
              <div className="flex items-center justify-between">
                <Link href="/perfil" className="flex items-center gap-2.5 min-w-0 group flex-1">
                  <Avatar
                    nome={user?.nome || 'Usuário'}
                    src={user?.avatarUrl}
                    tamanho="sm"
                    className="transition-colors group-hover:bg-primary group-hover:text-primary-foreground"
                  />
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
                type="button"
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
                <Avatar nome={user?.nome || 'Usuário'} src={user?.avatarUrl} tamanho="sm" />
              </Link>

              <ThemeToggle />

              <button
                type="button"
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
      <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-40 flex min-h-16 items-stretch border-t border-border bg-card pb-[env(safe-area-inset-bottom)] shadow-lg md:hidden">
        {primaryItems.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            aria-current={isActive(item) ? 'page' : undefined}
            className={cn(
              'flex-1 min-w-0 flex flex-col items-center justify-center gap-1 px-1 py-2 text-2xs font-medium transition-colors',
              isActive(item) ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="max-w-full truncate">{item.shortName}</span>
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setMaisAberto(true)}
          aria-label="Mais opções"
          className={cn(
            'flex-1 min-w-0 flex flex-col items-center justify-center gap-1 px-1 py-2 text-2xs font-medium transition-colors',
            overflowItems.some((i) => isActive(i))
              ? 'text-primary font-bold'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <MoreHorizontal className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="max-w-full truncate">Mais</span>
        </button>
      </nav>

      <BottomSheet open={maisAberto} onOpenChange={setMaisAberto}>
        <BottomSheetContent className="md:hidden">
          <BottomSheetHeader className="flex flex-row items-start justify-between gap-4 border-b border-border">
            <div>
              <BottomSheetTitle className="text-base font-semibold">Mais opções</BottomSheetTitle>
              <BottomSheetDescription className="mt-1 text-sm text-muted-foreground">Conta, ajuda e histórico.</BottomSheetDescription>
            </div>
            <BottomSheetClose render={<Button type="button" variant="ghost" size="icon-sm" aria-label="Fechar navegação" />}>
              <X className="h-4 w-4" />
            </BottomSheetClose>
          </BottomSheetHeader>
          <BottomSheetBody className="flex flex-col gap-1 py-3">
            {overflowItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMaisAberto(false)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors',
                  isActive(item)
                    ? 'bg-primary/10 text-primary font-bold'
                    : 'text-foreground hover:bg-muted'
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                {item.name}
              </Link>
            ))}
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
              Sair
            </button>
          </BottomSheetBody>
        </BottomSheetContent>
      </BottomSheet>
    </>
  )
}
