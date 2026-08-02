import Link from 'next/link'
import { Share2 } from 'lucide-react'

import { requireUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { ReceberCompartilhamento } from './receber-compartilhamento'

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
    <div className="mx-auto w-full max-w-lg p-4 md:p-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Share2 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Novo card a partir do compartilhamento</h1>
          <p className="text-sm text-muted-foreground">Escolha onde ele entra.</p>
        </div>
      </div>

      {destinos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Você não participa de nenhum quadro com etapa criada.
          </p>
          <Link href="/kanban" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
            Ir para os quadros
          </Link>
        </div>
      ) : (
        <ReceberCompartilhamento
          destinos={destinos}
          tituloInicial={searchParams.title ?? ''}
          descricaoInicial={partes.join('\n\n')}
          userId={user.id}
        />
      )}
    </div>
  )
}
