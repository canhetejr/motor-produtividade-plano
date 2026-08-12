import { describe, it, expect } from 'vitest'
import { validarNovoEmail, mensagemDeErroDaTrocaDeEmail } from './troca-email'

describe('validarNovoEmail', () => {
  const atual = 'ana@empresa.com'

  it('aceita um endereço novo', () => {
    expect(validarNovoEmail('ana@teralabs.cloud', atual)).toEqual({ ok: true, email: 'ana@teralabs.cloud' })
  })

  it('normaliza espaço e caixa', () => {
    expect(validarNovoEmail('  Ana@Teralabs.Cloud ', atual)).toEqual({
      ok: true,
      email: 'ana@teralabs.cloud',
    })
  })

  // Sem isto, pedir o e-mail que já se tem dispara um e-mail de confirmação
  // inútil e consome o limite de envio do Supabase.
  it('recusa o e-mail atual, ignorando caixa e espaço', () => {
    expect(validarNovoEmail('ANA@empresa.com', atual).ok).toBe(false)
    expect(validarNovoEmail(' ana@empresa.com ', atual).ok).toBe(false)
  })

  it('recusa vazio e entrada que não é texto', () => {
    expect(validarNovoEmail('', atual).ok).toBe(false)
    expect(validarNovoEmail('   ', atual).ok).toBe(false)
    expect(validarNovoEmail(null, atual).ok).toBe(false)
  })

  it.each(['sem-arroba', 'a@b', '@empresa.com', 'ana@', 'a na@empresa.com'])(
    'recusa %s',
    (entrada) => {
      expect(validarNovoEmail(entrada, atual).ok).toBe(false)
    }
  )

  // Endereços legítimos que uma regex "completa" costuma rejeitar por engano.
  it.each(['ana+trabalho@empresa.com.br', "o'neil@empresa.io", 'ana.maria@sub.empresa.com'])(
    'aceita %s',
    (entrada) => {
      expect(validarNovoEmail(entrada, atual).ok).toBe(true)
    }
  )
})

describe('mensagemDeErroDaTrocaDeEmail', () => {
  it('explica o e-mail já usado citando o caso de outra empresa', () => {
    const msg = mensagemDeErroDaTrocaDeEmail('A user with this email address has already been registered')
    expect(msg).toContain('outra conta do Vértice')
    expect(msg).toContain('outra empresa')
  })

  it('reconhece a violação de unicidade vinda do Postgres', () => {
    expect(mensagemDeErroDaTrocaDeEmail('duplicate key value violates unique constraint')).toContain(
      'já está em uso'
    )
  })

  it('explica o limite de envio em vez de sugerir tentar de novo agora', () => {
    expect(mensagemDeErroDaTrocaDeEmail('email rate limit exceeded')).toContain('alguns minutos')
  })

  it('cai numa mensagem acionável para erro desconhecido', () => {
    const msg = mensagemDeErroDaTrocaDeEmail('socket hang up')
    expect(msg.length).toBeGreaterThan(20)
    expect(msg).not.toContain('socket')
  })
})
