import { describe, it, expect } from 'vitest'
import { validarNomeEmpresa, mensagemDeErroDaPropriedade, NOME_EMPRESA_MAX } from './organizacao-dono'

describe('validarNomeEmpresa', () => {
  it('aceita um nome comum', () => {
    expect(validarNomeEmpresa('Teralabs')).toEqual({ ok: true, nome: 'Teralabs' })
  })

  it('remove espaço nas pontas', () => {
    expect(validarNomeEmpresa('  Teralabs  ')).toEqual({ ok: true, nome: 'Teralabs' })
  })

  // Duas grafias da mesma empresa aparecem lado a lado no e-mail de convite e
  // no rodapé — colapsar o espaço interno evita esse par.
  it('colapsa espaço interno repetido', () => {
    expect(validarNomeEmpresa('Tera   Labs')).toEqual({ ok: true, nome: 'Tera Labs' })
  })

  it('recusa nome vazio ou só espaço', () => {
    expect(validarNomeEmpresa('')).toEqual({ ok: false, erro: expect.stringContaining('branco') })
    expect(validarNomeEmpresa('   ')).toEqual({ ok: false, erro: expect.stringContaining('branco') })
  })

  it('recusa entrada que não é texto', () => {
    expect(validarNomeEmpresa(null).ok).toBe(false)
    expect(validarNomeEmpresa(undefined).ok).toBe(false)
    expect(validarNomeEmpresa(42).ok).toBe(false)
  })

  it('recusa acima do limite, mas aceita exatamente no limite', () => {
    expect(validarNomeEmpresa('a'.repeat(NOME_EMPRESA_MAX)).ok).toBe(true)
    expect(validarNomeEmpresa('a'.repeat(NOME_EMPRESA_MAX + 1)).ok).toBe(false)
  })
})

describe('mensagemDeErroDaPropriedade', () => {
  // As mensagens cruas do Postgres chegam prefixadas pelo próprio texto da
  // exceção — o teste usa o formato real, não só o código nu.
  it.each([
    ['APENAS_DONO: só o dono da empresa pode editar o nome dela', 'dono da empresa'],
    ['JA_E_DONO: esta pessoa já é a dona da empresa', 'já é a dona'],
    ['COLABORADOR_INVALIDO: a pessoa escolhida não pertence a esta empresa', 'não pertence'],
    ['COLABORADOR_INATIVO: a pessoa escolhida está desativada', 'desativada'],
    ['NAO_E_GESTOR: promova a pessoa a gestor antes de transferir a propriedade', 'gestor'],
    ['DONO_NAO_PODE_PERDER_ADMIN: transfira a propriedade', 'Transfira a propriedade'],
    ['DONO_NAO_PODE_SER_DESATIVADO: transfira a propriedade', 'Transfira a propriedade'],
  ])('traduz %s', (cru, trecho) => {
    expect(mensagemDeErroDaPropriedade(cru)).toContain(trecho)
  })

  it('devolve null para erro que não é desta família', () => {
    expect(mensagemDeErroDaPropriedade('connection refused')).toBeNull()
    expect(mensagemDeErroDaPropriedade(undefined)).toBeNull()
  })
})
