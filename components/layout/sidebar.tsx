'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, 
  Clock, 
  History, 
  FolderKanban, 
  Users, 
  FileSpreadsheet, 
  LogOut 
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/theme-toggle'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

export function Sidebar({ user, email }: { user: { nome: string | null, role: string | null } | null, email: string }) {
  const pathname = usePathname()
  const router = useRouter()

  const isGestor = user?.role === 'gestor'

  const navigation = [
    { name: 'Novo Apontamento', href: '/apontamento', icon: Clock },
    { name: 'Histórico', href: '/apontamento/historico', icon: History },
    ...(isGestor ? [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Catálogo', href: '/catalogo', icon: FolderKanban },
      { name: 'Colaboradores', href: '/colaboradores', icon: Users },
      { name: 'Relatórios', href: '/relatorios', icon: FileSpreadsheet },
    ] : [])
  ]

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex flex-col w-64 border-r bg-card/50 backdrop-blur-md">
      <div className="flex h-16 shrink-0 items-center px-6 font-bold text-lg tracking-tight">
        Motor
      </div>
      <div className="flex flex-1 flex-col overflow-y-auto">
        <nav className="flex-1 space-y-1 px-4 py-4">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  isActive 
                    ? 'bg-primary text-primary-foreground' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  'group flex items-center rounded-md px-2 py-2 text-sm font-medium transition-colors'
                )}
              >
                <item.icon
                  className={cn(
                    isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground',
                    'mr-3 h-5 w-5 shrink-0 transition-colors'
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            )
          })}
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
  )
}
