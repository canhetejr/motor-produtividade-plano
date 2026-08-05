import Link from 'next/link'
import { Share2 } from 'lucide-react'

import { requireUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { ReceberCompartilhamento } from './receber-compartilhamento'
import { PageHeader, PageShell } from '@/components/layout/page-shell'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

/**
 * Destino do Share Target do PWA.
 *
 * Quando alguém compartilha um link ou um texto de outro app para o Vértice, o
 * sistema abre esta rota com os dados na query. Ela não cria o card sozinha: um
 * GET não deve ter efeito colateral, e adivinhar o quadro produziria card no
 * lugar errado. A pessoa escolhe o destino e confirma.
 */
export default async function ReceberPage(props: {
  searchParams: Promise<{ title?: string; text?: string; url?: string }>
}) {
  const [{ user }, searchParams] = await Promise.all([requireUser(), props.searchParams])
  const supabase = await createClient()

  // A RLS de quadros já restringe aos de que a pessoa é membro; a coluna vem
  // junto porque criar card exige uma, e a primeira da ordem é o destino óbvio
  // para algo que acabou de chegar de fora.
  const { data: quadros } = await supabase
    .from('quadros')
    .select('id, nome, codigo, colunas(id, nome, posicao)')
    .eq('ativo', true)
    .order('nome')

  const destinos = (quadros ?? [])
    .map((q) => {
      const colunas = [...(q.colunas ?? [])].sort((a, b) => a.posicao - b.posicao)
      return { id: q.id, nome: q.nome, codigo: q.codigo, primeiraColuna: colunas[0] ?? null }
    })
    .filter((q) => q.primeiraColuna !== null)

  const partes = [searchParams.text, searchParams.url].filter(Boolean)

  return (
    <PageShell width="narrow">
      <PageHeader
        title="Novo card compartilhado"
        description="Revise o conteúdo e escolha em qual quadro ele deve entrar."
        icon={Share2}
      />

      {destinos.length === 0 ? (
        <EmptyState
          titulo="Nenhum destino disponível"
          descricao="Você não participa de nenhum quadro com uma etapa criada."
          icone={Share2}
          acao={<Button variant="outline" render={<Link href="/kanban" />}>Ir para os quadros</Button>}
        />
      ) : (
        <ReceberCompartilhamento
          destinos={destinos}
          tituloInicial={searchParams.title ?? ''}
          descricaoInicial={partes.join('\n\n')}
          userId={user.id}
        />
      )}
    </PageShell>
  )
}
