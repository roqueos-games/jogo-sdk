import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { CAPACIDADES, OPCIONAIS, verificarHost } from '../src/index.js'
import { FN } from '../src/contrato.js'
import { criarHostFalso } from '../src/host/falso.js'
import { criarHostDeDesenvolvimento } from '../src/host/desenvolvimento.js'
import { POSES_POR_SEGUNDO, criarPresenca } from '../src/host/presenca.js'
import { janelaFalsa } from './janela-falsa.js'

const depois = () => new Promise((r) => setTimeout(r, 0))

describe('presenca (0.7.0)', () => {
  test('é opcional, com as seis funções, e o motivo diz que o jogo não vê token', () => {
    const { obrigatoria, forma, porque } = CAPACIDADES.presenca
    assert.equal(obrigatoria, false)
    assert.ok(OPCIONAIS.includes('presenca'))
    assert.deepEqual(forma, {
      entrar: FN,
      pose: FN,
      observar: FN,
      trocarDeMapa: FN,
      sair: FN,
      conectado: FN,
    })
    assert.match(porque, /nunca vê token nem endereço/)
  })

  test('os dois hosts do SDK cumprem o contrato com a presença exigida', () => {
    const dev = criarHostDeDesenvolvimento({ jogoId: 'x', janela: janelaFalsa() })
    assert.deepEqual(verificarHost(criarHostFalso(), { exigidas: ['presenca'] }).problemas, [])
    assert.deepEqual(verificarHost(dev, { exigidas: ['presenca'] }).problemas, [])
    assert.deepEqual(
      verificarHost(criarHostFalso({ presenca: false }), { exigidas: ['presenca'] }).problemas,
      ['falta a capacidade "presenca"'],
    )
  })

  test('host falso: vê só quem está no mesmo mapa, andando, e quem sai some', async () => {
    const host = criarHostFalso({ jogoId: 'runa' })
    const vistos = []
    host.presenca.observar((l) => vistos.push(l))
    assert.deepEqual(vistos, [], 'nunca dentro da própria chamada')
    await host.presenca.entrar({
      mapa: 'greenwood',
      pose: { x: 1, y: 2 },
      aparencia: { cls: 'guardiao' },
    })
    host.disparar('presenca', {
      t: 'entrou',
      id: 'bia',
      nome: 'Bia',
      conta: true,
      mapa: 'greenwood',
      pose: { x: 5, y: 5 },
      aparencia: { cls: 'arcano', cor: '#ff0000' },
    })
    host.disparar('presenca', {
      t: 'entrou',
      id: 'caio',
      nome: 'Caio',
      mapa: 'mistfen',
      pose: { x: 1, y: 1 },
    })
    host.disparar('presenca', { t: 'pose', id: 'bia', pose: { x: 6, y: 5, f: 1.5, m: true } })
    await depois()
    assert.deepEqual(vistos.at(-1), [
      {
        id: 'bia',
        nome: 'Bia',
        conta: true,
        aparencia: { cls: 'arcano', modelo: null, cor: '#ff0000' },
        pose: { x: 6, y: 5, f: 1.5, m: true },
      },
    ])
    host.disparar('presenca', { t: 'saiu', id: 'bia' })
    assert.deepEqual(vistos.at(-1), [])
  })

  test(`o host deixa sair no máximo ${POSES_POR_SEGUNDO} poses por segundo`, async () => {
    let t = 0
    const enviados = []
    const p = criarPresenca({
      eu: () => ({ id: 'eu', nome: 'Eu', conta: false }),
      enviar: (m) => enviados.push(m),
      agora: () => t,
    })
    await p.capacidade.entrar({ mapa: 'town', pose: { x: 1, y: 1 } })
    const aceitas = []
    for (let i = 0; i < 20; i++) {
      t += 40
      aceitas.push(p.capacidade.pose({ x: 1 + i / 10, y: 1 }))
    }
    assert.equal(aceitas.filter(Boolean).length, POSES_POR_SEGUNDO)
    assert.equal(enviados.filter((m) => m.t === 'pose').length, POSES_POR_SEGUNDO)
  })

  test('mapa fora do formato e pose sem números são TypeError na hora', async () => {
    const host = criarHostFalso()
    await assert.rejects(host.presenca.entrar({ mapa: '../x', pose: { x: 1, y: 1 } }), TypeError)
    await assert.rejects(host.presenca.entrar({ mapa: 'town', pose: { x: 'a', y: 1 } }), TypeError)
  })

  test('sem conexão a lista vem vazia, e entrar diz indisponível', async () => {
    const host = criarHostFalso()
    const estados = []
    host.presenca.conectado((v) => estados.push(v))
    await depois()
    host.disparar('presenca', { t: 'conexao', conectado: false })
    assert.deepEqual(estados, [true, false])
    assert.deepEqual(await host.presenca.entrar({ mapa: 'town', pose: { x: 1, y: 1 } }), {
      erro: 'indisponivel',
    })
  })

  test('host de desenvolvimento: duas abas se veem pelo BroadcastChannel', async () => {
    const canais = new Map()
    class CanalFalso {
      constructor(nome) {
        this.nome = nome
        if (!canais.has(nome)) canais.set(nome, new Set())
        canais.get(nome).add(this)
      }
      postMessage(m) {
        for (const c of canais.get(this.nome))
          if (c !== this) c.onmessage?.({ data: structuredClone(m) })
      }
    }
    const aba = () => {
      const janela = janelaFalsa()
      janela.BroadcastChannel = CanalFalso
      return criarHostDeDesenvolvimento({
        jogoId: 'runa',
        janela,
        registro: { info() {}, debug() {}, warn() {} },
      })
    }
    const a = aba()
    const b = aba()
    const vistosPorB = []
    b.presenca.observar((l) => vistosPorB.push(l))
    await b.presenca.entrar({ mapa: 'greenwood', pose: { x: 3, y: 3 } })
    await a.presenca.entrar({ mapa: 'greenwood', pose: { x: 1, y: 1 } })
    a.presenca.pose({ x: 2, y: 1, m: true })
    await depois()
    assert.equal(vistosPorB.at(-1).length, 1)
    assert.deepEqual(vistosPorB.at(-1)[0].pose, { x: 2, y: 1, f: 0, m: true })
    a.presenca.sair()
    assert.deepEqual(vistosPorB.at(-1), [])
  })
})
