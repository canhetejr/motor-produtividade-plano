'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import type { ActionResult } from '@/lib/action-result'
import type { Anexo } from './[quadroId]/types'

// Bucket privado "anexos-cartoes" — mesmo raciocínio de updateMeuAvatar em
// perfil/actions.ts: quem decide o path é o código do servidor (client
// admin), então não precisa de policy de storage.objects. Diferente do
// avatar (bucket público), aqui a leitura usa signed URL de curta duração.
// Path: "{organizacao_id}/{cartao_id}/{arquivo}" — o client admin aqui só
// toca storage.objects, nunca tabela de negócio diretamente: toda consulta a
// `cartoes`/`cartoes_anexos` usa o client normal (RLS), e é isso que garante
// a organização ANTES de qualquer upload ou signed URL — uma vez assinada,
// a URL é acesso puro, sem checagem nenhuma a jusante.

const ANEXO_MAX_BYTES = 15 * 1024 * 1024
const SIGNED_URL_TTL_SEGUNDOS = 60 * 10

export async function enviarAnexo(cartaoId: string, quadroId: string, formData: FormData): Promise<ActionResult> {
  const { user } = await requireUser()
  const supabase = await createClient()

  const file = formData.get('arquivo')
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Selecione um arquivo.' }
  }
  if (file.size > ANEXO_MAX_BYTES) {
    return { ok: false, error: 'Arquivo muito grande (máximo 15MB).' }
  }

  // Confere que o cartão existe e é visível para quem está enviando ANTES de
  // tocar o storage: esta consulta passa pelo client normal (RLS), então é
  // aqui — e não no client admin — que a organização é verificada. A
  // organizacao_id devolvida é a fonte confiável do path, nunca algo que o
  // chamador poderia influenciar.
  const { data: cartao, error: cartaoError } = await supabase
    .from('cartoes')
    .select('organizacao_id')
    .eq('id', cartaoId)
    .single()
  if (cartaoError || !cartao) return { ok: false, error: 'Cartão não encontrado.' }

  let admin
  try {
    admin = createAdminClient()
  } catch {
    return { ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor — necessária para enviar anexos.' }
  }

  const path = `${cartao.organizacao_id}/${cartaoId}/${Date.now()}-${file.name}`
  const { error: uploadError } = await admin.storage
    .from('anexos-cartoes')
    .upload(path, file, { contentType: file.type || 'application/octet-stream' })
  if (uploadError) {
    console.error('Erro ao enviar anexo:', uploadError.message)
    return { ok: false, error: 'Falha ao enviar o arquivo.' }
  }

  const { error } = await supabase.from('cartoes_anexos').insert({
    cartao_id: cartaoId,
    colaborador_id: user.id,
    nome_arquivo: file.name,
    caminho_storage: path,
    tamanho_bytes: file.size,
    tipo_mime: file.type || 'application/octet-stream',
    organizacao_id: cartao.organizacao_id,
  })
  if (error) {
    await admin.storage.from('anexos-cartoes').remove([path])
    return { ok: false, error: 'Falha ao registrar o anexo.' }
  }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}

export async function listarAnexos(cartaoId: string): Promise<ActionResult<Anexo[]>> {
  await requireUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('cartoes_anexos')
    .select('id, nome_arquivo, tamanho_bytes, tipo_mime, created_at, colaboradores(nome)')
    .eq('cartao_id', cartaoId)
    .order('created_at', { ascending: false })

  if (error) return { ok: false, error: 'Falha ao carregar os anexos.' }

  const anexos: Anexo[] = (data ?? []).map((a) => ({
    id: a.id,
    nomeArquivo: a.nome_arquivo,
    tamanhoBytes: a.tamanho_bytes,
    tipoMime: a.tipo_mime,
    colaboradorNome: (a.colaboradores as unknown as { nome: string } | null)?.nome ?? null,
    criadoEm: a.created_at,
  }))

  return { ok: true, data: anexos }
}

export async function obterUrlAnexo(anexoId: string): Promise<ActionResult<{ url: string }>> {
  await requireUser()
  const supabase = await createClient()

  const { data: anexo, error } = await supabase
    .from('cartoes_anexos')
    .select('caminho_storage')
    .eq('id', anexoId)
    .single()
  if (error || !anexo) return { ok: false, error: 'Anexo não encontrado.' }

  let admin
  try {
    admin = createAdminClient()
  } catch {
    return { ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.' }
  }

  const { data: signed, error: signedError } = await admin.storage
    .from('anexos-cartoes')
    .createSignedUrl(anexo.caminho_storage, SIGNED_URL_TTL_SEGUNDOS)
  if (signedError || !signed) return { ok: false, error: 'Falha ao gerar o link do anexo.' }

  return { ok: true, data: { url: signed.signedUrl } }
}

export async function excluirAnexo(anexoId: string, quadroId: string): Promise<ActionResult> {
  const { user, profile } = await requireUser()
  const supabase = await createClient()

  const { data: anexo, error: fetchError } = await supabase
    .from('cartoes_anexos')
    .select('colaborador_id, caminho_storage')
    .eq('id', anexoId)
    .single()
  if (fetchError || !anexo) return { ok: false, error: 'Anexo não encontrado.' }
  if (anexo.colaborador_id !== user.id && profile.role !== 'gestor') {
    return { ok: false, error: 'Você só pode excluir os próprios anexos.' }
  }

  const { error } = await supabase.from('cartoes_anexos').delete().eq('id', anexoId)
  if (error) return { ok: false, error: 'Falha ao excluir o anexo.' }

  try {
    const admin = createAdminClient()
    await admin.storage.from('anexos-cartoes').remove([anexo.caminho_storage])
  } catch {
    // Best-effort: se o admin client não estiver configurado, o registro já
    // foi removido — o arquivo órfão no bucket não bloqueia o usuário.
  }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}
