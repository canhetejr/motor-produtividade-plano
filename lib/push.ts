import webpush from 'web-push'

import { createAdminClient } from '@/utils/supabase/admin'

/**
 * Notificação push (Web Push / VAPID).
 *
 * O par de chaves vive no banco, não em variável de ambiente — ver o comentário
 * da migration 20260802210000. É gerado na primeira vez que alguém liga o push
 * e nunca passa pela mão de ninguém.
 */

export type Assinatura = {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

type ConfigPush = { chavePublica: string; chavePrivada: string; assunto: string }

/**
 * Lê a configuração, gerando o par na primeira chamada.
 *
 * O `id` é uma coluna booleana com check — a tabela tem no máximo uma linha, e o
 * upsert com `ignoreDuplicates` faz duas chamadas simultâneas convergirem para o
 * mesmo par em vez de uma sobrescrever a outra e invalidar as inscrições já
 * feitas com a chave anterior.
 */
export async function obterConfigPush(): Promise<ConfigPush | null> {
  const admin = createAdminClient()

  const { data } = await admin
    .from('config_push')
    .select('chave_publica, chave_privada, assunto')
    .maybeSingle()

  if (data) {
    return {
      chavePublica: data.chave_publica,
      chavePrivada: data.chave_privada,
      assunto: data.assunto,
    }
  }

  const novo = webpush.generateVAPIDKeys()
  const { error } = await admin
    .from('config_push')
    .upsert(
      { id: true, chave_publica: novo.publicKey, chave_privada: novo.privateKey },
      { onConflict: 'id', ignoreDuplicates: true }
    )
  if (error) {
    console.error('Falha ao gravar chaves VAPID: code=%s message=%s', error.code, error.message)
    return null
  }

  // Relê em vez de devolver o que acabei de gerar: se outra requisição criou a
  // linha primeiro, o par válido é o dela, e devolver o meu geraria inscrições
  // que nenhum envio consegue usar.
  const { data: gravado } = await admin
    .from('config_push')
    .select('chave_publica, chave_privada, assunto')
    .maybeSingle()

  return gravado
    ? {
        chavePublica: gravado.chave_publica,
        chavePrivada: gravado.chave_privada,
        assunto: gravado.assunto,
      }
    : null
}

export type ResultadoEnvio = {
  enviadas: number
  /** Endpoints que o navegador descartou — 404/410 significa inscrição morta. */
  invalidas: string[]
  falhas: number
}

/**
 * Envia para todas as inscrições de uma pessoa.
 *
 * Best-effort, como o resto das notificações: um push que não sai não pode
 * derrubar a ação que o gerou.
 */
export async function enviarPush(
  colaboradorId: string,
  payload: { titulo: string; mensagem: string; link?: string }
): Promise<ResultadoEnvio> {
  const vazio: ResultadoEnvio = { enviadas: 0, invalidas: [], falhas: 0 }

  const config = await obterConfigPush()
  if (!config) return vazio

  const admin = createAdminClient()
  const { data: inscricoes } = await admin
    .from('push_inscricoes')
    .select('endpoint, p256dh, auth')
    .eq('colaborador_id', colaboradorId)
    .is('invalida_em', null)

  if (!inscricoes || inscricoes.length === 0) return vazio

  webpush.setVapidDetails(config.assunto, config.chavePublica, config.chavePrivada)

  const corpo = JSON.stringify(payload)
  const resultado: ResultadoEnvio = { enviadas: 0, invalidas: [], falhas: 0 }

  await Promise.all(
    inscricoes.map(async (i) => {
      try {
        await webpush.sendNotification(
          { endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } },
          corpo
        )
        resultado.enviadas++
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode
        // 404/410: o navegador descartou a inscrição (reinstalação, limpeza de
        // dados). Insistir nela para sempre acumularia lixo e ruído no log.
        if (status === 404 || status === 410) resultado.invalidas.push(i.endpoint)
        else resultado.falhas++
      }
    })
  )

  if (resultado.invalidas.length > 0) {
    await admin
      .from('push_inscricoes')
      .update({ invalida_em: new Date().toISOString() })
      .in('endpoint', resultado.invalidas)
  }

  return resultado
}
