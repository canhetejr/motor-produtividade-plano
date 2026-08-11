import { describe, expect, it } from 'vitest'
import { validarNovaSenha } from './recuperacao-senha'

describe('validarNovaSenha', () => {
  it('informa quando a confirmação não coincide com a nova senha', () => {
    expect(validarNovaSenha('senha-segura', 'senha-diferente')).toEqual({
      valida: false,
      mensagem: 'As senhas não coincidem.',
    })
  })
})
