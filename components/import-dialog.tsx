'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Upload, CheckCircle2, XCircle } from 'lucide-react'
import type { ActionResult } from '@/lib/action-result'
import type { LinhaImportResultado } from '@/lib/import-planilha'

// Dialog genérico de import em massa (CSV/XLSX): sobe o arquivo, roda a
// action passada e mostra o relatório linha a linha. Reaproveitado pelas
// abas Demandas e Colaboradores de /catalogo — o formato do arquivo muda,
// o fluxo de upload/relatório é o mesmo.
export function ImportDialog({
  label,
  title,
  colunasEsperadas,
  action,
}: {
  label: string
  title: string
  colunasEsperadas: string
  action: (formData: FormData) => Promise<ActionResult<{ relatorio: LinhaImportResultado[] }>>
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [relatorio, setRelatorio] = useState<LinhaImportResultado[] | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setRelatorio(null)
    startTransition(async () => {
      const result = await action(formData)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      const linhas = result.data?.relatorio ?? []
      setRelatorio(linhas)
      const erros = linhas.filter((r) => r.status === 'erro').length
      const ok = linhas.length - erros
      if (erros > 0) {
        toast.warning(`${ok} linha(s) importada(s), ${erros} com erro — confira o relatório abaixo.`)
      } else {
        toast.success(`${ok} linha(s) importada(s) com sucesso.`)
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setRelatorio(null)
      }}
    >
      <DialogTrigger render={<Button variant="outline" className="gap-2 w-full sm:w-auto" />}>
        <Upload className="h-4 w-4" /> {label}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Arquivo CSV ou XLSX com cabeçalho: <code className="font-mono">{colunasEsperadas}</code>
          </p>
          <input
            type="file"
            name="arquivo"
            accept=".csv,.xlsx"
            required
            className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground"
          />
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? 'Processando...' : 'Processar arquivo'}
          </Button>
        </form>

        {relatorio && (
          <div className="max-h-64 overflow-y-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">Linha</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Resultado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {relatorio.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs text-muted-foreground">{r.linha}</TableCell>
                    <TableCell className="text-xs">{r.nome || '—'}</TableCell>
                    <TableCell className="text-xs">
                      {r.status === 'ok' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600">
                          <CheckCircle2 className="h-3.5 w-3.5" /> OK
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-600">
                          <XCircle className="h-3.5 w-3.5 shrink-0" /> {r.motivo}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
