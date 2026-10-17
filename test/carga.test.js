import { describe, test as it } from 'node:test'
import assert from 'node:assert/strict'
import { criarCarga, calcularProgresso } from '../src/carga.js'

const relogioParado = () => {
  const r = { fila: [], setTimeout: (f) => (r.fila.push(f), r.fila.length), clearTimeout() {} }
  return r
}
const adiada = () => {
  let resolver, rejeitar
  const p = new Promise((a, b) => ((resolver = a), (rejeitar = b)))
  return { p, resolver, rejeitar }
}
const vez = () => new Promise((r) => setTimeout(r, 0))

describe('o progresso da carga', () => {
  it('etapas pesam igual e os arquivos enchem a que falta, sem fechá-la', () => {
    assert.equal(calcularProgresso({ feitas: 0, total: 2 }), 0)
    assert.equal(calcularProgresso({ feitas: 1, total: 2 }), 0.5)
    assert.equal(calcularProgresso({ feitas: 1, total: 2, itensFeitos: 5, itensTotal: 10 }), 0.75)
    assert.ok(calcularProgresso({ feitas: 0, total: 1, itensFeitos: 10, itensTotal: 10 }) < 1)
    assert.equal(calcularProgresso({ feitas: 2, total: 2 }), 1)
  })

  it('fecha quando todas as etapas acabam, inclusive a que falhou', async () => {
    const c = criarCarga({ relogio: relogioParado() })
    const mesa = adiada()
    const bar = adiada()
    c.etapa('mesa', mesa.p)
    c.etapa('bar', bar.p)
    assert.equal(c.etapaAtual(), 'mesa')
    mesa.resolver()
    await vez()
    assert.equal(c.fechada(), false)
    assert.equal(c.etapaAtual(), 'bar')
    assert.equal(c.progresso(), 0.5)
    bar.rejeitar(new Error('sem rede'))
    await c.pronto
    assert.equal(c.fechada(), true)
    assert.equal(c.progresso(), 1)
  })

  it('o número só sobe, mesmo com arquivo novo entrando na fila', () => {
    const manager = {}
    const c = criarCarga({ manager, relogio: relogioParado() })
    c.etapa('mesa', new Promise(() => {}))
    manager.onProgress('a', 8, 10)
    const antes = c.progresso()
    manager.onProgress('b', 8, 30)
    assert.equal(c.progresso(), antes)
  })

  it('não segura a tela para sempre: o teto fecha', async () => {
    const r = relogioParado()
    const c = criarCarga({ relogio: r })
    c.etapa('bar', new Promise(() => {}))
    r.fila[0]()
    await c.pronto
    assert.equal(c.fechada(), true)
  })

  it('devolve o LoadingManager do three como estava', async () => {
    const chamadas = []
    const original = (u) => chamadas.push(u)
    const manager = { onProgress: original }
    const c = criarCarga({ manager, relogio: relogioParado() })
    manager.onProgress('x', 1, 2)
    assert.deepEqual(chamadas, ['x'])
    c.etapa('mesa', Promise.resolve())
    await c.pronto
    assert.equal(manager.onProgress, original)
  })

  it('avisa quem ouve a cada passo, já com o estado de agora', async () => {
    const c = criarCarga({ relogio: relogioParado() })
    const vistos = []
    c.aoMudar((e) => vistos.push(e.progresso))
    c.etapa('mesa', Promise.resolve())
    await c.pronto
    assert.equal(vistos[0], 0)
    assert.equal(vistos.at(-1), 1)
  })
})
