import { describe, expect, it } from 'vitest'
import { deveBloquearAteTrocarSenha } from './troca-senha-obrigatoria'

describe('deveBloquearAteTrocarSenha', () => {
  it('bloqueia o app quando a conta tem troca inicial ou reset pendente', () => {
    expect(deveBloquearAteTrocarSenha(true)).toBe(true)
  })

  it('libera o app depois que a troca obrigatória foi concluída', () => {
    expect(deveBloquearAteTrocarSenha(false)).toBe(false)
  })
})
