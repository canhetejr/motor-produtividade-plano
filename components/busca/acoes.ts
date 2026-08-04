'use server'

import { requireUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { escaparTermoBusca } from '@/lib/busca-termo'

export type ResultadoBusca = {
  id: string
  tipo: 'cartao' | 'demanda' | 'colaborador'
  titulo: string
  detalhe: string
  href: string
}

/**
 * Busca global por card, demanda e pessoa.
 *
 * A RLS restringe os registros de cada consulta. A aplicação também filtra os
 * tipos de resultado por papel para não oferecer destinos que o colaborador
 * não pode abrir.
 */
export async function buscar(termo: string): Promise<ResultadoBusca[]> {
  const { profile } = await requireUser()

  const limpo = termo.trim()
  // Menos de 2 caracteres casa com quase tudo e a lista deixa de informar.
  if (limpo.length < 2) return []

  const padrao = `%${escaparTermoBusca(limpo)}%`
  const supabase = await createClient()

  const [cartoes, demandas, colaboradores] = await Promise.all([
    supabase
      .from('cartoes')
      .select('id, codigo, titulo, colunas!inner(nome, quadro_id, quadros!inner(nome))')
      .or(`titulo.ilike.${padrao},codigo.ilike.${padrao}`)
      .limit(8),
    supabase.from('demandas').select('id, nome, ativo').ilike('nome', padrao).eq('ativo', true).limit(5),
    supabase.from('colaboradores').select('id, nome, role').ilike('nome', padrao).eq('ativo', true).limit(5),
  ])

  const resultados: ResultadoBusca[] = []

  for (const c of cartoes.data ?? []) {
    const coluna = Array.isArray(c.colunas) ? c.colunas[0] : c.colunas
    const quadro = Array.isArray(coluna?.quadros) ? coluna.quadros[0] : coluna?.quadros
    resultados.push({
      id: c.id,
      tipo: 'cartao',
      titulo: c.titulo,
      detalhe: [c.codigo, quadro?.nome, coluna?.nome].filter(Boolean).join(' · '),
      href: `/kanban/${coluna?.quadro_id}?cartao=${c.id}`,
    })
  }

  const demandaHref = profile.role === 'gestor' ? '/gestao/catalogo?tab=demandas' : '/minhas-demandas'

  for (const d of demandas.data ?? []) {
    resultados.push({
      id: d.id,
      tipo: 'demanda',
      titulo: d.nome,
      detalhe: 'Demanda do catálogo',
      href: demandaHref,
    })
  }

  if (profile.role === 'gestor') {
    for (const p of colaboradores.data ?? []) {
      resultados.push({
        id: p.id,
        tipo: 'colaborador',
        titulo: p.nome,
        detalhe: p.role === 'gestor' ? 'Gestor' : 'Colaborador',
        href: '/gestao/equipe/' + p.id,
      })
    }
  }

  return resultados
}
