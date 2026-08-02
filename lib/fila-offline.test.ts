import { describe, it, expect } from 'vitest'
import {
  triar,
  remover,
  marcarTentativa,
  lerFila,
  contarPendentes,
  MAX_TENTATIVAS,
  type ItemFila,
} from './fila-offline'

const HOJE = '2026-08-02'

const item = (over: Partial<ItemFila> = {}): ItemFila => ({
  id: 'i1',
  data: HOJE,
  usuarioId: 'u1',
  campos: { demanda_id: 'd1', quantidade: '1' },
  tentativas: 0,
  ...over,
})

describe('triar', () => {
  it('envia item de hoje do próprio usuário', () => {
    const { enviar, descartar } = triar([item()], 'u1', HOJE)
    expect(enviar).toHaveLength(1)
    expect(descartar).toHaveLength(0)
  })

  it('descarta item de ontem', () => {
    // A regra "só se lança hoje" recusaria no servidor, ou pior: aceitaria com
    // a data errada.
    const { enviar, descartar } = triar([item({ data: '2026-08-01' })], 'u1', HOJE)
    expect(enviar).toHaveLength(0)
    expect(descartar).toHaveLength(1)
  })

  it('descarta item que esgotou as tentativas', () => {
    const { descartar } = triar([item({ tentativas: MAX_TENTATIVAS })], 'u1', HOJE)
    expect(descartar).toHaveLength(1)
  })

  it('ainda envia na última tentativa possível', () => {
    const { enviar } = triar([item({ tentativas: MAX_TENTATIVAS - 1 })], 'u1', HOJE)
    expect(enviar).toHaveLength(1)
  })

  it('ignora item de outro usuário — nem envia nem descarta', () => {
    // É de outra sessão no mesmo aparelho. Enviar seria lançar apontamento em
    // nome de terceiro; descartar seria apagar o dado de quem não está aqui.
    const { enviar, descartar } = triar([item({ usuarioId: 'u2' })], 'u1', HOJE)
    expect(enviar).toHaveLength(0)
    expect(descartar).toHaveLength(0)
  })

  it('separa corretamente uma fila mista', () => {
    const fila = [
      item({ id: 'ok' }),
      item({ id: 'velho', data: '2026-07-31' }),
      item({ id: 'alheio', usuarioId: 'u2' }),
      item({ id: 'esgotado', tentativas: MAX_TENTATIVAS }),
    ]
    const { enviar, descartar } = triar(fila, 'u1', HOJE)
    expect(enviar.map((i) => i.id)).toEqual(['ok'])
    expect(descartar.map((i) => i.id).sort()).toEqual(['esgotado', 'velho'])
  })
})

describe('remover', () => {
  it('remove os indicados e preserva o resto', () => {
    const fila = [item({ id: 'a' }), item({ id: 'b' })]
    expect(remover(fila, ['a']).map((i) => i.id)).toEqual(['b'])
  })

  it('preserva item de outro usuário', () => {
    const fila = [item({ id: 'a' }), item({ id: 'b', usuarioId: 'u2' })]
    expect(remover(fila, ['a']).map((i) => i.id)).toEqual(['b'])
  })

  it('não altera nada com id inexistente', () => {
    const fila = [item({ id: 'a' })]
    expect(remover(fila, ['zzz'])).toEqual(fila)
  })
})

describe('marcarTentativa', () => {
  it('incrementa só os indicados', () => {
    const fila = [item({ id: 'a' }), item({ id: 'b' })]
    const depois = marcarTentativa(fila, ['a'])
    expect(depois.find((i) => i.id === 'a')!.tentativas).toBe(1)
    expect(depois.find((i) => i.id === 'b')!.tentativas).toBe(0)
  })

  it('não muta a fila original', () => {
    const fila = [item({ id: 'a' })]
    marcarTentativa(fila, ['a'])
    expect(fila[0].tentativas).toBe(0)
  })
})

describe('lerFila', () => {
  it('devolve vazio sem nada salvo', () => {
    expect(lerFila(null)).toEqual([])
  })

  it('não quebra com JSON inválido', () => {
    expect(lerFila('{quebrado')).toEqual([])
  })

  it('descarta item sem usuarioId — não dá para saber de quem é', () => {
    const bruto = JSON.stringify([{ id: 'a', data: HOJE, campos: {}, tentativas: 0 }])
    expect(lerFila(bruto)).toEqual([])
  })

  it('descarta data em formato inesperado', () => {
    const bruto = JSON.stringify([{ ...item(), data: '02/08/2026' }])
    expect(lerFila(bruto)).toEqual([])
  })

  it('mantém os válidos e descarta só os quebrados', () => {
    const bruto = JSON.stringify([item({ id: 'bom' }), { id: 'ruim' }])
    expect(lerFila(bruto).map((i) => i.id)).toEqual(['bom'])
  })
})

describe('contarPendentes', () => {
  it('conta só o que seria enviado', () => {
    const fila = [item({ id: 'a' }), item({ id: 'velho', data: '2026-07-01' }), item({ id: 'alheio', usuarioId: 'u2' })]
    expect(contarPendentes(fila, 'u1', HOJE)).toBe(1)
  })
})
