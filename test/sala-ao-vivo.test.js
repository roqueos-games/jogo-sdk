// A capacidade `salaAoVivo`: a sala em tempo real de vários jogadores, nos
// dois hosts que o SDK entrega. O host do RoqueOS mora no front e tem o teste
// dele (caminho exato no banco, regras); aqui se prova que o jogo consegue
// jogar ao vivo sem saber em que host está, que os hosts de teste devolvem o
// que o Realtime Database devolveria, e que recusam o que ele recusaria.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { definirJogo, ERROS_DA_SALA_AO_VIVO } from '../src/index.js'
import { criarHostFalso } from '../src/host/falso.js'
import { criarHostDeDesenvolvimento } from '../src/host/desenvolvimento.js'
import { armazenamentoEmMemoria } from '../src/host/armazenamento.js'
import {
  MARCADOR_DA_HORA,
  compararChaves,
  criarGeradorDeChaves,
  criarSalaAoVivo,
} from '../src/host/salaAoVivo.js'
import { janelaFalsa } from './janela-falsa.js'

const silencio = { info() {}, debug() {}, warn() {} }
/** Deixa as microtarefas rodarem: a primeira entrega do observar sai numa. */
const tique = () => new Promise((resolve) => setImmediate(resolve))

/**
 * Um jogo de mentira que usa a sala ao vivo do jeito que a Runa usa: quem
 * cria é o anfitrião e consome a fila de golpes; todo mundo publica presença
 * e arma a saída dela com aoCair; o anfitrião arma a sala inteira.
 */
const coop = definirJogo({
  id: 'coopdementira',
  capacidades: ['salaAoVivo'],
  montar(el, host) {
    const s = host.salaAoVivo
    Object.assign(el, { jogadores: undefined, golpes: [], codigo: null, eu: null })
    const paradas = []
    const ouvir = (codigo, eu, anfitriao) => {
      Object.assign(el, { codigo, eu })
      paradas.push(s.observar(codigo, 'players', (p) => (el.jogadores = p)))
      if (anfitriao) {
        paradas.push(
          s.observarFilhos(codigo, 'hits', {
            adicionado(chave, golpe) {
              el.golpes.push(golpe)
              s.apagar(codigo, `hits/${chave}`)
            },
          }),
        )
      }
    }
    const presenca = async (codigo, uid, x) => {
      await s.gravar(codigo, `players/${uid}`, { x, y: 0, t: s.horaDoServidor() })
      await s.aoCair(codigo, `players/${uid}`, 'apagar')
    }
    el.criar = async () => {
      const r = await s.criar({ meta: { region: 'greenwood', seed: 7 } })
      ouvir(r.codigo, r.eu, true)
      await presenca(r.codigo, r.eu.uid, 1)
      await s.aoCair(r.codigo, '', 'apagar')
      return r
    }
    el.entrar = async (codigo) => {
      const r = await s.entrar(codigo)
      if (!r.ok) return r
      const c = codigo.trim().toUpperCase()
      ouvir(c, r.eu, r.meta.host === r.eu.uid)
      await presenca(c, r.eu.uid, 2)
      return r
    }
    el.mover = (x) => s.atualizar(el.codigo, `players/${el.eu.uid}`, { x, t: s.horaDoServidor() })
    el.golpear = (m, d) => s.empurrar(el.codigo, 'hits', { m, d, by: el.eu.uid })
    const convite = s.conviteRecebido()
    el.aoAbrir = convite ? el.entrar(convite) : Promise.resolve(null)
    return { desmontar: () => paradas.forEach((parar) => parar()) }
  },
})

/** Um host falso com a Ana já dentro de uma sala criada por ela. */
async function salaDaAna(opcoes = {}) {
  const host = criarHostFalso({ uid: 'ana', nome: 'Ana', ...opcoes })
  const { codigo } = await host.salaAoVivo.criar({ meta: { seed: 1 } })
  return { host, s: host.salaAoVivo, codigo }
}

describe('salaAoVivo no host falso: um jogo de verdade usando', () => {
  test('o anfitrião cria, o convidado chega, a presença e o golpe vão e voltam', async () => {
    const host = criarHostFalso({ uid: 'ana', nome: 'Ana' })
    const el = {}
    const montagem = coop.mount(el, host)

    const { codigo, link, eu } = await el.criar()
    assert.match(codigo, /^[A-HJ-NP-Z2-9]{5}$/, 'cinco letras, sem O/0 nem I/1')
    assert.equal(link, `https://host-falso.invalid/teste?sala=${codigo}`)
    assert.deepEqual(eu, { uid: 'ana', nome: 'Ana' })
    await tique()
    const { meta } = host.arvoreDaSala(codigo)
    assert.equal(typeof meta.createdAt, 'number', 'a hora do servidor virou número')
    assert.deepEqual(
      { ...meta, createdAt: 0 },
      { region: 'greenwood', seed: 7, host: 'ana', hostName: 'Ana', createdAt: 0 },
    )
    assert.deepEqual(Object.keys(el.jogadores), ['ana'])

    host.disparar('salaAoVivo', {
      acao: 'gravar',
      codigo,
      uid: 'bia',
      caminho: 'players/bia',
      valor: { x: 5, y: 0 },
    })
    assert.deepEqual(Object.keys(el.jogadores).sort(), ['ana', 'bia'])
    assert.deepEqual(el.jogadores.bia, { x: 5, y: 0 })

    await el.mover(3)
    assert.equal(el.jogadores.ana.x, 3, 'quem escreveu vê na hora')
    assert.equal(el.jogadores.ana.y, 0, 'atualizar não apaga o que não veio')

    host.disparar('salaAoVivo', {
      acao: 'empurrar',
      codigo,
      uid: 'bia',
      caminho: 'hits',
      valor: { m: 'slime', d: 5, by: 'bia' },
    })
    assert.deepEqual(el.golpes, [{ m: 'slime', d: 5, by: 'bia' }])
    assert.equal(host.arvoreDaSala(codigo).hits, undefined, 'o anfitrião consumiu o golpe')

    assert.deepEqual(
      host.chamadas.filter((c) => c.capacidade === 'salaAoVivo').map((c) => c.metodo),
      [
        'conviteRecebido',
        'criar',
        'observar',
        'observarFilhos',
        'horaDoServidor',
        'gravar',
        'aoCair',
        'aoCair',
        'horaDoServidor',
        'atualizar',
        'apagar',
      ],
      'o outro jogador não entra em chamadas: chamadas é o que o JOGO pediu',
    )

    montagem.desmontar()
    const antes = el.jogadores
    host.disparar('salaAoVivo', { acao: 'apagar', codigo, caminho: 'players/bia' })
    assert.equal(el.jogadores, antes, 'desmontado, o jogo não ouve mais a sala')
  })

  test('aberto por convite, o jogo entra sozinho e joga do lado do convidado', async () => {
    const host = criarHostFalso({ uid: 'bia', nome: 'Bia', convite: ' abc23' })
    host.disparar('salaAoVivo', {
      acao: 'criar',
      codigo: 'ABC23',
      uid: 'ana',
      nome: 'Ana',
      meta: { region: 'greenwood' },
    })
    assert.equal(host.salaAoVivo.conviteRecebido(), 'ABC23')
    const el = {}
    coop.mount(el, host)
    const r = await el.aoAbrir
    assert.equal(r.ok, true)
    assert.equal(r.meta.host, 'ana')
    assert.deepEqual(r.eu, { uid: 'bia', nome: 'Bia' })
    await tique()
    assert.deepEqual(Object.keys(el.jogadores), ['bia'])
    await el.golpear('slime', 9)
    const [golpe] = Object.values(host.arvoreDaSala('ABC23').hits)
    assert.deepEqual(golpe, { m: 'slime', d: 9, by: 'bia' }, 'o convidado só empurra a intenção')
  })

  test('sem conta não há sala', async () => {
    const host = criarHostFalso()
    host.disparar('salaAoVivo', { acao: 'criar', codigo: 'ABC23', uid: 'ana' })
    assert.deepEqual(await host.salaAoVivo.entrar('ABC23'), { erro: 'sem-conta' })
    await assert.rejects(host.salaAoVivo.criar({ meta: {} }), { codigo: 'sem-conta' })
    host.disparar('identidade', { uid: 'bia', nome: 'Bia' })
    assert.equal((await host.salaAoVivo.entrar('ABC23')).ok, true)
  })

  test('sala que não existe, ou código que não pode ser código, é nao-encontrada', async () => {
    const host = criarHostFalso({ uid: 'bia' })
    const erros = []
    for (const codigo of ['ZZZZZ', 'ABC/../x', '', 'AB', null]) {
      erros.push((await host.salaAoVivo.entrar(codigo)).erro)
    }
    assert.deepEqual(erros, Array(5).fill('nao-encontrada'))
    for (const e of [...erros, 'sem-conta']) assert.ok(ERROS_DA_SALA_AO_VIVO.includes(e))
  })

  test('host, hostName e createdAt do meta são do host, não do jogo', async () => {
    const host = criarHostFalso({ uid: 'ana', nome: 'Ana Maria de Souza Albuquerque Neto' })
    const { codigo } = await host.salaAoVivo.criar({
      meta: { host: 'intruso', hostName: 'x', createdAt: 1, seed: 3 },
    })
    const { meta } = host.arvoreDaSala(codigo)
    assert.equal(meta.host, 'ana', 'o jogo não cria sala em nome de outro')
    assert.equal(meta.hostName, 'Ana Maria de Souza Albuq', '24 caracteres, como o RoqueOS')
    assert.notEqual(meta.createdAt, 1)
    assert.equal(meta.seed, 3)
  })

  test('salaAoVivo: false tira a capacidade, e o outro jogador junto', () => {
    const host = criarHostFalso({ salaAoVivo: false })
    assert.equal(host.salaAoVivo, undefined)
    assert.throws(() => host.disparar('salaAoVivo', { acao: 'sumir', codigo: 'ABC23' }), /false/)
    assert.throws(() => host.disparar('conexao', false), /false/)
  })

  test('disparar com ação que não existe é erro do teste', () => {
    assert.throws(
      () => criarHostFalso().disparar('salaAoVivo', { acao: 'voar', codigo: 'ABC23' }),
      /não conhece a ação "voar"/,
    )
  })
})

describe('salaAoVivo: as operações, ida e volta', () => {
  test('gravar substitui, ler devolve, null apaga', async () => {
    const { s, codigo } = await salaDaAna()
    assert.equal(await s.gravar(codigo, 'mobs', { snap: 'a', wave: 1 }), true)
    assert.deepEqual(await s.ler(codigo, 'mobs'), { snap: 'a', wave: 1 })
    await s.gravar(codigo, 'mobs', { wave: 2 })
    assert.deepEqual(await s.ler(codigo, 'mobs'), { wave: 2 }, 'gravar substitui, não funde')
    assert.equal(await s.ler(codigo, 'mobs/wave'), 2)
    await s.gravar(codigo, 'mobs', null)
    assert.equal(await s.ler(codigo, 'mobs'), null)
    assert.equal(await s.ler(codigo, 'nada/aqui'), null)
  })

  test('atualizar mexe só nas chaves que vieram, e a chave pode ser um caminho', async () => {
    const { host, s, codigo } = await salaDaAna()
    await s.atualizar(codigo, 'blocks', { '3_-7/1234': 5, '3_-7/1235': 6, '0_0/7': 2 })
    await s.atualizar(codigo, 'blocks', { '3_-7/1234': null })
    assert.deepEqual(await s.ler(codigo, 'blocks'), { '0_0': { 7: 2 }, '3_-7': { 1235: 6 } })
    await s.atualizar(codigo, 'meta', { host: 'bia' })
    const { meta } = host.arvoreDaSala(codigo)
    assert.equal(meta.host, 'bia', 'a sucessão do RoqueCraft é um atualizar no meta')
    assert.equal(meta.seed, 1, 'e o seed continua lá')
    assert.equal(await s.atualizar(codigo, 'x', {}), true, 'atualizar vazio não faz nada')
  })

  test('atualizar com uma chave ancestral de outra é erro, como no banco', async () => {
    const { s, codigo } = await salaDaAna()
    assert.throws(() => s.atualizar(codigo, '', { a: 1, 'a/b': 2 }), /ancestral/)
    assert.throws(() => s.atualizar(codigo, '', [1, 2]), TypeError)
  })

  test('empurrar cria chaves que ordenam como foram criadas', async () => {
    const { s, codigo } = await salaDaAna()
    const chaves = []
    for (let i = 0; i < 5; i++) chaves.push(await s.empurrar(codigo, 'chat', { i }))
    for (const c of chaves) assert.match(c, /^[-0-9A-Za-z_]{20}$/)
    assert.deepEqual([...chaves].sort(compararChaves), chaves)
    assert.deepEqual(Object.keys(await s.ler(codigo, 'chat')), chaves)
    assert.deepEqual(await s.ler(codigo, `chat/${chaves[2]}`), { i: 2 })
  })

  test('duas chaves no mesmo milissegundo continuam em ordem', () => {
    const proxima = criarGeradorDeChaves({ agora: () => 1_790_000_000_000, aleatorio: () => 0.5 })
    const chaves = Array.from({ length: 4 }, proxima)
    assert.equal(new Set(chaves).size, 4)
    assert.deepEqual([...chaves].sort(), chaves)
  })

  test('apagar a última folha poda as pastas que ficaram vazias', async () => {
    const { host, s, codigo } = await salaDaAna()
    await s.gravar(codigo, 'a/b/c', 1)
    await s.apagar(codigo, 'a/b/c')
    assert.equal(await s.ler(codigo, 'a'), null)
    assert.equal('a' in host.arvoreDaSala(codigo), false)
  })

  test('folha que vira pasta e pasta que vira folha', async () => {
    const { s, codigo } = await salaDaAna()
    await s.gravar(codigo, 'relogio', 5)
    await s.gravar(codigo, 'relogio/ticks', 10)
    assert.deepEqual(await s.ler(codigo, 'relogio'), { ticks: 10 })
    await s.gravar(codigo, 'relogio', 7)
    assert.equal(await s.ler(codigo, 'relogio'), 7)
    await s.apagar(codigo, 'relogio/ticks')
    assert.equal(await s.ler(codigo, 'relogio'), 7, 'apagar abaixo de uma folha não muda a folha')
  })

  test('cota estourada no meio da escrita: false, e a sala fica como estava', async () => {
    const memoria = armazenamentoEmMemoria()
    let escritas = 0
    let falharNa = -1
    const storage = {
      getItem: (k) => memoria.getItem(k),
      setItem(k, v) {
        if (++escritas === falharNa) throw new Error('QuotaExceededError')
        memoria.setItem(k, v)
      },
      removeItem: (k) => memoria.removeItem(k),
      key: (i) => memoria.key(i),
      get length() {
        return memoria.length
      },
    }
    const foto = () =>
      Object.fromEntries(
        Array.from({ length: memoria.length }, (_, i) => memoria.key(i)).map((k) => [
          k,
          memoria.getItem(k),
        ]),
      )
    const avisos = []
    const { capacidade: s } = criarSalaAoVivo({
      storage,
      jogoId: 'x',
      jogador: () => ({ uid: 'ana', nome: null }),
      link: (c) => c,
      convite: () => null,
      registro: { warn: (m) => avisos.push(m) },
    })
    const { codigo } = await s.criar({ meta: { seed: 1 } })
    await s.gravar(codigo, 'mundo', { a: 1, b: 2 })
    const antes = foto()
    falharNa = escritas + 3
    assert.equal(await s.gravar(codigo, 'mundo', { a: 9, b: 9, c: 9 }), false)
    assert.deepEqual(await s.ler(codigo, 'mundo'), { a: 1, b: 2 }, 'nem meia escrita na memória')
    assert.deepEqual(foto(), antes, 'nem meia escrita no Storage')
    assert.ok(avisos.some((a) => /recusou a escrita/.test(a)))
  })

  test('apagar a sala inteira', async () => {
    const { host, s, codigo } = await salaDaAna()
    await s.gravar(codigo, 'players/ana', { x: 1 })
    await s.apagar(codigo, '')
    assert.equal(host.arvoreDaSala(codigo), null)
    assert.deepEqual(await s.entrar(codigo), { erro: 'nao-encontrada' })
  })
})

describe('salaAoVivo: o valor volta como o Realtime Database devolve', () => {
  test('array vai e volta array; objeto de índices esparso volta objeto', async () => {
    const { s, codigo } = await salaDaAna()
    await s.gravar(codigo, 'mobs', { snap: [{ u: 1 }, { u: 2 }], wave: 3 })
    const mobs = await s.ler(codigo, 'mobs')
    assert.ok(Array.isArray(mobs.snap), 'a Runa e o RoqueCraft testam Array.isArray(snap)')
    assert.deepEqual(mobs.snap, [{ u: 1 }, { u: 2 }])

    await s.gravar(codigo, 'buraco', [1, null, 3])
    const buraco = await s.ler(codigo, 'buraco')
    assert.ok(Array.isArray(buraco), 'mais da metade dos índices presente: array')
    assert.equal(buraco.length, 3)
    assert.equal(1 in buraco, false, 'o null do meio não existe no banco: vira buraco')

    await s.gravar(codigo, 'esparso', { 0: 'a', 9: 'b' })
    assert.deepEqual(await s.ler(codigo, 'esparso'), { 0: 'a', 9: 'b' }, 'poucos índices: objeto')
  })

  test('objeto vazio não existe no banco', async () => {
    const { s, codigo } = await salaDaAna()
    await s.gravar(codigo, 'vazio', {})
    await s.gravar(codigo, 'quase', { a: {}, b: [] })
    assert.equal(await s.ler(codigo, 'vazio'), null)
    assert.equal(await s.ler(codigo, 'quase'), null)
  })

  test('horaDoServidor é o marcador do banco e vira número ao gravar, o mesmo na escrita inteira', async () => {
    const { s, codigo } = await salaDaAna()
    const marcador = s.horaDoServidor()
    assert.deepEqual(marcador, { '.sv': 'timestamp' })
    assert.deepEqual(marcador, MARCADOR_DA_HORA)
    assert.notEqual(s.horaDoServidor(), marcador, 'cada chamada é um objeto novo')
    const antes = Date.now()
    await s.gravar(codigo, 'players/ana', { t: s.horaDoServidor(), entrou: s.horaDoServidor() })
    const { t, entrou } = await s.ler(codigo, 'players/ana')
    assert.equal(typeof t, 'number')
    assert.equal(t, entrou)
    assert.ok(t >= antes && t <= Date.now())
  })

  test('os filhos saem em ordem de chave: inteiro antes, por valor, depois texto', () => {
    assert.deepEqual(['b', '10', '2', 'a', '-1', '-Nab'].sort(compararChaves), [
      '-1',
      '2',
      '10',
      '-Nab',
      'a',
      'b',
    ])
  })

  test('o valor lido é uma cópia: mexer nele não mexe na sala', async () => {
    const { s, codigo } = await salaDaAna()
    const enviado = { itens: ['a'] }
    await s.gravar(codigo, 'bau', enviado)
    enviado.itens.push('trapaça')
    const lido = await s.ler(codigo, 'bau')
    lido.itens.push('outra')
    assert.deepEqual(await s.ler(codigo, 'bau'), { itens: ['a'] })
  })
})

describe('salaAoVivo: o que quem porta o jogo erra, e o teste pega na hora', () => {
  const ruins = ['players/../meta', '..', '.', 'a//b', 'players/', '/a', 'a.b', 'a#b', 'a$b']
  ruins.push('a[0]', 'a]', 'a\u0001b', 'a\u007fb', 'x'.repeat(769))

  test('caminho proibido é TypeError síncrono em toda operação', async () => {
    const { s, codigo } = await salaDaAna()
    const operacoes = {
      ler: (c) => s.ler(codigo, c),
      gravar: (c) => s.gravar(codigo, c, 1),
      atualizar: (c) => s.atualizar(codigo, c, { a: 1 }),
      'atualizar (chave)': (c) => s.atualizar(codigo, '', { [c]: 1 }),
      apagar: (c) => s.apagar(codigo, c),
      empurrar: (c) => s.empurrar(codigo, c, 1),
      observar: (c) => s.observar(codigo, c, () => {}),
      observarFilhos: (c) => s.observarFilhos(codigo, c, { adicionado() {} }),
      aoCair: (c) => s.aoCair(codigo, c, 'apagar'),
    }
    for (const [nome, operacao] of Object.entries(operacoes)) {
      for (const caminho of ruins) {
        assert.throws(() => operacao(caminho), TypeError, `${nome}(${JSON.stringify(caminho)})`)
      }
    }
    assert.throws(() => s.gravar(codigo, 'players/../meta', 1), /não há pasta de cima/)
    assert.throws(() => s.gravar(codigo, 'a//b', 1), /segmento vazio/)
  })

  test('undefined, função, NaN, Date e chave proibida no valor são TypeError síncrono, com o ponto exato', async () => {
    const { s, codigo } = await salaDaAna()
    assert.throws(() => s.gravar(codigo, 'p', { a: { b: undefined } }), /p.*\.a\.b é undefined/)
    assert.throws(() => s.gravar(codigo, 'p', undefined), /undefined/)
    assert.throws(() => s.gravar(codigo, 'p', [1, undefined]), /undefined/)
    assert.throws(() => s.empurrar(codigo, 'hits', { m: undefined }), /undefined/)
    assert.throws(() => s.atualizar(codigo, 'p', { x: undefined }), /undefined/)
    assert.throws(() => s.gravar(codigo, 'p', NaN), /NaN/)
    assert.throws(() => s.gravar(codigo, 'p', { x: Infinity }), /Infinity/)
    assert.throws(() => s.gravar(codigo, 'p', { f() {} }), /function/)
    assert.throws(() => s.gravar(codigo, 'p', { d: new Date() }), /Date/)
    assert.throws(() => s.gravar(codigo, 'p', { m: new Map() }), /Map/)
    assert.throws(() => s.gravar(codigo, 'p', { 'a.b': 1 }), TypeError)
    assert.throws(() => s.gravar(codigo, 'p', { 'a/b': 1 }), TypeError)
    assert.throws(() => s.gravar(codigo, 'p', { '.sv': 'increment' }), /horaDoServidor/)
    assert.throws(() => s.gravar(codigo, '', 5), /sala inteira/)
    assert.equal(await s.ler(codigo, 'p'), null, 'nada do que foi recusado chegou à sala')
  })

  test('observar sem função, observarFilhos sem nenhuma, ultimos torto e aoCair com ação errada', async () => {
    const { s, codigo } = await salaDaAna()
    assert.throws(() => s.observar(codigo, 'a'), TypeError)
    assert.throws(() => s.observarFilhos(codigo, 'a', {}), /não observa nada/)
    assert.throws(() => s.observarFilhos(codigo, 'a', { adicionado: 1 }), TypeError)
    assert.throws(
      () => s.observarFilhos(codigo, 'a', { adicionado() {} }, { ultimos: 0 }),
      TypeError,
    )
    assert.throws(() => s.aoCair(codigo, 'a', 'remove'), /apagar ou cancelar/)
    assert.throws(() => s.conectado(), TypeError)
    assert.throws(() => s.criar({ meta: { x: undefined } }), /undefined/)
  })

  test('fora da sala: escrita resolve false, leitura rejeita, observar não entrega nada', async () => {
    const host = criarHostFalso({ uid: 'ana' })
    const s = host.salaAoVivo
    host.disparar('salaAoVivo', { acao: 'criar', codigo: 'ALHEI', uid: 'bia' })
    assert.equal(await s.gravar('ALHEI', 'players/ana', { x: 1 }), false)
    assert.equal(await s.atualizar('ALHEI', 'meta', { host: 'ana' }), false)
    assert.equal(await s.apagar('ALHEI', ''), false)
    assert.equal(await s.empurrar('ALHEI', 'hits', { m: 1 }), null)
    assert.equal(await s.aoCair('ALHEI', '', 'apagar'), false)
    await assert.rejects(s.ler('ALHEI', 'meta'), { codigo: 'fora-da-sala' })
    const vistos = []
    const parar = s.observar('ALHEI', 'meta', (v) => vistos.push(v))
    assert.equal(typeof parar, 'function')
    await tique()
    assert.deepEqual(vistos, [])
    assert.equal(host.arvoreDaSala('ALHEI').meta.host, 'bia', 'nada mudou')
    assert.ok(host.avisosDoHost.some((a) => /gravar em "ALHEI".*não criou nem entrou/.test(a)))

    assert.equal((await s.entrar('alhei')).ok, true)
    assert.equal(await s.gravar('alhei', 'players/ana', { x: 1 }), true, 'depois de entrar, pode')
    s.sair('ALHEI')
    assert.equal(await s.gravar('ALHEI', 'players/ana', { x: 2 }), false, 'depois de sair, não')
  })
})

describe('salaAoVivo: observar', () => {
  // No banco de verdade a primeira entrega chega depois. O jogo que conta com
  // ela dentro da própria chamada passaria aqui e quebraria no RoqueOS.
  test('a primeira entrega não sai dentro da própria chamada', async () => {
    const { s, codigo } = await salaDaAna()
    await s.gravar(codigo, 'hits/k1', { m: 'a' })
    const vistos = []
    s.observar(codigo, 'meta', (v) => vistos.push(['valor', v.host]))
    s.observarFilhos(codigo, 'hits', { adicionado: (k) => vistos.push(['filho', k]) })
    s.conectado((c) => vistos.push(['conectado', c]))
    assert.deepEqual(vistos, [])
    await tique()
    assert.deepEqual(vistos, [
      ['valor', 'ana'],
      ['filho', 'k1'],
      ['conectado', true],
    ])
  })

  test('observar caminho vazio entrega null, não silêncio', async () => {
    const { s, codigo } = await salaDaAna()
    const vistos = []
    s.observar(codigo, 'mobs', (v) => vistos.push(v))
    await tique()
    assert.deepEqual(vistos, [null])
  })

  test('parar cala de vez, antes ou depois da primeira entrega', async () => {
    const { host, s, codigo } = await salaDaAna()
    const vistos = []
    const antes = [
      s.observar(codigo, 'players', (v) => vistos.push(v)),
      s.observarFilhos(codigo, 'players', { adicionado: (k) => vistos.push(k) }),
      s.conectado((c) => vistos.push(c)),
    ]
    antes.forEach((parar) => parar())
    await tique()
    const depois = [
      s.observar(codigo, 'players', (v) => vistos.push(v)),
      s.observarFilhos(codigo, 'players', { adicionado: (k) => vistos.push(k) }),
      s.conectado((c) => vistos.push(c)),
    ]
    await tique()
    const entregues = vistos.length
    depois.forEach((parar) => parar())
    await s.gravar(codigo, 'players/ana', { x: 1 })
    host.disparar('conexao', false)
    assert.equal(vistos.length, entregues, 'nada chega depois de parar')
    assert.deepEqual(vistos, [null, true], 'só as primeiras entregas dos de depois')
  })

  test('observar só entrega quando o valor daquele caminho muda', async () => {
    const { s, codigo } = await salaDaAna()
    await s.gravar(codigo, 'players/ana', { x: 1, y: 1 })
    const vistos = []
    s.observar(codigo, 'players/ana', (v) => vistos.push(v))
    await tique()
    await s.gravar(codigo, 'players/bia', { x: 9 })
    await s.atualizar(codigo, 'players/ana', { x: 1 })
    assert.equal(vistos.length, 1, 'outro caminho, ou o mesmo valor, não é mudança')
    await s.atualizar(codigo, 'players/ana', { x: 2 })
    await s.gravar(codigo, 'players', { ana: { x: 3 } })
    await s.apagar(codigo, 'players')
    assert.deepEqual(vistos, [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3 }, null])
  })

  test('observarFilhos: quem chega, quem muda e quem sai, com o valor que tinha', async () => {
    const { s, codigo } = await salaDaAna()
    await s.gravar(codigo, 'mobilia', { a: { v: 1 }, b: { v: 1 } })
    const eventos = []
    s.observarFilhos(codigo, 'mobilia', {
      adicionado: (k, v) => eventos.push(['+', k, v]),
      mudado: (k, v) => eventos.push(['~', k, v]),
      removido: (k, v) => eventos.push(['-', k, v]),
    })
    await tique()
    await s.gravar(codigo, 'mobilia/b', { v: 2 })
    await s.gravar(codigo, 'mobilia/c', { v: 1 })
    await s.apagar(codigo, 'mobilia/a')
    await s.gravar(codigo, 'mobilia/c', { v: 1 })
    assert.deepEqual(eventos, [
      ['+', 'a', { v: 1 }],
      ['+', 'b', { v: 1 }],
      ['~', 'b', { v: 2 }],
      ['+', 'c', { v: 1 }],
      ['-', 'a', { v: 1 }],
    ])
  })

  test('observarFilhos com ultimos: só os N últimos, e quem sai da janela chega como removido', async () => {
    const { s, codigo } = await salaDaAna()
    const chaves = []
    for (const texto of ['um', 'dois', 'três'])
      chaves.push(await s.empurrar(codigo, 'chat', { texto }))
    const eventos = []
    s.observarFilhos(
      codigo,
      'chat',
      {
        adicionado: (k, v) => eventos.push(['+', v.texto]),
        removido: (k, v) => eventos.push(['-', v.texto]),
      },
      { ultimos: 2 },
    )
    await tique()
    assert.deepEqual(eventos, [
      ['+', 'dois'],
      ['+', 'três'],
    ])
    await s.empurrar(codigo, 'chat', { texto: 'quatro' })
    assert.deepEqual(eventos.slice(2), [
      ['-', 'dois'],
      ['+', 'quatro'],
    ])
    await s.apagar(codigo, `chat/${chaves[2]}`)
    assert.deepEqual(eventos.slice(4), [
      ['-', 'três'],
      ['+', 'dois'],
    ])
  })

  test('sair para os ouvintes daquela sala e mais nenhum', async () => {
    const { host, s, codigo } = await salaDaAna()
    host.disparar('salaAoVivo', { acao: 'criar', codigo: 'OUTRA', uid: 'bia' })
    await s.entrar('OUTRA')
    const vistos = []
    s.observar(codigo, 'players', (v) => vistos.push(['minha', v]))
    s.observar('OUTRA', 'players', (v) => vistos.push(['outra', v]))
    await tique()
    s.sair(codigo)
    host.disparar('salaAoVivo', { acao: 'gravar', codigo, caminho: 'players/bia', valor: 1 })
    host.disparar('salaAoVivo', {
      acao: 'gravar',
      codigo: 'OUTRA',
      caminho: 'players/bia',
      valor: 1,
    })
    assert.deepEqual(vistos, [
      ['minha', null],
      ['outra', null],
      ['outra', { bia: 1 }],
    ])
  })
})

describe('salaAoVivo: a conexão e o aoCair', () => {
  test('conectado entrega o estado logo depois e a cada troca', async () => {
    const { host, s } = await salaDaAna()
    const vistos = []
    s.conectado((c) => vistos.push(c))
    await tique()
    host.disparar('conexao', false)
    host.disparar('conexao', false)
    host.disparar('conexao', true)
    assert.deepEqual(vistos, [true, false, true], 'trocar para o mesmo estado não avisa')
  })

  test('cair roda o que esta janela armou, e esquece: quem volta precisa rearmar', async () => {
    const { host, s, codigo } = await salaDaAna()
    await s.gravar(codigo, 'players/ana', { x: 1 })
    await s.gravar(codigo, 'mobs', { wave: 1 })
    assert.equal(await s.aoCair(codigo, 'players/ana', 'apagar'), true)
    host.disparar('conexao', false)
    assert.equal(await s.ler(codigo, 'players/ana'), null, 'a presença sumiu com a queda')
    assert.deepEqual(await s.ler(codigo, 'mobs'), { wave: 1 }, 'o que não foi armado ficou')
    host.disparar('conexao', true)
    await s.gravar(codigo, 'players/ana', { x: 1 })
    host.disparar('conexao', false)
    assert.deepEqual(await s.ler(codigo, 'players/ana'), { x: 1 }, 'sem rearmar, não some')
  })

  test('cancelar desarma o caminho e tudo abaixo dele, como o onDisconnect().cancel()', async () => {
    const { host, s, codigo } = await salaDaAna()
    await s.gravar(codigo, 'players/ana', { x: 1 })
    await s.gravar(codigo, 'mobs', { wave: 1 })
    await s.aoCair(codigo, 'players/ana', 'apagar')
    await s.aoCair(codigo, 'mobs', 'apagar')
    await s.aoCair(codigo, 'players', 'cancelar')
    host.disparar('conexao', false)
    assert.deepEqual(await s.ler(codigo, 'players/ana'), { x: 1 }, 'desarmado por cima')
    assert.equal(await s.ler(codigo, 'mobs'), null, 'o outro caminho continuou armado')

    host.disparar('conexao', true)
    await s.aoCair(codigo, '', 'apagar')
    await s.aoCair(codigo, 'players/ana', 'apagar')
    await s.aoCair(codigo, '', 'cancelar')
    host.disparar('conexao', false)
    assert.notEqual(host.arvoreDaSala(codigo), null, "cancelar em '' desarma tudo da sala")
  })

  test('o anfitrião que arma a sala inteira leva a sala junto quando cai', async () => {
    const { host, s, codigo } = await salaDaAna()
    await s.aoCair(codigo, '', 'apagar')
    host.disparar('conexao', false)
    assert.equal(host.arvoreDaSala(codigo), null)
  })

  test('o outro jogador cai: o que ele armou some, e quem observa vê', async () => {
    const { host, s, codigo } = await salaDaAna()
    const vistos = []
    s.observar(codigo, 'players', (v) => vistos.push(v && Object.keys(v)))
    await tique()
    const bia = { codigo, uid: 'bia' }
    host.disparar('salaAoVivo', { ...bia, acao: 'gravar', caminho: 'players/bia', valor: { x: 1 } })
    host.disparar('salaAoVivo', { ...bia, acao: 'aoCair', caminho: 'players/bia' })
    host.disparar('salaAoVivo', { acao: 'cair', uid: 'bia' })
    assert.deepEqual(vistos, [null, ['bia'], null])
  })
})

describe('salaAoVivo: recusar, o teste no papel da regra do banco', () => {
  test('escrita recusada resolve false e não muda nada: o compare-and-set da mobília', async () => {
    const pedidos = []
    let host = null
    // A regra do RoqueCraft: mobilia/$k só aceita v = v anterior + 1.
    const recusar = (pedido) => {
      pedidos.push(pedido)
      if (pedido.operacao !== 'gravar' || !pedido.caminho.startsWith('mobilia/')) return false
      const atual = host.arvoreDaSala(pedido.codigo)?.mobilia?.[pedido.caminho.split('/')[1]]
      return (pedido.valor?.v ?? 0) !== (atual?.v ?? 0) + 1
    }
    const sala = await salaDaAna({ recusar })
    host = sala.host
    const { s, codigo } = sala
    assert.equal(await s.gravar(codigo, 'mobilia/bau', { v: 1, itens: ['a'] }), true)
    assert.equal(await s.gravar(codigo, 'mobilia/bau', { v: 1, itens: ['b'] }), false)
    assert.deepEqual(await s.ler(codigo, 'mobilia/bau'), { v: 1, itens: ['a'] })
    assert.equal(await s.gravar(codigo, 'mobilia/bau', { v: 2, itens: ['b'] }), true)
    assert.deepEqual(pedidos.at(-1), {
      operacao: 'gravar',
      codigo,
      caminho: 'mobilia/bau',
      uid: 'ana',
      valor: { v: 2, itens: ['b'] },
    })
  })

  test('cada operação passa pela regra, com o caminho que a regra do banco veria', async () => {
    const pedidos = []
    const { s, codigo } = await salaDaAna({
      recusar: (p) => {
        pedidos.push([p.operacao, p.caminho])
        return true
      },
    })
    assert.equal(await s.atualizar(codigo, 'meta', { host: 'ana' }), false)
    assert.equal(await s.apagar(codigo, 'players/bia'), false)
    const chave = await s.empurrar(codigo, 'hits', { m: 1 })
    assert.equal(chave, null)
    assert.equal(await s.aoCair(codigo, '', 'apagar'), false)
    await assert.rejects(s.ler(codigo, 'meta'), { codigo: 'indisponivel' })
    assert.deepEqual(
      pedidos.map(([o]) => o),
      ['atualizar', 'apagar', 'empurrar', 'aoCair', 'ler'],
    )
    assert.match(pedidos[2][1], /^hits\/[-0-9A-Za-z_]{20}$/, 'o empurrar é julgado no filho novo')
  })
})

describe('salaAoVivo no host de desenvolvimento: abas do mesmo navegador', () => {
  const abrir = (janela) =>
    criarHostDeDesenvolvimento({ jogoId: 'coopdementira', janela, registro: silencio })

  /** A aba A cria a sala; a aba B abre o link dela. As duas dividem o localStorage. */
  async function duasAbas() {
    const dados = new Map()
    const abaA = janelaFalsa({ dados, href: 'http://localhost:5173/?nivel=2' })
    const hostA = abrir(abaA)
    const { codigo, link, eu: euA } = await hostA.salaAoVivo.criar({ meta: { seed: 7 } })
    const abaB = janelaFalsa({ dados, href: link })
    const hostB = abrir(abaB)
    const r = await hostB.salaAoVivo.entrar(hostB.salaAoVivo.conviteRecebido())
    return { dados, abaA, abaB, a: hostA.salaAoVivo, b: hostB.salaAoVivo, codigo, link, euA, r }
  }

  test('o link abre a sala na outra aba, com o meta que a primeira gravou', async () => {
    const { codigo, link, euA, r } = await duasAbas()
    assert.equal(link, `http://localhost:5173/?nivel=2&sala=${codigo}`)
    assert.equal(r.ok, true)
    assert.equal(r.meta.host, euA.uid)
    assert.match(r.eu.uid, /^aba-[A-Z2-9]{5}$/)
    assert.notEqual(r.eu.uid, euA.uid, 'cada aba é um jogador')
  })

  test('as duas abas publicam presença ao mesmo tempo e nenhuma apaga a outra', async () => {
    const { dados, abaA, abaB, a, b, codigo, euA, r } = await duasAbas()
    const vistosA = []
    const vistosB = []
    a.observar(codigo, 'players', (p) => vistosA.push(p))
    b.observar(codigo, 'players', (p) => vistosB.push(p))
    await tique()
    // As duas escrevem antes de qualquer uma ouvir a outra, como duas abas a 10 Hz.
    for (let passo = 1; passo <= 3; passo++) {
      await a.gravar(codigo, `players/${euA.uid}`, { x: passo, t: a.horaDoServidor() })
      await b.gravar(codigo, `players/${r.eu.uid}`, { x: -passo, t: b.horaDoServidor() })
    }
    abaA.entregarStorage()
    abaB.entregarStorage()
    for (const vistos of [vistosA, vistosB]) {
      const ultimo = vistos.at(-1)
      assert.deepEqual(Object.keys(ultimo).sort(), [euA.uid, r.eu.uid].sort())
      assert.equal(ultimo[euA.uid].x, 3)
      assert.equal(ultimo[r.eu.uid].x, -3)
    }
    const folhas = [...dados.keys()].filter((k) => k.includes(`:salaAoVivo:${codigo}/players/`))
    assert.equal(folhas.length, 4, 'uma chave por folha: x e t de cada jogador')
  })

  test('a outra aba recebe a escrita inteira de uma vez, nunca meio golpe', async () => {
    const { abaA, a, b, codigo } = await duasAbas()
    const golpes = []
    a.observarFilhos(codigo, 'hits', {
      adicionado(chave, golpe) {
        golpes.push(golpe)
        a.apagar(codigo, `hits/${chave}`)
      },
    })
    await tique()
    await b.empurrar(codigo, 'hits', { m: 'slime', d: 7, by: 'b' })
    assert.ok(abaA.pendentes.length > 1, 'o navegador entrega um evento por chave')
    abaA.entregarStorage()
    assert.deepEqual(golpes, [{ m: 'slime', d: 7, by: 'b' }], 'um golpe inteiro, uma vez')
    assert.equal(await a.ler(codigo, 'hits'), null, 'e consumido')
  })

  test('fechar a aba do anfitrião roda o aoCair: a sala some para quem ficou', async () => {
    const { abaA, abaB, a, b, codigo, euA } = await duasAbas()
    await a.gravar(codigo, `players/${euA.uid}`, { x: 1 })
    await a.aoCair(codigo, `players/${euA.uid}`, 'apagar')
    await a.aoCair(codigo, '', 'apagar')
    abaB.entregarStorage()
    const meta = []
    b.observar(codigo, 'meta', (m) => meta.push(m && m.host))
    await tique()
    assert.deepEqual(meta, [euA.uid])
    abaA.emitir('pagehide')
    abaB.entregarStorage()
    assert.deepEqual(meta, [euA.uid, null], 'o anfitrião saiu e levou a sala')
    assert.equal(await b.ler(codigo, ''), null)
  })

  // Medido no WebKit 26.4 (Playwright 1.60): o evento `storage` só chega à aba
  // que já leu o localStorage. A aba que abriu o link e ainda não entrou na
  // sala não pode ficar surda: o host lê o localStorage ao nascer.
  test('o host lê o localStorage ao nascer, porque o WebKit só avisa quem já leu', () => {
    const janela = janelaFalsa()
    const lidas = []
    const getItem = janela.localStorage.getItem
    janela.localStorage.getItem = (k) => {
      lidas.push(k)
      return getItem(k)
    }
    abrir(janela)
    assert.ok(lidas.length > 0)
  })

  test('fechar a aba do convidado só tira a presença dele', async () => {
    const { abaA, abaB, a, b, codigo, r } = await duasAbas()
    await b.gravar(codigo, `players/${r.eu.uid}`, { x: 1 })
    await b.aoCair(codigo, `players/${r.eu.uid}`, 'apagar')
    abaA.entregarStorage()
    assert.deepEqual(Object.keys(await a.ler(codigo, 'players')), [r.eu.uid])
    abaB.emitir('pagehide')
    abaA.entregarStorage()
    assert.equal(await a.ler(codigo, 'players'), null)
    assert.notEqual(await a.ler(codigo, 'meta'), null, 'a sala continua')
  })

  test('recarregar a aba volta como o mesmo jogador; outra aba é outra pessoa', async () => {
    const { dados, abaB, link, codigo, r } = await duasAbas()
    const recarregada = abrir(janelaFalsa({ dados, sessao: abaB.sessao, href: link }))
    assert.equal((await recarregada.salaAoVivo.entrar(codigo)).eu.uid, r.eu.uid)
    const terceira = abrir(janelaFalsa({ dados, href: link }))
    assert.notEqual((await terceira.salaAoVivo.entrar(codigo)).eu.uid, r.eu.uid)
  })

  test('localStorage limpo em outra aba: quem observa recebe null', async () => {
    const { dados, abaB, b, codigo } = await duasAbas()
    const vistos = []
    b.observar(codigo, 'meta', (m) => vistos.push(m === null))
    await tique()
    dados.clear()
    abaB.emitir('storage', { key: null })
    assert.deepEqual(vistos, [false, true])
  })

  test('evento sem a lista das folhas (ou de chave solta) relê a sala do localStorage', async () => {
    const { dados, abaB, b, codigo } = await duasAbas()
    const vistos = []
    b.observar(codigo, 'mobs', (m) => vistos.push(m))
    await tique()
    dados.set(`roqueos:coopdementira:salaAoVivo:${codigo}/mobs/wave`, '4')
    abaB.emitir('storage', { key: `roqueos:coopdementira:salaAoVivo:${codigo}/mobs/wave` })
    assert.deepEqual(vistos, [null], 'folha solta não avisa: quem avisa é a chave da sala')
    abaB.emitir('storage', { key: `roqueos:coopdementira:salaAoVivo:${codigo}` })
    assert.deepEqual(vistos, [null, { wave: 4 }])
  })

  test('conectado segue o navigator.onLine', async () => {
    const janela = janelaFalsa({ onLine: false })
    const s = abrir(janela).salaAoVivo
    const vistos = []
    s.conectado((c) => vistos.push(c))
    await tique()
    janela.emitir('online')
    janela.emitir('offline')
    assert.deepEqual(vistos, [false, true, false])
  })

  test('a identidade continua a de convidado, e a sala funciona assim mesmo', async () => {
    const host = abrir(janelaFalsa())
    assert.deepEqual(host.identidade.atual(), { uid: null, nome: null })
    const { codigo, eu } = await host.salaAoVivo.criar()
    assert.match(codigo, /^[A-HJ-NP-Z2-9]{5}$/)
    assert.match(eu.uid, /^aba-/)
  })
})

describe('salaAoVivo: o código da sala', () => {
  test('código que colide com sala viva não grava por cima dela, e sem código livre desiste alto', async () => {
    const storage = armazenamentoEmMemoria()
    const sorteios = [...Array(10).fill(0), ...Array(5).fill(0.99)]
    const { capacidade: s } = criarSalaAoVivo({
      storage,
      jogoId: 'x',
      jogador: () => ({ uid: 'ana', nome: 'Ana' }),
      link: (c) => c,
      convite: () => null,
      registro: silencio,
      aleatorio: () => sorteios.shift() ?? 0,
    })
    const primeira = await s.criar({ meta: { n: 1 } })
    const segunda = await s.criar({ meta: { n: 2 } })
    assert.deepEqual([primeira.codigo, segunda.codigo], ['AAAAA', '99999'])
    assert.equal(await s.ler('AAAAA', 'meta/n'), 1, 'a primeira sala continua a mesma')
    await assert.rejects(s.criar({ meta: { n: 3 } }), /código livre/)
  })
})
