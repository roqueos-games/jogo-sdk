// A capacidade `sala`: a partida online de dois jogadores, nos dois hosts que
// o SDK entrega. O host do RoqueOS mora no front e tem o teste dele; aqui se
// prova que o jogo consegue jogar online sem saber em que host está, e que os
// hosts de teste e de desenvolvimento seguem as regras de cadeira do RoqueOS.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { definirJogo, ERROS_DA_SALA } from '../src/index.js'
import { criarHostFalso } from '../src/host/falso.js'
import { criarHostDeDesenvolvimento } from '../src/host/desenvolvimento.js'
import { capacidadeSala, salasEmMemoria } from '../src/host/sala.js'
import { janelaFalsa } from './janela-falsa.js'

const silencio = { info() {}, debug() {}, warn() {} }
/** Deixa as microtarefas rodarem: a primeira entrega do observar sai numa. */
const tique = () => new Promise((resolve) => setImmediate(resolve))

/**
 * Um jogo de mentira que usa a sala do jeito que o Xadrez usa: quem cria é o
 * anfitrião, quem entra é o convidado, os dois observam e jogam. Cada sala que
 * ele recebe vai para `el.vistas`, que é o que a tela dele mostraria.
 */
const velhaOnline = definirJogo({
  id: 'velhaonline',
  capacidades: ['sala'],
  montar(el, host) {
    el.vistas = []
    let parar = null
    const observar = (codigo) => {
      parar?.()
      el.codigo = codigo
      parar = host.sala.observar(codigo, (sala) => el.vistas.push(sala))
    }
    el.criar = async () => {
      const r = await host.sala.criar({ estadoInicial: '.........', vez: 'x' })
      observar(r.codigo)
      return r
    }
    el.entrar = async (codigo) => {
      const r = await host.sala.entrar(codigo)
      if (r.ok) observar(codigo.trim().toUpperCase())
      return r
    }
    el.jogar = (estado, vez) => host.sala.jogar(el.codigo, { estado, vez })
    el.sair = (vencedor) => host.sala.encerrar(el.codigo, vencedor)
    const convite = host.sala.conviteRecebido()
    el.aoAbrir = convite ? el.entrar(convite) : Promise.resolve(null)
    return { desmontar: () => parar?.() }
  },
})
const ultima = (el) => el.vistas.at(-1)

describe('sala no host falso', () => {
  test('um cria, o outro entra, os dois jogam, um encerra', async () => {
    const host = criarHostFalso({ uid: 'ana', nome: 'Ana' })
    const el = {}
    const montagem = velhaOnline.mount(el, host)

    const { codigo, link } = await el.criar()
    assert.match(codigo, /^[A-HJ-NP-Z2-9]{5}$/, 'cinco letras, sem O/0 nem I/1')
    assert.equal(link, `https://host-falso.invalid/teste?sala=${codigo}`)
    await tique()
    assert.deepEqual(ultima(el), {
      anfitriao: 'ana',
      nomeDoAnfitriao: 'Ana',
      convidado: null,
      nomeDoConvidado: null,
      situacao: 'esperando',
      vez: 'x',
      estado: '.........',
      vencedor: null,
      anfitriaoSaiu: false,
    })

    const entrou = host.disparar('sala', { acao: 'entrar', codigo, uid: 'bia', nome: 'Bia' })
    assert.deepEqual(entrou, { ok: true })
    assert.equal(ultima(el).situacao, 'jogando', 'o convidado sentou, a partida começa')
    assert.equal(ultima(el).convidado, 'bia')
    assert.equal(ultima(el).nomeDoConvidado, 'Bia')

    await el.jogar('x........', 'o')
    assert.deepEqual([ultima(el).estado, ultima(el).vez], ['x........', 'o'])
    host.disparar('sala', { acao: 'jogar', codigo, estado: 'x...o....', vez: 'x' })
    assert.deepEqual([ultima(el).estado, ultima(el).vez], ['x...o....', 'x'])

    await el.sair('x')
    assert.equal(ultima(el).situacao, 'encerrada')
    assert.equal(ultima(el).vencedor, 'x')

    assert.deepEqual(
      host.chamadas.filter((c) => c.capacidade === 'sala').map((c) => c.metodo),
      ['conviteRecebido', 'criar', 'observar', 'jogar', 'encerrar'],
      'o outro jogador não entra em chamadas: chamadas é o que o JOGO pediu',
    )
    assert.equal(host.contar('sala', 'jogar'), 1)

    montagem.desmontar()
    const vistas = el.vistas.length
    host.disparar('sala', { acao: 'jogar', codigo, estado: 'depois', vez: 'o' })
    assert.equal(el.vistas.length, vistas, 'desmontado, o jogo não ouve mais a sala')
    assert.deepEqual(host.salas.observadas(), [], 'e o ouvinte saiu do host, não só se calou')
  })

  test('aberto por convite, o jogo entra sozinho e joga do lado do convidado', async () => {
    const host = criarHostFalso({ uid: 'bia', nome: 'Bia', convite: 'abc23 ' })
    host.disparar('sala', {
      acao: 'criar',
      codigo: 'ABC23',
      uid: 'ana',
      nome: 'Ana',
      estadoInicial: '.........',
      vez: 'x',
    })
    assert.equal(host.sala.conviteRecebido(), 'ABC23', 'o código chega como o jogo digitaria')

    const el = {}
    velhaOnline.mount(el, host)
    assert.deepEqual(await el.aoAbrir, { ok: true })
    await tique()
    const { anfitriao, convidado, nomeDoConvidado, situacao } = ultima(el)
    assert.deepEqual(
      { anfitriao, convidado, nomeDoConvidado, situacao },
      { anfitriao: 'ana', convidado: 'bia', nomeDoConvidado: 'Bia', situacao: 'jogando' },
    )

    host.disparar('sala', { acao: 'jogar', codigo: 'ABC23', estado: 'x........', vez: 'o' })
    assert.equal(ultima(el).vez, 'o')
    await el.jogar('x...o....', 'x')
    assert.equal(host.salas.ler('ABC23').estado, 'x...o....')
  })

  test('sem convite, conviteRecebido é null e o jogo abre no menu', async () => {
    const host = criarHostFalso({ uid: 'ana' })
    const el = {}
    velhaOnline.mount(el, host)
    assert.equal(host.sala.conviteRecebido(), null)
    assert.equal(await el.aoAbrir, null)
    assert.equal(host.contar('sala', 'entrar'), 0)
  })

  test('quem senta em qual cadeira', async () => {
    const host = criarHostFalso({ uid: 'bia', nome: 'Bia' })
    const criar = (codigo, extra = {}) =>
      host.disparar('sala', { acao: 'criar', codigo, uid: 'ana', estadoInicial: 0, ...extra })

    assert.deepEqual(await host.sala.entrar('ZZZZZ'), { erro: 'nao-encontrada' })

    const { codigo: minha } = await host.sala.criar({ estadoInicial: 0, vez: 'x' })
    assert.deepEqual(await host.sala.entrar(minha), { erro: 'propria' })

    criar('CHE1A')
    host.disparar('sala', { acao: 'entrar', codigo: 'CHE1A', uid: 'caio' })
    assert.deepEqual(await host.sala.entrar('CHE1A'), { erro: 'cheia' })
    assert.equal(host.salas.ler('CHE1A').convidado, 'caio', 'o penetra não tirou ninguém')

    criar('FIM22')
    host.disparar('sala', { acao: 'encerrar', codigo: 'FIM22' })
    assert.deepEqual(await host.sala.entrar('FIM22'), { erro: 'cheia' }, 'sala encerrada')

    criar('VOLTA')
    assert.deepEqual(await host.sala.entrar(' volta '), { ok: true })
    const antes = host.salas.ler('VOLTA')
    assert.deepEqual(await host.sala.entrar('VOLTA'), { ok: true, reentrada: true })
    assert.deepEqual(host.salas.ler('VOLTA'), antes, 'reentrada não mexe na sala')

    assert.deepEqual(host.disparar('sala', { acao: 'entrar', codigo: 'VOLTA', uid: 'caio' }), {
      erro: 'cheia',
    })
  })

  test('sem conta não há sala', async () => {
    const host = criarHostFalso()
    host.disparar('sala', { acao: 'criar', codigo: 'ABC23', uid: 'ana', estadoInicial: 0 })
    assert.deepEqual(await host.sala.entrar('ABC23'), { erro: 'sem-conta' })
    await assert.rejects(host.sala.criar({ estadoInicial: 0, vez: 'x' }), { codigo: 'sem-conta' })
    assert.equal(host.salas.ler('ABC23').convidado, null)

    host.disparar('identidade', { uid: 'bia', nome: 'Bia' })
    assert.deepEqual(await host.sala.entrar('ABC23'), { ok: true })
  })

  test('todo erro que entrar devolve está no vocabulário do SDK', async () => {
    const semConta = criarHostFalso()
    const bia = criarHostFalso({ uid: 'bia' })
    const { codigo } = await bia.sala.criar({ estadoInicial: 0 })
    const erros = [
      (await semConta.sala.entrar('X')).erro,
      (await bia.sala.entrar('NADA1')).erro,
      (await bia.sala.entrar(codigo)).erro,
    ]
    for (const e of erros) assert.ok(ERROS_DA_SALA.includes(e), e)
  })

  // No banco de verdade a sala chega depois. O jogo que conta com a entrega
  // dentro do próprio observar passaria aqui e quebraria no RoqueOS.
  test('a primeira entrega não sai dentro do próprio observar', async () => {
    const host = criarHostFalso({ uid: 'ana' })
    const { codigo } = await host.sala.criar({ estadoInicial: 0, vez: 'x' })
    const vistas = []
    host.sala.observar(codigo, (s) => vistas.push(s))
    assert.equal(vistas.length, 0)
    await tique()
    assert.equal(vistas.length, 1)
  })

  test('parar antes da primeira entrega cala de vez', async () => {
    const host = criarHostFalso({ uid: 'ana' })
    const { codigo } = await host.sala.criar({ estadoInicial: 0, vez: 'x' })
    const vistas = []
    const parar = host.sala.observar(codigo, (s) => vistas.push(s))
    parar()
    await tique()
    host.disparar('sala', { acao: 'entrar', codigo, uid: 'bia' })
    assert.deepEqual(vistas, [])
    assert.deepEqual(host.salas.observadas(), [])
  })

  test('a sala que some chega como null, e o anfitrião que cai chega marcado', async () => {
    const host = criarHostFalso({ uid: 'bia' })
    host.disparar('sala', { acao: 'criar', codigo: 'ABC23', uid: 'ana', estadoInicial: 0 })
    await host.sala.entrar('ABC23')
    const vistas = []
    host.sala.observar('ABC23', (s) => vistas.push(s))
    await tique()
    host.disparar('sala', { acao: 'anfitriaoSaiu', codigo: 'ABC23' })
    assert.equal(vistas.at(-1).anfitriaoSaiu, true)
    host.disparar('sala', { acao: 'sumir', codigo: 'ABC23' })
    assert.equal(vistas.at(-1), null)

    const nunca = []
    host.sala.observar('NADA1', (s) => nunca.push(s))
    await tique()
    assert.deepEqual(nunca, [null], 'observar sala que não existe entrega null, não silêncio')
  })

  test('jogar recusa o que o banco de verdade recusaria', async () => {
    const host = criarHostFalso({ uid: 'ana' })
    const { codigo } = await host.sala.criar({ estadoInicial: 0, vez: 'x' })
    await assert.rejects(host.sala.jogar(codigo, { estado: 1 }), /estado, vez/)
    await assert.rejects(
      host.sala.jogar(codigo, { estado: 1, vez: 'o', situacao: 'ended' }),
      /situacao "ended" não existe/,
      'quem porta o jogo e esquece de traduzir o nome do banco descobre no teste',
    )
    await assert.rejects(host.sala.jogar('NADA1', { estado: 1, vez: 'o' }), {
      codigo: 'nao-encontrada',
    })
    await host.sala.jogar(codigo, { estado: 9, vez: 'o', vencedor: 'x', situacao: 'encerrada' })
    const { estado, vez, vencedor, situacao } = host.salas.ler(codigo)
    assert.deepEqual(
      { estado, vez, vencedor, situacao },
      {
        estado: 9,
        vez: 'o',
        vencedor: 'x',
        situacao: 'encerrada',
      },
    )
  })

  test('o estado vai por cópia: mexer no objeto depois de jogar não mexe na sala', async () => {
    const host = criarHostFalso({ uid: 'ana' })
    const tabuleiro = { casas: ['x', null] }
    const { codigo } = await host.sala.criar({ estadoInicial: tabuleiro, vez: 'o' })
    tabuleiro.casas[1] = 'trapaça'
    const jogada = { casas: ['x', 'o'] }
    await host.sala.jogar(codigo, { estado: jogada, vez: 'x' })
    jogada.casas[0] = 'trapaça'
    assert.deepEqual(host.salas.ler(codigo).estado, { casas: ['x', 'o'] })
  })

  test('encerrar é melhor esforço e nunca lança', async () => {
    const host = criarHostFalso({ uid: 'ana' })
    assert.equal(await host.sala.encerrar('NADA1', 'x'), undefined)
    assert.equal(host.salas.ler('NADA1'), null, 'encerrar não cria sala fantasma')
    assert.equal(await host.sala.encerrar(undefined), undefined)
    const { codigo } = await host.sala.criar({ estadoInicial: 0 })
    await host.sala.encerrar(codigo)
    const { situacao, vencedor, vez } = host.salas.ler(codigo)
    assert.deepEqual({ situacao, vencedor }, { situacao: 'encerrada', vencedor: null })
    assert.equal(vez, 'anfitriao', 'sem vez dita, começa o anfitrião, como no RoqueOS')

    host.salas.gravar = () => {
      throw new Error('QuotaExceededError')
    }
    assert.equal(await host.sala.encerrar(codigo, 'x'), undefined, 'nem com o storage falhando')
  })

  test('código que colide com sala viva não grava por cima dela', async () => {
    const salas = salasEmMemoria()
    const sorteios = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.99, 0.99, 0.99, 0.99, 0.99]
    const sala = capacidadeSala({
      salas,
      jogador: () => ({ uid: 'ana', nome: null }),
      link: (c) => c,
      convite: () => null,
      aleatorio: () => sorteios.shift() ?? 0,
    })
    const primeira = await sala.criar({ estadoInicial: 'a' })
    const segunda = await sala.criar({ estadoInicial: 'b' })
    assert.deepEqual([primeira.codigo, segunda.codigo], ['AAAAA', '99999'])
    assert.equal(salas.ler('AAAAA').estado, 'a', 'a primeira sala continua a mesma')
    await assert.rejects(sala.criar({ estadoInicial: 'c' }), /código livre/)
  })

  test('sala: false tira a capacidade, e o outro jogador junto', () => {
    const host = criarHostFalso({ sala: false })
    assert.equal(host.sala, undefined)
    assert.throws(() => host.disparar('sala', { acao: 'entrar', codigo: 'X' }), /sala: false/)
  })

  test('disparar na sala com ação que não existe é erro do teste', () => {
    assert.throws(
      () => criarHostFalso().disparar('sala', { acao: 'voar', codigo: 'ABC23' }),
      /não conhece a ação "voar"/,
    )
  })
})

describe('sala no host de desenvolvimento: duas abas do mesmo navegador', () => {
  const abrir = (janela) =>
    criarHostDeDesenvolvimento({ jogoId: 'velhaonline', janela, registro: silencio })

  /** A aba A cria a sala; a aba B abre o link dela. As duas dividem o localStorage. */
  async function partida() {
    const dados = new Map()
    const abaA = janelaFalsa({ dados, href: 'http://localhost:5173/?nivel=2' })
    const elA = {}
    velhaOnline.mount(elA, abrir(abaA))
    const { codigo, link } = await elA.criar()
    const abaB = janelaFalsa({ dados, href: link })
    const hostB = abrir(abaB)
    const elB = {}
    velhaOnline.mount(elB, hostB)
    const chave = `roqueos:velhaonline:sala:${codigo}`
    return { dados, abaA, elA, abaB, hostB, elB, codigo, link, chave }
  }

  test('o link abre a sala na outra aba, e o evento storage leva cada jogada', async () => {
    const { dados, abaA, elA, abaB, hostB, elB, codigo, link, chave } = await partida()
    assert.equal(link, `http://localhost:5173/?nivel=2&sala=${codigo}`, 'a própria página')
    assert.ok(dados.has(chave), 'a sala mora no localStorage, no espaço do jogo')
    assert.equal(hostB.sala.conviteRecebido(), codigo)

    assert.deepEqual(await elB.aoAbrir, { ok: true })
    await tique()
    assert.equal(ultima(elB).situacao, 'jogando')
    assert.equal(ultima(elA).situacao, 'esperando', 'a aba A só sabe pelo evento do navegador')
    abaA.emitir('storage', { key: chave })
    assert.equal(ultima(elA).situacao, 'jogando')
    assert.match(ultima(elA).nomeDoConvidado, /^Aba [A-Z2-9]{5}$/)
    assert.notEqual(ultima(elA).anfitriao, ultima(elA).convidado, 'cada aba é um jogador')

    await elA.jogar('x........', 'o')
    assert.equal(ultima(elA).estado, 'x........', 'quem escreveu vê na hora')
    abaB.emitir('storage', { key: chave })
    assert.equal(ultima(elB).estado, 'x........')

    await elB.jogar('x...o....', 'x')
    abaA.emitir('storage', { key: chave })
    assert.deepEqual([ultima(elA).estado, ultima(elA).vez], ['x...o....', 'x'])

    const antes = elA.vistas.length
    abaA.emitir('storage', { key: 'roqueos:velhaonline:placar' })
    assert.equal(elA.vistas.length, antes, 'mudança em outra chave não é jogada')

    await elB.sair('o')
    abaA.emitir('storage', { key: chave })
    assert.deepEqual([ultima(elA).situacao, ultima(elA).vencedor], ['encerrada', 'o'])
  })

  test('recarregar a aba do convidado volta como o mesmo jogador; outra aba é outra pessoa', async () => {
    const { dados, abaB, codigo, link } = await partida()
    const recarregada = abrir(janelaFalsa({ dados, sessao: abaB.sessao, href: link }))
    assert.deepEqual(await recarregada.sala.entrar(codigo), { ok: true, reentrada: true })
    const terceira = abrir(janelaFalsa({ dados, href: link }))
    assert.deepEqual(await terceira.sala.entrar(codigo), { erro: 'cheia' })
  })

  test('fechar a aba do anfitrião chega na outra como anfitriaoSaiu', async () => {
    const { abaA, abaB, elB, chave } = await partida()
    await elB.aoAbrir
    abaA.emitir('pagehide')
    abaB.emitir('storage', { key: chave })
    assert.equal(ultima(elB).anfitriaoSaiu, true)
  })

  test('localStorage limpo em outra aba: quem observa recebe null', async () => {
    const { dados, abaB, elB } = await partida()
    await elB.aoAbrir
    dados.clear()
    abaB.emitir('storage', { key: null })
    assert.equal(ultima(elB), null)
  })

  test('o convite é o ?sala= da página, e só ele', () => {
    const convite = (href) => abrir(janelaFalsa({ href })).sala.conviteRecebido()
    assert.equal(convite('http://localhost:5173/'), null)
    assert.equal(convite('http://localhost:5173/?sala=abc23'), 'ABC23')
    assert.equal(convite('http://localhost:5173/?sala='), null)
    assert.equal(convite('http://localhost:5173/?joinMatch=chess:ABC23'), null)
  })

  test('a identidade continua a de convidado, e a sala funciona assim mesmo', async () => {
    const host = abrir(janelaFalsa())
    assert.deepEqual(host.identidade.atual(), { uid: null, nome: null })
    const { codigo } = await host.sala.criar({ estadoInicial: 0 })
    assert.match(codigo, /^[A-HJ-NP-Z2-9]{5}$/)
  })
})
