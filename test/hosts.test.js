import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { criarHostDeDesenvolvimento } from '../src/host/desenvolvimento.js'
import { criarHostFalso } from '../src/host/falso.js'
import { chaveDoJogo } from '../src/host/armazenamento.js'
import { normalizarIdioma } from '../src/index.js'
import { janelaFalsa } from './janela-falsa.js'

const silencio = { info() {}, debug() {}, warn() {} }

describe('host de desenvolvimento', () => {
  test('a chave é roqueos:<jogo>:<chave>, a mesma que o front já usava', () => {
    // O recorde do 2048 no front mora em `roqueos:game2048:best`. Se o formato
    // mudar, todo jogador perde o recorde no dia da extração.
    const janela = janelaFalsa()
    janela.dados.set('roqueos:game2048:best', '2048')
    const host = criarHostDeDesenvolvimento({ jogoId: 'game2048', janela, registro: silencio })
    assert.equal(host.armazenamento.ler('best'), '2048')
    assert.equal(chaveDoJogo('game2048', 'best'), 'roqueos:game2048:best')
  })

  test('storage que lança (Safari privado) não derruba o jogo', () => {
    const host = criarHostDeDesenvolvimento({
      jogoId: 'x',
      janela: janelaFalsa({ storageQuebrado: true }),
      registro: silencio,
    })
    assert.equal(host.armazenamento.gravar('best', 10), true, 'caiu na memória')
    assert.equal(host.armazenamento.ler('best'), '10')
  })

  test('placar vai e volta, e salvar funciona desestruturado', async () => {
    const host = criarHostDeDesenvolvimento({
      jogoId: 'x',
      janela: janelaFalsa(),
      registro: silencio,
    })
    const { salvar, carregar } = host.placar
    assert.equal(await carregar(), null)
    await salvar({ best: 10 })
    await salvar({ partidas: 3 })
    const p = await carregar()
    assert.equal(p.best, 10, 'salvar funde, não sobrescreve')
    assert.equal(p.partidas, 3)
    assert.equal(typeof p.atualizadoEm, 'number')
  })

  test('idioma sai do navegador e cai num dos dez', () => {
    const host = (language) =>
      criarHostDeDesenvolvimento({
        jogoId: 'x',
        janela: janelaFalsa({ language }),
        registro: silencio,
      })
    assert.equal(host('pt').idioma.atual(), 'pt-BR')
    assert.equal(host('zh-Hans-CN').idioma.atual(), 'zh-CN')
    assert.equal(host('ko-KR').idioma.atual(), 'en-US', 'sem casamento, recuo da casa')
    assert.equal(normalizarIdioma(undefined), 'en-US')
  })

  test('troca de idioma chega no jogo, e parar de ouvir funciona', () => {
    const janela = janelaFalsa({ language: 'pt-BR' })
    const host = criarHostDeDesenvolvimento({ jogoId: 'x', janela, registro: silencio })
    const vistos = []
    const parar = host.idioma.aoMudar((i) => vistos.push(i))
    janela.navigator.language = 'fr-FR'
    janela.emitir('languagechange')
    parar()
    janela.navigator.language = 'de-DE'
    janela.emitir('languagechange')
    assert.deepEqual(vistos, ['fr-FR'])
  })

  test('modo leve em aparelho de toque ou de memória curta', () => {
    const leve = (o) =>
      criarHostDeDesenvolvimento({
        jogoId: 'x',
        janela: janelaFalsa(o),
        registro: silencio,
      }).desempenho.modoLeve()
    assert.equal(leve({ coarse: true }), true)
    assert.equal(leve({ deviceMemory: 2 }), true)
    assert.equal(leve({ deviceMemory: 16 }), false)
  })

  test('convidado: sem uid, sem nome', () => {
    const host = criarHostDeDesenvolvimento({
      jogoId: 'x',
      janela: janelaFalsa(),
      registro: silencio,
    })
    assert.deepEqual(host.identidade.atual(), { uid: null, nome: null })
  })

  test('sem IA, de propósito: o jogo tem que funcionar sem ela', () => {
    const host = criarHostDeDesenvolvimento({
      jogoId: 'x',
      janela: janelaFalsa(),
      registro: silencio,
    })
    assert.equal(host.ia, undefined)
  })

  test('avisar escreve no console, e o fixo sai marcado', () => {
    const linhas = []
    const host = criarHostDeDesenvolvimento({
      jogoId: 'x',
      janela: janelaFalsa(),
      registro: { ...silencio, info: (l) => linhas.push(l) },
    })
    host.avisar('partida online pede conta', { tipo: 'aviso' })
    host.avisar('não consegui ler o seu mundo', { tipo: 'erro', fixo: true })
    host.avisar('salvo')
    assert.deepEqual(linhas, [
      '[x] aviso: partida online pede conta',
      '[x] erro (fixo, até o jogador fechar): não consegui ler o seu mundo',
      '[x] info: salvo',
    ])
  })

  test('sem jogoId não há onde guardar nada', () => {
    assert.throws(() => criarHostDeDesenvolvimento({}), /jogoId/)
  })
})

describe('host falso', () => {
  test('anota o que o jogo pediu', async () => {
    const host = criarHostFalso()
    host.avisar('partida online pede conta', { tipo: 'aviso' })
    host.metricas.evento('partida', { pontos: 3 })
    await host.placar.salvar({ best: 3 })
    assert.equal(host.contar('placar', 'salvar'), 1)
    assert.deepEqual(host.chamadas[0], {
      capacidade: 'avisar',
      metodo: 'avisar',
      args: ['partida online pede conta', { tipo: 'aviso' }],
    })
  })

  test('disparar muda a identidade e avisa quem ouve', () => {
    const host = criarHostFalso()
    const vistos = []
    const parar = host.identidade.aoMudar((u) => vistos.push(u.uid))
    host.disparar('identidade', { uid: 'abc', nome: 'Ana' })
    parar()
    host.disparar('identidade', { uid: 'def' })
    assert.deepEqual(vistos, ['abc'])
    assert.equal(host.identidade.atual().uid, 'def')
  })

  test('IA só existe quando o teste pede', async () => {
    assert.equal(criarHostFalso().ia, undefined)
    const host = criarHostFalso({ ia: async ({ mensagens }) => `eco: ${mensagens.at(-1).texto}` })
    assert.equal(host.ia.disponivel(), true)
    const pedido = { sistema: 's', mensagens: [{ papel: 'jogador', texto: 'oi' }] }
    assert.equal(await host.ia.completar(pedido), 'eco: oi')
    assert.equal(host.contar('ia', 'completar'), 1)
    assert.equal(host.contar('ia', 'disponivel'), 1, 'o teste vê que o jogo perguntou antes')
  })

  test('IA sem modelo: disponivel é false e completar devolve null sem chamar', async () => {
    let chamou = 0
    const responder = async () => {
      chamou += 1
      return 'resposta'
    }
    const pedido = { mensagens: [{ papel: 'jogador', texto: 'oi' }] }
    const host = criarHostFalso({ ia: responder, iaDisponivel: false })
    assert.equal(host.ia.disponivel(), false)
    assert.equal(await host.ia.completar(pedido), null)
    assert.equal(chamou, 0)
    host.disparar('ia', { disponivel: true })
    assert.equal(host.ia.disponivel(), true, 'o servidor voltou: o jogo pergunta de novo')
    assert.equal(await host.ia.completar(pedido), 'resposta')
    host.disparar('ia', { disponivel: false })
    assert.equal(await host.ia.completar(pedido), null)
    assert.throws(() => criarHostFalso().disparar('ia', { disponivel: true }), /sem ia/)
  })

  test('IA: erro ou resposta que não é texto chegam ao jogo como null', async () => {
    const pedido = { mensagens: [{ papel: 'jogador', texto: 'oi' }] }
    const quebrada = criarHostFalso({
      ia: async () => {
        throw new Error('503')
      },
    })
    assert.equal(await quebrada.ia.completar(pedido), null)
    assert.equal(await criarHostFalso({ ia: async () => undefined }).ia.completar(pedido), null)
  })

  test('IA: o pedido fora do formato do contrato é erro de quem porta, e aparece no teste', async () => {
    const host = criarHostFalso({ ia: async () => 'x' })
    const tortos = [
      undefined,
      { mensagens: ['oi'] },
      { mensagens: [] },
      { mensagens: [{ role: 'user', content: 'oi' }] },
      { mensagens: [{ papel: 'usuario', texto: 'oi' }] },
      { mensagens: [{ papel: 'jogador', texto: 3 }] },
      { sistema: 1, mensagens: [{ papel: 'jogador', texto: 'oi' }] },
    ]
    for (const pedido of tortos) {
      await assert.rejects(host.ia.completar(pedido), TypeError, JSON.stringify(pedido))
    }
    const conversa = [
      { papel: 'jogador', texto: 'oi' },
      { papel: 'modelo', texto: 'olá, viajante' },
      { papel: 'jogador', texto: 'o que vende?' },
    ]
    assert.equal(await host.ia.completar({ sistema: 's', mensagens: conversa }), 'x')
  })

  test('avisar anota o fixo: o aviso que só some quando o jogador fecha', () => {
    const host = criarHostFalso()
    host.avisar('Não consegui ler o seu mundo.', { tipo: 'erro', fixo: true })
    assert.deepEqual(host.chamadas[0].args, [
      'Não consegui ler o seu mundo.',
      { tipo: 'erro', fixo: true },
    ])
  })

  test('disparar algo que não existe é erro do teste', () => {
    assert.throws(() => criarHostFalso().disparar('clima', 'chuva'), /não conhece/)
  })
})
