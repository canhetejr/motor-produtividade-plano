// A separação entre /perfil e /configuracoes é uma decisão de produto que o
// código não expressa sozinho: nada quebra se um bloco voltar para a tela
// errada, ou — pior — se ele acabar nas duas, com dois formulários salvando a
// mesma preferência.
//
// O que este teste trava é a divisão em si e o que ela não pode perder: cada
// bloco existe em exatamente uma das duas telas.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const ler = (caminho: string) => readFileSync(fileURLToPath(new URL(caminho, import.meta.url)), 'utf8')

const perfilPage = ler('../perfil/page.tsx')
const perfilManager = ler('../perfil/perfil-manager.tsx')
const configPage = ler('./page.tsx')
const configManager = ler('./configuracoes-manager.tsx')

const perfil = perfilPage + perfilManager
const configuracoes = configPage + configManager

describe('divisão entre Perfil e Configurações', () => {
  // Identidade e credencial: quem a pessoa é e como ela prova.
  it.each([
    ['o formulário de nome', 'updateMeuNome'],
    ['o avatar', 'updateMeuAvatar'],
    ['a troca de senha', 'updateMinhaSenha'],
    ['o segundo fator', 'MfaToggle'],
    ['o e-mail de acesso', 'EmailCard'],
    // Decisão registrada: token de API é credencial de acesso à conta, da
    // mesma família de senha e segundo fator.
    ['os tokens MCP', 'McpTokensManager'],
  ])('%s fica no Perfil', (_, marcador) => {
    expect(perfil).toContain(marcador)
    expect(configuracoes).not.toContain(marcador)
  })

  // Preferência e integração: como o sistema se comporta para a pessoa.
  it.each([
    ['as notificações', 'updateMinhasNotificacoes'],
    ['as animações', 'AnimacoesToggle'],
    ['as partículas', 'ParticulasToggle'],
    ['as bordas', 'BordasToggle'],
    ['a cor', 'CorToggle'],
    ['o push', 'AtivarPush'],
    ['o Google Workspace', 'google/connect'],
    ['o calendário .ics', 'api/calendario'],
  ])('%s fica em Configurações', (_, marcador) => {
    expect(configuracoes).toContain(marcador)
    expect(perfil).not.toContain(marcador)
  })

  // Sem isto, quem procurar uma preferência no Perfil (onde ela esteve por
  // mais de um ano) fica sem saída.
  it('as duas telas apontam uma para a outra', () => {
    expect(perfilPage).toContain('/configuracoes')
    expect(configPage).toContain('/perfil')
  })
})
