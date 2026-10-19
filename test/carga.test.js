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

const relogioControlado = () => {
  let id = 0
  const fila = new Map()
  return {
    fila,
    setTimeout(fn) {
      fila.set(++id, fn)
      return id
    },
    clearTimeout(chave) {
      fila.delete(chave)
    },
    vencer() {
      for (const fn of [...fila.values()]) fn()
    },
  }
}
const codigo = (valor, etapas) => (erro) => {
  assert.equal(erro.codigo, valor)
  assert.deepEqual(erro.etapas, etapas)
  assert.equal(erro.cause, undefined)
  return true
}

describe('a carga estrita opcional', () => {
  it('rejeita uma etapa necessária falha em vez de anunciar sucesso', async () => {
    const c = criarCarga({ estrita: true, relogio: relogioControlado() })
    const mesa = adiada()
    c.etapa('mesa', mesa.p)
    c.selar?.()
    mesa.rejeitar(new Error('https://privado.invalid/modelo?token=segredo'))
    await assert.rejects(c.pronto, codigo('etapa-falhou', ['mesa']))
    assert.equal(c.sucesso(), false)
    assert.equal(c.fechada(), true)
    assert.ok(c.progresso() < 1)
    assert.doesNotMatch(JSON.stringify(c.erro()), /privado|token|segredo/)
  })

  it('teto com arquivo parado rejeita sem inventar 100%', async () => {
    const r = relogioControlado(),
      manager = {}
    const c = criarCarga({ estrita: true, relogio: r, manager })
    c.etapa('mesa', new Promise(() => {}))
    c.selar?.()
    manager.onProgress('https://segredo.invalid', 8, 10)
    const antes = c.progresso()
    r.vencer()
    await assert.rejects(c.pronto, codigo('tempo-esgotado', ['mesa']))
    assert.equal(c.progresso(), antes)
    assert.ok(c.progresso() < 1)
    assert.equal(r.fila.size, 0)
  })

  it('nem uma primeira etapa já resolvida abre antes do selo e do segundo ACK', async () => {
    const c = criarCarga({ estrita: true, relogio: relogioControlado() })
    let abriu = false
    c.pronto.then(() => {
      abriu = true
    })
    c.etapa('mesa', Promise.resolve())
    await vez()
    assert.equal(abriu, false)
    assert.ok(c.progresso() < 1)
    const textura = adiada()
    c.etapa('textura', textura.p)
    c.selar()
    await vez()
    assert.equal(abriu, false)
    textura.resolver()
    await c.pronto
    assert.equal(abriu, true)
    assert.equal(c.sucesso(), true)
    assert.equal(c.progresso(), 1)
  })

  it('esquecer o selo falha fechado mesmo com todas as tarefas resolvidas', async () => {
    const r = relogioControlado(),
      c = criarCarga({ estrita: true, relogio: r })
    c.etapa('mesa', Promise.resolve())
    await vez()
    r.vencer()
    await assert.rejects(c.pronto, codigo('tempo-esgotado', []))
    assert.equal(c.sucesso(), false)
  })

  it('não aceita nova etapa depois do selo e invalida carga ainda pendente', async () => {
    const c = criarCarga({ estrita: true, relogio: relogioControlado() })
    c.etapa('mesa', new Promise(() => {}))
    c.selar()
    assert.throws(
      () => c.etapa('textura', Promise.reject(new Error('credencial'))),
      codigo('registro-fechado', []),
    )
    await assert.rejects(c.pronto, codigo('registro-fechado', []))
    assert.equal(c.sucesso(), false)
  })

  it('opcional recusada não bloqueia a necessária nem reprova a carga', async () => {
    const c = criarCarga({ estrita: true, relogio: relogioControlado() }),
      mesa = adiada()
    c.etapa('sons', Promise.reject(new Error('áudio não disponível')), { opcional: true })
    c.etapa('mesa', mesa.p)
    c.selar()
    await vez()
    assert.equal(c.fechada(), false)
    mesa.resolver()
    await c.pronto
    assert.equal(c.sucesso(), true)
    assert.equal(c.erro(), null)
  })

  it('opcional parada não segura o sucesso e pode rejeitar tarde sem reabrir a carga', async () => {
    const c = criarCarga({ estrita: true, relogio: relogioControlado() }),
      som = adiada()
    c.etapa('sons', som.p, { opcional: true })
    c.etapa('mesa', Promise.resolve())
    c.selar()
    await c.pronto
    som.rejeitar(new Error('tarde'))
    await vez()
    assert.equal(c.sucesso(), true)
    assert.equal(c.erro(), null)
  })

  it('liberar cancela a promessa observável, limpa timer e ignora assets tardios', async () => {
    const r = relogioControlado(),
      c = criarCarga({ estrita: true, relogio: r }),
      mesa = adiada()
    const vistos = []
    c.aoMudar((e) => vistos.push(e))
    c.etapa('mesa', mesa.p)
    c.selar()
    c.liberar()
    const n = vistos.length
    await assert.rejects(c.pronto, codigo('cancelada', ['mesa']))
    mesa.resolver()
    await vez()
    assert.equal(vistos.length, n)
    assert.equal(r.fila.size, 0)
    assert.equal(c.sucesso(), false)
    assert.ok(c.progresso() < 1)
  })

  it('permite observar a rejeição só depois da falha, sem unhandledRejection', async () => {
    const c = criarCarga({ estrita: true, relogio: relogioControlado() }),
      mesa = adiada()
    c.etapa('mesa', mesa.p)
    c.selar()
    mesa.rejeitar(new Error('rede'))
    await vez()
    await assert.rejects(c.pronto, codigo('etapa-falhou', ['mesa']))
  })

  it('manager conta progresso mas não conclui uma etapa ainda pendente', async () => {
    const c = criarCarga({ estrita: true, manager: {}, relogio: relogioControlado() }),
      mesa = adiada()
    const manager = {}
    c.liberar()
    await assert.rejects(c.pronto)
    const outra = criarCarga({ estrita: true, manager, relogio: relogioControlado() })
    outra.etapa('mesa', mesa.p)
    outra.selar()
    manager.onStart('não guardar URL', 10, 10)
    assert.ok(outra.progresso() < 1)
    assert.equal(outra.fechada(), false)
    mesa.resolver()
    await outra.pronto
    assert.equal(outra.progresso(), 1)
  })

  it('progresso não recua ao registrar etapa adicional antes do selo', async () => {
    const c = criarCarga({ estrita: true, relogio: relogioControlado() }),
      mesa = adiada()
    c.etapa('textura', Promise.resolve())
    await vez()
    const antes = c.progresso()
    c.etapa('mesa', mesa.p)
    assert.equal(c.progresso(), antes)
    c.selar()
    mesa.resolver()
    await c.pronto
  })

  for (const fim of ['sucesso', 'falha', 'teto', 'cancelamento']) {
    it(`restaura manager e timer depois de ${fim}`, async () => {
      const chamadas = [],
        original = function () {
          chamadas.push(this)
        }
      const manager = { onProgress: original },
        r = relogioControlado()
      const c = criarCarga({ estrita: true, manager, relogio: r }),
        mesa = adiada()
      c.etapa('mesa', mesa.p)
      c.selar()
      manager.onProgress('url', 1, 2)
      assert.equal(chamadas[0], manager)
      if (fim === 'sucesso') mesa.resolver()
      else if (fim === 'falha') mesa.rejeitar(new Error('original sensível'))
      else if (fim === 'teto') r.vencer()
      else c.liberar()
      if (fim === 'sucesso') await c.pronto
      else await assert.rejects(c.pronto)
      assert.equal(manager.onProgress, original)
      assert.equal(Object.hasOwn(manager, 'onStart'), false)
      assert.equal(r.fila.size, 0)
    })
  }

  it('nomes de etapa não podem carregar URL/credencial para o erro público', async () => {
    const c = criarCarga({ estrita: true, relogio: relogioControlado() })
    assert.throws(
      () => c.etapa('https://exemplo.invalid?token=segredo', Promise.reject(new Error('corpo'))),
      codigo('etapa-invalida', []),
    )
    await assert.rejects(c.pronto, codigo('etapa-invalida', []))
    assert.doesNotMatch(JSON.stringify(c.erro()), /exemplo|token|segredo|corpo/)
  })

  it('duplicar nome não deixa uma primeira promessa liberar a segunda', async () => {
    const c = criarCarga({ estrita: true, relogio: relogioControlado() })
    c.etapa('mesa', Promise.resolve())
    assert.throws(() => c.etapa('mesa', new Promise(() => {})), codigo('etapa-duplicada', ['mesa']))
    await assert.rejects(c.pronto, codigo('etapa-duplicada', ['mesa']))
  })

  it('nova carga pode recuperar uma falha sem reaproveitar o estado antigo', async () => {
    const c = criarCarga({ estrita: true, relogio: relogioControlado() })
    c.etapa('mesa', Promise.reject(new Error('rede')))
    c.selar()
    await assert.rejects(c.pronto)
    const nova = criarCarga({ estrita: true, relogio: relogioControlado() })
    nova.etapa('mesa', Promise.resolve())
    nova.selar()
    await nova.pronto
    assert.equal(nova.sucesso(), true)
    assert.equal(c.sucesso(), false)
  })

  for (const ordem of ['primeira', 'segunda']) {
    it(`duas cargas compartilham manager e restauram callbacks, encerrando ${ordem} antes`, async () => {
      let chamadas = 0
      const original = () => chamadas++
      const manager = { onProgress: original }
      const a = criarCarga({ estrita: true, manager, relogio: relogioControlado() })
      const b = criarCarga({ estrita: true, manager, relogio: relogioControlado() })
      const m = adiada(),
        n = adiada()
      a.etapa('mesa', m.p)
      b.etapa('mesa', n.p)
      a.selar()
      b.selar()
      manager.onProgress('url', 1, 2)
      assert.equal(chamadas, 1)
      const antes = ordem === 'primeira' ? a : b
      const depois = ordem === 'primeira' ? b : a
      antes.liberar()
      await assert.rejects(antes.pronto)
      manager.onProgress('url', 2, 3)
      assert.equal(chamadas, 2)
      assert.equal(depois.fechada(), false)
      depois.liberar()
      await assert.rejects(depois.pronto)
      assert.equal(manager.onProgress, original)
      assert.equal(Object.hasOwn(manager, 'onStart'), false)
    })
  }

  it('estado distingue selo, sucesso e erro sem renomear os campos anteriores', async () => {
    const c = criarCarga({ estrita: true, relogio: relogioControlado() }),
      vistos = []
    c.aoMudar((e) => vistos.push(e))
    c.etapa('mesa', Promise.resolve())
    await vez()
    assert.equal(vistos.at(-1).selada, false)
    assert.equal(vistos.at(-1).sucesso, false)
    assert.equal(vistos.at(-1).erro, null)
    c.selar()
    await c.pronto
    assert.deepEqual(vistos.at(-1), {
      progresso: 1,
      etapa: null,
      fechada: true,
      sucesso: true,
      erro: null,
      selada: true,
    })
    let final
    c.aoMudar((e) => {
      final = e
    })
    assert.equal(final.sucesso, true)
    assert.throws(
      () => c.etapa('tarde', Promise.reject(new Error('sem rede'))),
      codigo('registro-fechado', []),
    )
    c.liberar()
    await c.pronto
    assert.equal(c.sucesso(), true)
  })

  it('selar apenas opcionais pendentes é sucesso explícito sem esperar por elas', async () => {
    const c = criarCarga({ estrita: true, relogio: relogioControlado() })
    c.etapa('sons', new Promise(() => {}), { opcional: true })
    assert.equal(c.fechada(), false)
    c.selar()
    await c.pronto
    assert.equal(c.sucesso(), true)
  })

  it('o selo pendente é observável e não gera sucesso sem o ACK que falta', async () => {
    const c = criarCarga({ estrita: true, relogio: relogioControlado() })
    const mesa = adiada()
    const vistos = []
    c.etapa('mesa', mesa.p)
    c.aoMudar((e) => vistos.push(e))
    c.selar()
    c.selar() // repetir o selo não abre outra carga nem dispara outra notificação
    assert.equal(vistos.length, 2)
    assert.equal(vistos.at(-1).selada, true)
    assert.equal(vistos.at(-1).sucesso, false)
    mesa.resolver()
    await c.pronto
    assert.equal(vistos.at(-1).sucesso, true)
  })

  it('uma segunda rejeição tardia não troca o erro da primeira nem solta rejeição', async () => {
    const c = criarCarga({ estrita: true, relogio: relogioControlado() }),
      mesa = adiada(),
      ceu = adiada()
    c.etapa('mesa', mesa.p)
    c.etapa('ceu', ceu.p)
    c.selar()
    mesa.rejeitar(new Error('rede'))
    await assert.rejects(c.pronto, codigo('etapa-falhou', ['mesa']))
    ceu.rejeitar(new Error('segundo erro'))
    await vez()
    assert.deepEqual(c.erro().etapas, ['mesa'])
  })
})
