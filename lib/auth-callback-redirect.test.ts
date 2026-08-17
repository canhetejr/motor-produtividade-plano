import { describe, expect, it } from 'vitest'

import { urlDestinoCallbackOauth } from './auth-callback-redirect'

describe('urlDestinoCallbackOauth', () => {
  it('preserva o domínio público quando o callback chega pela origem interna do container', () => {
    const request = new Request('http://0.0.0.0:3000/auth/callback?code=abc&next=/apontamento', {
      headers: {
        'x-forwarded-host': 'vertice.teralabs.cloud',
        'x-forwarded-proto': 'https',
      },
    })

    expect(urlDestinoCallbackOauth(request, '/apontamento').toString()).toBe(
      'https://vertice.teralabs.cloud/apontamento'
    )
  })
})
