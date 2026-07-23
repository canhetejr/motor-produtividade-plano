import { requireGestor } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { throwIfError } from '@/lib/supabase-error'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatarDataCompletaBR } from '@/lib/dates'

export const dynamic = 'force-dynamic'

// Rótulos amigáveis pros códigos gravados em `acao` — mantidos em sincronia
// manual com os registrarAuditoria() espalhados pelas Server Actions
// (colaboradores/actions.ts, catalogo/actions.ts).
const ACAO_LABEL: Record<string, string> = {
  'colaborador.atualizar': 'Atualizou colaborador',
  'solicitacao.aprovar': 'Aprovou solicitação',
  'solicitacao.rejeitar': 'Rejeitou solicitação',
}

function formatarHora(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default async function AuditoriaPage() {
  await requireGestor()
  const supabase = await createClient()

  const { data: eventos, error } = await supabase
    .from('auditoria')
    .select('id, acao, entidade, entidade_id, dados_antes, dados_depois, criado_em, colaboradores(nome)')
    .order('criado_em', { ascending: false })
    .limit(100)
  throwIfError(error)

  return (
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-2">Auditoria</h1>
      <p className="text-muted-foreground mb-6">
        Últimas 100 ações administrativas — quem fez, o quê e quando.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Eventos recentes</CardTitle>
          <CardDescription>Mudança de colaborador, aprovação/rejeição de solicitação de demanda.</CardDescription>
        </CardHeader>
        <CardContent>
          {(eventos ?? []).length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum evento registrado ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Quem</TableHead>
                    <TableHead>Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(eventos ?? []).map((ev) => (
                    <TableRow key={ev.id}>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatarDataCompletaBR(ev.criado_em.slice(0, 10))} às {formatarHora(ev.criado_em)}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{ev.colaboradores?.nome ?? '—'}</TableCell>
                      <TableCell className="text-sm">{ACAO_LABEL[ev.acao] ?? ev.acao}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
