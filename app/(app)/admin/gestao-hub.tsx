import Link from 'next/link'
import { BarChart3, ClipboardList, FolderKanban, ShieldCheck, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'

const destinos = [
  {
    titulo: 'Catálogo e equipe',
    descricao: 'Organize áreas, demandas, pessoas e solicitações.',
    href: '/catalogo',
    icone: FolderKanban,
  },
  {
    titulo: 'Relatórios',
    descricao: 'Gere exportações para acompanhar a operação.',
    href: '/relatorios',
    icone: BarChart3,
  },
  {
    titulo: 'Auditoria',
    descricao: 'Consulte o histórico de alterações e ações.',
    href: '/auditoria',
    icone: ShieldCheck,
  },
  {
    titulo: 'Áreas',
    descricao: 'Revise a estrutura das áreas de trabalho.',
    href: '/areas',
    icone: Users,
  },
]

export function GestaoHub({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="container mx-auto min-w-0 overflow-x-hidden p-4 md:p-8 space-y-7">
      <header className="max-w-2xl">
        <div className="flex items-center gap-2 mb-2">
          <ClipboardList className="h-7 w-7 text-primary" aria-hidden="true" />
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Administração</h1>
        </div>
        <p className="text-muted-foreground">
          Área do gestor para organizar a operação, acompanhar resultados e consultar controles.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {destinos.map(({ titulo, descricao, href, icone: Icone }) => (
          <Link key={href} href={href} className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-secondary/40">
            <Icone className="mb-4 h-5 w-5 text-primary" aria-hidden="true" />
            <h2 className="font-semibold group-hover:text-primary">{titulo}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>
          </Link>
        ))}
      </div>

      {isAdmin && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-secondary/30 p-4">
          <div>
            <p className="font-medium">Configuração global</p>
            <p className="text-sm text-muted-foreground">Acessos, quadros, automações e saúde do sistema.</p>
          </div>
          <Button variant="outline" render={<Link href="/admin?tab=visao-geral" />}>Abrir console</Button>
        </div>
      )}
    </div>
  )
}
