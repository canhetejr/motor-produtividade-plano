import { describe, expect, it } from 'vitest'

import { urlRedefinicaoSenha } from './auth-recovery-redirect'

describe('urlRedefinicaoSenha', () => {
  it('usa a rota própria de recuperação na origem pública atual', () => {
    expect(urlRedefinicaoSenha('https://vertice.teralabs.cloud')).toBe(
      'https://vertice.teralabs.cloud/auth/redefinir-senha',
    )
  })

  it('remove a barra final da origem', () => {
    expect(urlRedefinicaoSenha('https://vertice.teralabs.cloud/')).toBe(
      'https://vertice.teralabs.cloud/auth/redefinir-senha',
    )
  })
})
