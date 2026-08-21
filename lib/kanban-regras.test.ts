// A tradução é a única coisa entre uma exceção do Postgres e o toast que a
// pessoa lê. Um código novo no SQL sem entrada aqui não quebra build nem
// teste de fumaça: só devolve "Falha ao mover o card." para todo mundo, e o
// motivo real some.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { PostgrestError } from '@supabase/supabase-js'

import { traduzirRegraCartao } from './kanban-regras'

const erro = (message: string): PostgrestError =>
  ({ message, details: '', hint: '', code: 'P0001', name: 'PostgrestError' }) as PostgrestError

describe('traduzirRegraCartao', () => {
  it('traduz as regras de trigger com o detalhe que o banco mandou', () => {
    expect(traduzirRegraCartao(erro('WIP_EXCEDIDO:3'))).toContain('limite de 3 cards')
    expect(traduzirRegraCartao(erro('PREREQUISITO_PENDENTE:VRT-000004'))).toContain('VRT-000004')
    expect(traduzirRegraCartao(erro('REQUISITO_OBRIGATORIO_PENDENTE:Revisar texto'))).toContain('Revisar texto')
  })

  it('traduz as recusas das RPCs transacionais sem vazar código nem detalhe técnico', () => {
    const casos = [
      'CARTAO_NAO_ENCONTRADO:origem',
      'COLUNA_INVALIDA:destino',
      'QUADRO_DIVERGENTE:destino',
      'NAO_AUTORIZADO:quadro',
      'NAO_AUTENTICADO:sessao',
      'ORDEM_INVALIDA:conteudo',
      'COLUNAS_DESATUALIZADAS:4',
      'RESPONSAVEL_INVALIDO:vinculo',
      'DEMANDA_INVALIDA:catalogo',
      'CENTRO_INVALIDO:area',
      'TITULO_OBRIGATORIO:cartao',
      'DADOS_INVALIDOS:cartao',
      'ORGANIZACAO_INATIVA:conta',
    ]
    for (const bruto of casos) {
      const traduzido = traduzirRegraCartao(erro(bruto))
      expect(traduzido, bruto).toBeTruthy()
      // Nada de CÓDIGO_EM_CAIXA_ALTA nem de `:detalhe` chegando à tela: o
      // detalhe existe para o log do Postgres, não para a pessoa.
      expect(traduzido, bruto).not.toMatch(/[A-Z]{3,}_[A-Z]/)
      expect(traduzido, bruto).not.toContain(':' + bruto.split(':')[1])
    }
  })

  it('acha o código mesmo com o prefixo que o driver anexa', () => {
    const bruto =
      'PostgrestException: erro ao executar kanban_mover_cartao: WIP_EXCEDIDO:2\nCONTEXT: PL/pgSQL function'
    expect(traduzirRegraCartao(erro(bruto))).toContain('limite de 2 cards')
  })

  it('devolve null para falha que não é regra de domínio', () => {
    expect(traduzirRegraCartao(erro('could not connect to server'))).toBeNull()
    expect(traduzirRegraCartao(null)).toBeNull()
  })
})

// A lista de códigos do SQL e a do TypeScript são dois arquivos que precisam
// concordar. Este caso lê a migration e cobra a tradução de cada código que
// ela levanta — é o que impede o par de sair de sincronia numa migration
// futura.
describe('cobertura dos códigos levantados pela migration', () => {
  const migration = readFileSync(
    fileURLToPath(new URL('../supabase/migrations/20260820213000_kanban_movimentacao_atomica.sql', import.meta.url)),
    'utf8'
  )

  it('toda `raise exception` da migration tem tradução em pt-BR', () => {
    const codigos = [...migration.matchAll(/raise exception '([A-Z_]+)/g)].map((m) => m[1])
    expect(codigos.length).toBeGreaterThan(8)

    const semTraducao = [...new Set(codigos)].filter((codigo) => traduzirRegraCartao(erro(`${codigo}:x`)) === null)
    expect(semTraducao).toEqual([])
  })
})
