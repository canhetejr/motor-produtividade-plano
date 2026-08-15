import 'server-only'
import { createAdminClient } from '@/utils/supabase/admin'
import { aplicarVariaveis, variaveisDeCampos } from '@/lib/variaveis'
import { formatarDataHoraBR } from '@/lib/dates'
import { textoParaHtml } from '@/lib/rich-text'
import type { ActionResult } from '@/lib/action-result'
import type { PrioridadeCartao } from '@/lib/database.types'

type AdminClient = ReturnType<typeof createAdminClient>

/**
 * Busca um formulário ativo com seus campos, pelo mesmo formato usado tanto
 * pela submissão pública (por slug) quanto pelo webhook (por id resolvido
 * do token). Sempre roda com o client admin: quem chama já decidiu que não
 * há sessão pra RLS avaliar (visitante anônimo ou requisição autenticada
 * por Bearer token, não por cookie).
 */
export async function buscarFormularioAtivoComCampos(admin: AdminClient, filtro: { slug: string } | { id: string }) {
  const query = admin.from('formularios').select('*, formularios_campos(*)').eq('ativo', true)
  return 'slug' in filtro ? query.eq('slug', filtro.slug).maybeSingle() : query.eq('id', filtro.id).maybeSingle()
}

type FormularioComCampos = NonNullable<Awaited<ReturnType<typeof buscarFormularioAtivoComCampos>>['data']>

/**
 * Núcleo de "respostas -> cartão novo", compartilhado pela submissão pública
 * (app/(app)/kanban/actions.ts::submeterFormulario) e pelo webhook
 * (app/api/webhooks/formularios/route.ts) — mesma regra de negócio, só muda
 * como o chamador prova que pode acioná-la. Nunca chame direto de uma rota
 * sem antes confirmar (slug+ativo, ou token do webhook) que quem está
 * chamando tem permissão.
 */
export async function criarCartaoDeFormulario(
  admin: AdminClient,
  formulario: FormularioComCampos,
  respostas: Record<string, string>
): Promise<ActionResult<{ cartaoId: string; mensagemSucesso: string }>> {
  const campos = (formulario.formularios_campos ?? []).sort((a, b) => a.posicao - b.posicao)

  const faltando = campos.filter((c) => c.obrigatorio && !respostas[c.id]?.trim()).map((c) => c.rotulo)
  if (faltando.length > 0) {
    return { ok: false, error: `Campos obrigatórios não preenchidos: ${faltando.join(', ')}` }
  }

  // Valores das variáveis: uma entrada por pergunta (chave derivada do
  // rótulo, ver `variaveisDeCampos`) mais as fixas do formulário. O casamento
  // resposta ↔ chave é por ÍNDICE, então `campos` precisa estar na mesma
  // ordem que o builder mostrou — daí o sort por posição acima.
  const variaveisCampos = variaveisDeCampos(campos)
  const valores: Record<string, string> = {}
  campos.forEach((campo, i) => {
    valores[variaveisCampos[i].chave] = respostas[campo.id]?.trim() ?? ''
  })
  valores.formulario = formulario.titulo
  valores.enviado_em = formatarDataHoraBR(new Date())
  valores.todas_respostas = campos
    .map((campo) => `${campo.rotulo}: ${respostas[campo.id]?.trim() || '(não respondido)'}`)
    .join('\n')

  const campoTitulo = campos.find((c) => c.mapeado_para === 'titulo')
  const campoPrimeiroTexto = campos.find((c) => c.tipo === 'texto')
  // Modelo tem precedência; sem modelo (ou quando ele resolve pra vazio, caso
  // de um formulário cujas variáveis vieram todas em branco) vale a regra
  // antiga: campo marcado como título → primeiro campo de texto → genérico.
  let titulo =
    aplicarVariaveis(formulario.titulo_template, valores).trim() ||
    (campoTitulo && respostas[campoTitulo.id]?.trim()) ||
    (campoPrimeiroTexto && respostas[campoPrimeiroTexto.id]?.trim()) ||
    `Nova solicitação via ${formulario.titulo}`
  if (titulo.length > 150) titulo = titulo.slice(0, 150) + '...'

  const campoPrioridade = campos.find((c) => c.mapeado_para === 'prioridade' || c.tipo === 'prioridade')
  const valorPrioridade = campoPrioridade ? respostas[campoPrioridade.id] : undefined
  const prioridade: PrioridadeCartao =
    valorPrioridade === 'baixa' || valorPrioridade === 'alta' ? valorPrioridade : 'media'

  const campoPrazo = campos.find((c) => c.mapeado_para === 'prazo' || c.tipo === 'data')
  const valorPrazo = campoPrazo ? respostas[campoPrazo.id]?.trim() : undefined
  const prazo = valorPrazo && !isNaN(Date.parse(valorPrazo)) ? valorPrazo : null

  const descricaoPadrao = [
    `Enviado via formulário "${formulario.titulo}" em ${valores.enviado_em}.`,
    '',
    valores.todas_respostas,
  ].join('\n')
  const descricaoTexto = formulario.descricao_template
    ? aplicarVariaveis(formulario.descricao_template, valores)
    : descricaoPadrao
  // A descrição do card vira HTML renderizado, e estas respostas vêm de fora
  // de qualquer sessão (visitante deslogado no formulário público, ou
  // automação externa no webhook) — passar texto cru aqui daria XSS
  // armazenado, disparando no navegador de quem abrisse o card. textoParaHtml
  // escapa tudo e só depois monta os parágrafos. Vale igual para o modelo:
  // as variáveis carregam texto de fora.
  const descricaoHtml = textoParaHtml(descricaoTexto)

  const { count } = await admin
    .from('cartoes')
    .select('id', { count: 'exact', head: true })
    .eq('coluna_id', formulario.coluna_id)

  const { data: novoCartao, error: cartaoError } = await admin
    .from('cartoes')
    .insert({
      coluna_id: formulario.coluna_id,
      codigo: '', // sobrescrito por tr_gerar_codigo_cartao (BEFORE INSERT)
      titulo,
      descricao: descricaoHtml,
      prioridade,
      prazo,
      posicao: count ?? 0,
      criado_por: null,
      organizacao_id: formulario.organizacao_id,
    })
    .select('id')
    .single()

  if (cartaoError || !novoCartao) {
    console.error('Erro ao criar card via formulário:', cartaoError)
    return { ok: false, error: 'Falha ao processar a solicitação. Tente novamente em instantes.' }
  }

  // A mensagem de sucesso volta resolvida daqui: "Obrigado, {{seu_nome}}" só
  // existe depois que as respostas chegaram.
  return {
    ok: true,
    data: {
      cartaoId: novoCartao.id,
      mensagemSucesso: aplicarVariaveis(formulario.mensagem_sucesso, valores),
    },
  }
}
