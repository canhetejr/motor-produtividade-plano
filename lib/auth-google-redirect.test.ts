import { describe, expect, it } from 'vitest'

import { urlCallbackLoginGoogle } from './auth-google-redirect'

describe('urlCallbackLoginGoogle', () => {
  it('manda o OAuth para Minha semana após a autenticação', () => {
    expect(urlCallbackLoginGoogle('https://vertice.teralabs.cloud')).toBe(
      'https://vertice.teralabs.cloud/auth/callback?next=/minha-semana'
    )
  })
})
