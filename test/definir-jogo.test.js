import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { definirJogo } from '../src/index.js'
import { criarHostFalso } from '../src/host/falso.js'

const el = {}

function jogoQueConta() {
  const log = []
  const jogo = definirJogo({
    id: 'contador',
    montar(alvo, host, opcoes) {
      log.push(['montar', opcoes])
      return {
        ativar: (sim) => log.push(['ativar', sim]),
        desmontar: () => log.push(['desmontar']),
      }
    },
  })
  return { jogo, log }
}

describe('definirJogo', () => {
  test('id fora do formato é recusado na hora, não em runtime', () => {
    assert.throws(() => definirJogo({ id: 'Jogo-2', montar() {} }), /id de jogo inválido/)
    assert.throws(() => definirJogo({ id: '2048', montar() {} }), /id de jogo inválido/)
    assert.doesNotThrow(() => definirJogo({ id: 'game2048', montar() {} }))
  })

  test('sem montar não é jogo', () => {
    assert.throws(() => definirJogo({ id: 'x' }), /precisa de montar/)
  })

  test('mount num host incompleto falha com a lista do que falta', () => {
    const { jogo } = jogoQueConta()
    const host = criarHostFalso()
    delete host.placar
    assert.throws(
      () => jogo.mount(el, host),
      /host não cumpre o contrato: falta a capacidade "placar"/,
    )
  })

  test('mount entrega windowId e ativo, com padrão quando o host não diz', () => {
    const { jogo, log } = jogoQueConta()
    jogo.mount(el, criarHostFalso())
    jogo.mount(el, criarHostFalso(), { windowId: 'w1', ativo: false })
    assert.deepEqual(log[0], ['montar', { windowId: null, ativo: true }])
    assert.deepEqual(log[1], ['montar', { windowId: 'w1', ativo: false }])
  })

  test('desmontar duas vezes desmonta uma, e ativar depois não faz nada', () => {
    const { jogo, log } = jogoQueConta()
    const m = jogo.mount(el, criarHostFalso())
    m.ativar(1)
    m.desmontar()
    m.desmontar()
    m.ativar(true)
    assert.deepEqual(
      log.map((l) => l[0]),
      ['montar', 'ativar', 'desmontar'],
    )
    assert.equal(log[1][1], true, 'ativar recebe booleano, não o que veio')
  })

  test('montar que não devolve { desmontar } é erro do jogo', () => {
    const jogo = definirJogo({ id: 'vazio', montar: () => ({}) })
    assert.throws(() => jogo.mount(el, criarHostFalso()), /precisa devolver/)
  })

  test('sem elemento não monta', () => {
    const { jogo } = jogoQueConta()
    assert.throws(() => jogo.mount(null, criarHostFalso()), /elemento/)
  })

  test('jogo que exige IA não monta em host sem IA', () => {
    const jogo = definirJogo({
      id: 'falante',
      capacidades: ['ia'],
      montar: () => ({ desmontar() {} }),
    })
    assert.throws(() => jogo.mount(el, criarHostFalso()), /"ia"/)
    assert.doesNotThrow(() => jogo.mount(el, criarHostFalso({ ia: async () => 'oi' })))
  })
})
