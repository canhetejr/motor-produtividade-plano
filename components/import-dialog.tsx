'use client'

import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Upload, CheckCircle2, XCircle, FolderPlus } from 'lucide-react'
import type { ActionResult } from '@/lib/action-result'
import type { LinhaImportResultado, ResultadoImportacao } from '@/lib/import-planilha'

// Dialog genérico de import em massa (CSV/XLSX): sobe o arquivo, roda a
// action passada e mostra o relatório linha a linha. Reaproveitado pelas
// abas Demandas e Colaboradores de /catalogo — o formato do arquivo muda,
// o fluxo de upload/relatório é o mesmo.
export function ImportDialog({
  label,
  title,
  colunasEsperadas,
  dica,
  action,
}: {
  label: string
  title: string
  colunasEsperadas: string
  /** Linha extra abaixo do cabeçalho esperado. Só quem tem export na mesma
   *  tela pode prometer que o arquivo exportado volta por aqui. */
  dica?: string
  action: (formData: FormData) => Promise<ActionResult<ResultadoImportacao>>
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [relatorio, setRelatorio] = useState<LinhaImportResultado[] | null>(null)
  // Áreas do arquivo que não existem no cadastro. Enquanto isto tem conteúdo,
  // nada foi gravado: a action parou para perguntar.
  const [areasFaltando, setAreasFaltando] = useState<string[] | null>(null)
  const [areasEscolhidas, setAreasEscolhidas] = useState<Set<string>>(new Set())
  // O arquivo continua no input depois da primeira ida ao servidor, então a
  // resposta da pergunta reenvia o mesmo formulário em vez de pedir o upload
  // de novo.
  const formRef = useRef<HTMLFormElement>(null)

  function limpar() {
    setRelatorio(null)
    setAreasFaltando(null)
    setAreasEscolhidas(new Set())
  }

  function enviar(criarAreas?: string[]) {
    const form = formRef.current
    if (!form) return
    const formData = new FormData(form)
    if (criarAreas) formData.set('criar_areas', JSON.stringify(criarAreas))

    setRelatorio(null)
    startTransition(async () => {
      const result = await action(formData)
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      const pendentes = result.data?.areasFaltando
      if (pendentes && pendentes.length > 0) {
        setAreasFaltando(pendentes)
        setAreasEscolhidas(new Set(pendentes))
        return
      }
      setAreasFaltando(null)

      const criadas = result.data?.areasCriadas ?? []
      if (criadas.length > 0) {
        toast.success(`${criadas.length} área(s) criada(s): ${criadas.join(', ')}.`)
      }

      const linhas = result.data?.relatorio ?? []
      setRelatorio(linhas)
      const erros = linhas.filter((r) => r.status === 'erro').length
      const atualizados = linhas.filter((r) => r.acao === 'atualizado').length
      const ok = linhas.length - erros
      // "importadas" escondia o que mudou: subir de volta o arquivo exportado
      // atualiza tudo e não cria nada, e o resumo precisa dizer isso.
      const resumo =
        atualizados > 0 ? `${ok - atualizados} criada(s), ${atualizados} atualizada(s)` : `${ok} linha(s) importada(s)`
      if (erros > 0) {
        toast.warning(`${resumo}, ${erros} com erro — confira o relatório abaixo.`)
      } else {
        toast.success(`${resumo} com sucesso.`)
      }
    })
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    limpar()
    enviar()
  }

  function alternarArea(nome: string) {
    setAreasEscolhidas((atual) => {
      const proximo = new Set(atual)
      if (proximo.has(nome)) proximo.delete(nome)
      else proximo.add(nome)
      return proximo
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) limpar()
      }}
    >
      <DialogTrigger render={<Button variant="outline" className="gap-2 w-full sm:w-auto" />}>
        <Upload className="h-4 w-4" /> {label}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Arquivo CSV ou XLSX com cabeçalho: <code className="font-mono">{colunasEsperadas}</code>
          </p>
          {/* Dito na tela porque era a dúvida real de quem tentava e falhava:
              acento no cabeçalho e o `;` que o Excel em português grava. */}
          <p className="text-2xs text-muted-foreground">
            Acento, maiúscula e ponto e vírgula não atrapalham.{dica ? ` ${dica}` : ''}
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

        {areasFaltando && areasFaltando.length > 0 && (
          <div className="space-y-3 rounded-md border border-warning-borda bg-warning-superficie p-3">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <FolderPlus className="size-4 text-warning-texto" aria-hidden="true" />
                {areasFaltando.length === 1
                  ? 'Uma área do arquivo não existe no cadastro'
                  : `${areasFaltando.length} áreas do arquivo não existem no cadastro`}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Marque as que devem ser criadas agora. As desmarcadas ficam de fora, e as linhas que dependem
                delas aparecem como erro no relatório. Nada foi gravado ainda.
              </p>
            </div>

            <ul className="max-h-40 space-y-1.5 overflow-y-auto">
              {areasFaltando.map((nome) => (
                <li key={nome}>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={areasEscolhidas.has(nome)}
                      onChange={() => alternarArea(nome)}
                      className="size-4 accent-primary"
                    />
                    <span className="truncate">{nome}</span>
                  </label>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={isPending || areasEscolhidas.size === 0}
                onClick={() => enviar([...areasEscolhidas])}
              >
                {isPending
                  ? 'Processando...'
                  : `Criar ${areasEscolhidas.size} área(s) e importar`}
              </Button>
              <Button type="button" variant="ghost" disabled={isPending} onClick={() => enviar([])}>
                Importar sem criar
              </Button>
            </div>
          </div>
        )}

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
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {r.acao === 'atualizado' ? 'Atualizada' : r.acao === 'criado' ? 'Criada' : 'OK'}
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
