import { describe, expect, it } from 'vitest'
import { resolverSenhaInicial } from './senha-inicial-padrao'

describe('resolverSenhaInicial', () => {
  it('prioriza a senha informada manualmente no cadastro', () => {
    expect(resolverSenhaInicial('manual-segura', 'padrao-configurado')).toEqual({ senha: 'manual-segura' })
  })

  it('usa a senha padrão configurada quando o cadastro não informa uma', () => {
    expect(resolverSenhaInicial('', 'padrao-configurado')).toEqual({ senha: 'padrao-configurado' })
  })

  it('recusa cadastro sem senha quando não há padrão configurado', () => {
    expect(resolverSenhaInicial('', null)).toEqual({ erro: 'Defina a senha padrão no Console Admin ou informe uma senha temporária.' })
  })
})
