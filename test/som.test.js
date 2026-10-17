// O som dos jogos (./som): o pacote cifrado é aberto de verdade (./pacote), o AudioContext é de
// mentira e anota o que tocou, ligou e soltou.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { selarPacote, abrirPacote } from '../src/pacote.js'
import { criarAudio, criarPanner, soltar } from '../src/som.js'

const CHAVE = 'a1'.repeat(32)

function contextoFalso() {
  const tocou = []
  const soltos = []
  const no = (nome) => ({
    nome,
    gain: {
      value: 1,
      setValueAtTime() {},
      exponentialRampToValueAtTime() {},
      cancelScheduledValues() {},
    },
    connect() {},
    disconnect: () => soltos.push(nome),
  })
  const c = {
    state: 'running',
    currentTime: 0,
    destination: {},
    tocou,
    soltos,
    createGain: () => no('ganho'),
    createPanner: () => ({
      ...no('panner'),
      positionX: { value: 0 },
      positionY: { value: 0 },
      positionZ: { value: 0 },
    }),
    createOscillator: () => ({
      ...no('oscilador'),
      type: '',
      frequency: { value: 0 },
      start: () => tocou.push({ sintese: true }),
      stop() {},
    }),
    createBufferSource() {
      const f = {
        ...no('fonte'),
        buffer: null,
        loop: false,
        playbackRate: { value: 1 },
        start: () => tocou.push({ nome: f.buffer.nome, loop: f.loop }),
        stop() {
          f.parou = true
          f.onended?.()
        },
      }
      c.ultimaFonte = f
      return f
    },
    decodeAudioData: async (dados) => ({
      nome: new TextDecoder().decode(new Uint8Array(dados)),
      duration: 30,
    }),
  }
  return c
}

async function pacote(nomes) {
  const pak = await selarPacote(
    nomes.map((nome) => ({ nome, dados: new TextEncoder().encode(nome) })),
    CHAVE,
  )
  return () => abrirPacote(pak, CHAVE)
}

const NOMES = ['peca-1.wav', 'peca-2.wav', 'peca-3.wav', 'fogo.mp3', 'chuva.mp3']

describe('o som dos jogos', () => {
  test('antes do pacote, tocar devolve false (o jogo cai na síntese); depois, a gravação', async () => {
    const c = contextoFalso()
    const a = criarAudio({ contexto: () => c }, { pacote: await pacote(NOMES) })
    assert.equal(a.tocar('peca-1.wav'), false)
    await a.pronto()
    assert.equal(a.tocar('peca-1.wav'), true)
    assert.equal(c.tocou.at(-1).nome, 'peca-1.wav')
  })

  test('preparado antes do primeiro toque, a primeira jogada já sai gravada', async () => {
    let contexto = null
    const a = criarAudio({ contexto: () => contexto }, { pacote: await pacote(NOMES) })
    class Offline {
      decodeAudioData = contextoFalso().decodeAudioData
    }
    assert.equal(await a.preparar(Offline), true)
    contexto = contextoFalso()
    assert.equal(a.tocar('peca-2.wav'), true)
    assert.deepEqual(contexto.tocou, [{ nome: 'peca-2.wav', loop: false }])
  })

  test('sem pacote, preparar diz que não há gravação', async () => {
    const a = criarAudio(
      { contexto: () => null },
      { pacote: () => Promise.reject(new Error('sem rede')) },
    )
    class Offline {
      decodeAudioData = async () => ({})
    }
    assert.equal(await a.preparar(Offline), false)
    assert.equal(a.gravacoes(), false)
  })

  test('o golpe que acabou sai do grafo: fonte, ganho e panner', async () => {
    const c = contextoFalso()
    const a = criarAudio({ contexto: () => c }, { pacote: await pacote(NOMES) })
    a.tocar('x')
    await a.pronto()
    a.tocar('peca-1.wav', { pos: { x: 1, y: 0, z: 2 } })
    assert.deepEqual(c.soltos, [])
    c.ultimaFonte.onended()
    assert.deepEqual(c.soltos.sort(), ['fonte', 'ganho', 'panner'])
  })

  test('a variação nunca repete a anterior', () => {
    const a = criarAudio({ contexto: () => null }, { sorteio: () => 0 })
    const v = Array.from({ length: 6 }, () => a.variacao('peca', 3))
    for (let i = 1; i < v.length; i++) assert.notEqual(v[i], v[i - 1])
    assert.match(v[0], /^peca-[1-3]\.wav$/)
  })

  test('o laço pedido antes do pacote liga quando ele chega, de cada lugar, e apaga', async () => {
    const c = contextoFalso()
    const a = criarAudio({ contexto: () => c }, { pacote: await pacote(NOMES) })
    a.laco('fogo.mp3', true, { lugares: [{ x: 0, y: 1, z: -2 }] })
    assert.deepEqual(a.lacosTocando(), [])
    await a.pronto()
    assert.deepEqual(a.lacosTocando(), ['fogo.mp3'])
    assert.equal(c.tocou.at(-1).loop, true)
    a.laco('chuva.mp3', true)
    assert.deepEqual(a.lacosTocando().sort(), ['chuva.mp3', 'fogo.mp3'])
    a.laco('fogo.mp3', false)
    assert.deepEqual(a.lacosTocando(), ['chuva.mp3'])
  })

  test('volumes do painel: geral, efeitos e ambiente, de 0 a 1', () => {
    const a = criarAudio({ contexto: () => null })
    a.definirVolumes({ geral: 2, efeitos: -1, ambiente: 0.3 })
    assert.deepEqual(a.volumes(), { geral: 1, efeitos: 0, ambiente: 0.3 })
  })

  test('o panner é HRTF, na posição e no espaço pedidos; sem posição, nenhum', () => {
    const c = contextoFalso()
    const p = criarPanner(
      c,
      { x: 3, y: 1, z: -2 },
      { refDistance: 20, rolloffFactor: 1, maxDistance: 500 },
    )
    assert.equal(p.panningModel, 'HRTF')
    assert.equal(p.positionX.value, 3)
    assert.equal(p.refDistance, 20)
    assert.equal(criarPanner(c, null), null)
  })

  test('soltar aguenta nó nulo e nó já solto', () => {
    assert.doesNotThrow(() =>
      soltar(null, {
        disconnect: () => {
          throw new Error('já')
        },
      }),
    )
  })

  test('a voz contínua liga quando o pacote chega, desliza o tom e o volume, e solta ao parar', async () => {
    const c = contextoFalso()
    const a = criarAudio({ contexto: () => c }, { pacote: await pacote(['motor.wav']) })
    const motor = a.voz('motor.wav')
    assert.equal(motor.definir({ taxa: 1.2 }), false)
    await a.pronto()
    assert.equal(motor.definir({ taxa: 1.4, ganho: 0.6 }), true)
    const fonte = c.ultimaFonte
    assert.equal(fonte.loop, true)
    assert.equal(fonte.playbackRate.value, 1.4)
    assert.deepEqual(c.tocou, [{ nome: 'motor.wav', loop: true }])
    // o segundo definir não cria outra fonte
    motor.definir({ taxa: 0.9 })
    assert.equal(c.ultimaFonte, fonte)
    assert.equal(fonte.playbackRate.value, 0.9)
    motor.parar(0.1)
    assert.equal(fonte.parou, true)
    assert.ok(c.soltos.includes('fonte'))
    assert.equal(motor.tocando(), false)
    assert.equal(motor.definir({ taxa: 1 }), false)
    motor.retomar()
    assert.equal(motor.definir({ taxa: 1 }), true)
  })

  test('a voz religa num contexto novo (o iOS fecha o antigo ao voltar do fundo)', async () => {
    let c = contextoFalso()
    const a = criarAudio({ contexto: () => c }, { pacote: await pacote(['motor.wav']) })
    const motor = a.voz('motor.wav')
    motor.definir({ taxa: 1 }) // o primeiro toque no contexto começa a decodificar
    await a.pronto()
    motor.definir({ taxa: 1 })
    const velha = c.ultimaFonte
    c = contextoFalso()
    motor.definir({ taxa: 1 })
    assert.equal(velha.parou, true)
    assert.notEqual(c.ultimaFonte, undefined)
  })
})
