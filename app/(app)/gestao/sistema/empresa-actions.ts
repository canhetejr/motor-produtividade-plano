'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { registrarAuditoria } from '@/lib/auditoria'
import { mensagemDeErroDoBanco } from '@/lib/supabase-error'
import { validarNomeEmpresa, mensagemDeErroDaPropriedade } from '@/lib/organizacao-dono'
import type { ActionResult } from '@/lib/action-result'

// requireAdmin e não requireDono: a aba "Empresa" é visível para todo admin
// (com os botões desabilitados para quem não é dono), e o gate real de quem
// pode escrever é a RPC — ela compara auth.uid() com
// organizacoes.dono_colaborador_id dentro do banco. Duplicar aqui uma
// checagem de dono seria uma segunda fonte de verdade que pode divergir; o
// guard daqui só barra quem nem admin é.

export async function atualizarNomeEmpresa(formData: FormData): Promise<ActionResult> {
  const { user, profile } = await requireAdmin()
  const supabase = await createClient()

  const validado = validarNomeEmpresa(formData.get('nome'))
  if (!validado.ok) {
    return { ok: false, error: validado.erro }
  }

  const nomeAntes = profile.organizacoes?.nome ?? null
  if (nomeAntes === validado.nome) {
    return { ok: true }
  }

  const { error } = await supabase.rpc('atualizar_nome_organizacao', { p_nome: validado.nome })
  if (error) {
    console.error('Erro ao atualizar nome da empresa:', error)
    return {
      ok: false,
      error:
        mensagemDeErroDaPropriedade(error.message) ??
        mensagemDeErroDoBanco(error) ??
        'Não foi possível salvar o nome da empresa. Tente de novo.',
    }
  }

  await registrarAuditoria(
    {
      atorId: user.id,
      acao: 'organizacao.atualizar_nome',
      entidade: 'organizacoes',
      entidadeId: profile.organizacao_id ?? undefined,
      antes: { nome: nomeAntes },
      depois: { nome: validado.nome },
    },
    profile.organizacao_id!
  )

  // O nome da empresa aparece no cabeçalho de todas as telas autenticadas, não
  // só nesta — revalidar só /gestao/sistema deixaria o nome antigo no resto do
  // app até a próxima navegação dura.
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function transferirPropriedade(novoDonoId: string): Promise<ActionResult> {
  const { user, profile } = await requireAdmin()
  const supabase = await createClient()

  if (typeof novoDonoId !== 'string' || novoDonoId === '') {
    return { ok: false, error: 'Escolha para quem transferir a propriedade' }
  }

  const { error } = await supabase.rpc('transferir_propriedade_organizacao', {
    p_novo_dono_id: novoDonoId,
  })
  if (error) {
    console.error('Erro ao transferir propriedade da empresa:', error)
    return {
      ok: false,
      error:
        mensagemDeErroDaPropriedade(error.message) ??
        mensagemDeErroDoBanco(error) ??
        'Não foi possível transferir a propriedade. Tente de novo.',
    }
  }

  // O evento mais sensível do domínio: quem transferiu perde, na mesma
  // operação, o poder de desfazer sozinho.
  await registrarAuditoria(
    {
      atorId: user.id,
      acao: 'organizacao.transferir_propriedade',
      entidade: 'organizacoes',
      entidadeId: profile.organizacao_id ?? undefined,
      antes: { dono_colaborador_id: user.id },
      depois: { dono_colaborador_id: novoDonoId },
    },
    profile.organizacao_id!
  )

  revalidatePath('/', 'layout')
  return { ok: true }
}
