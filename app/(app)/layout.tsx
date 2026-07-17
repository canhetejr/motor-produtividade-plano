import { Sidebar } from '@/components/layout/sidebar'
import { requireUser } from '@/lib/auth'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await requireUser()

  return (
    <div className="flex w-full h-dvh bg-background text-foreground overflow-hidden">
      <Sidebar user={{ nome: profile.nome, role: profile.role }} email={user.email || ''} />
      <main className="flex-1 overflow-y-auto bg-muted/30 pb-16 md:pb-0">
        <div className="h-full w-full">
          {children}
        </div>
      </main>
    </div>
  )
}
