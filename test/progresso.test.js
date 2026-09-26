// A capacidade `progresso`: o jogo salvo na conta. Aqui se prova que os dois
// hosts do SDK separam "não tem save" (null) de "não consegui ler" (rejeição),
// que `mesclar` funde e o padrão substitui, e que recusam o que o Firestore
// recusa, com `false` e sem lançar.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { definirJogo } from '../src/index.js'
import { criarHostFalso } from '../src/host/falso.js'
import { criarHostDeDesenvolvimento } from '../src/host/desenvolvimento.js'
import {
  LIMITE_DO_DOCUMENTO,
  mesclarDocumento,
  problemaDoDocumento,
  tamanhoDoDocumento,
} from '../src/host/progresso.js'
import { janelaFalsa } from './janela-falsa.js'

const silencio = { info() {}, debug() {}, warn() {} }

/**
 * Um jogo de mentira que carrega como o RoqueCraft carrega (RC-02): leitura
 * que falhou NÃO é mundo vazio, e com ela o jogo não grava por cima.
 */
const mundo = definirJogo({
  id: 'mundodementira',
  capacidades: ['progresso'],
  montar(el, host) {
    el.carga = (async () => {
      if (!host.progresso.disponivel()) return { estado: 'nao-tentou' }
      try {
        const save = await host.progresso.carregar()
        return save ? { estado: 'carregado', save } : { estado: 'vazio' }
      } catch (erro) {
        host.avisar('Não consegui ler o seu mundo; nada foi gravado por cima.', {
          tipo: 'erro',
          fixo: true,
        })
        return { estado: 'indisponivel', codigo: erro.codigo }
      }
    })()
    el.salvar = async (blocos) => {
      const { estado } = await el.carga
      if (estado === 'indisponivel' || estado === 'nao-tentou') return false
      return host.progresso.salvar({ blocos, updatedAt: Date.now() })
    }
    return { desmontar() {} }
  },
})

describe('progresso no host falso', () => {
  test('sem save, carregar devolve null; salvar e carregar vão e voltam', async () => {
    const host = criarHostFalso({ uid: 'ana' })
    assert.equal(host.progresso.disponivel(), true)
    assert.equal(await host.progresso.carregar(), null)
    assert.equal(await host.progresso.salvar({ heroi: { nivel: 3 }, ouro: 10 }), true)
    assert.deepEqual(await host.progresso.carregar(), { heroi: { nivel: 3 }, ouro: 10 })
    assert.deepEqual(
      host.chamadas.map((c) => c.metodo),
      ['disponivel', 'carregar', 'salvar', 'carregar'],
    )
  })

  test('não consegui ler é rejeição com codigo indisponivel, nunca null', async () => {
    const host = criarHostFalso({ uid: 'ana', progresso: { falharLeitura: true } })
    await assert.rejects(host.progresso.carregar(), (erro) => {
      assert.equal(erro.codigo, 'indisponivel')
      assert.ok(erro.cause, 'com a causa')
      return true
    })
  })

  test('o jogo que confunde leitura falha com mundo vazio é pego: RC-02', async () => {
    const host = criarHostFalso({
      uid: 'ana',
      progresso: { salvo: { blocos: 900 }, falharLeitura: true },
    })
    const el = {}
    mundo.mount(el, host)
    assert.deepEqual(await el.carga, { estado: 'indisponivel', codigo: 'indisponivel' })
    assert.equal(await el.salvar(0), false, 'não grava um mundo vazio por cima')
    assert.deepEqual(host.progressoGuardado(), { blocos: 900 }, 'os meses de construção continuam')
    const [aviso] = host.chamadas.filter((c) => c.capacidade === 'avisar')
    assert.deepEqual(aviso.args[1], { tipo: 'erro', fixo: true }, 'e o aviso fica na tela')

    host.disparar('progresso', { falharLeitura: false })
    const outra = {}
    mundo.mount(outra, host)
    assert.deepEqual(await outra.carga, { estado: 'carregado', save: { blocos: 900 } })
  })

  test('salvar substitui o documento; com mesclar, funde mapa com mapa', async () => {
    const host = criarHostFalso({ uid: 'ana' })
    const p = host.progresso
    await p.salvar({ heroi: { nivel: 3, classe: 'mago' }, ouro: 10, bolsa: ['a', 'b'] })
    await p.salvar({ heroi: { nivel: 4 }, bolsa: ['c'] }, { mesclar: true })
    assert.deepEqual(host.progressoGuardado(), {
      heroi: { nivel: 4, classe: 'mago' },
      ouro: 10,
      bolsa: ['c'],
    })
    await p.salvar({ ouro: 1 })
    assert.deepEqual(host.progressoGuardado(), { ouro: 1 }, 'sem mesclar, o que não veio some')
  })

  test('recusa com false o que o Firestore recusa, e não grava nada', async () => {
    const host = criarHostFalso({ uid: 'ana', progresso: { salvo: { intacto: true } } })
    const recusados = {
      'undefined num campo': { a: undefined },
      'undefined dentro de mapa': { a: { b: undefined } },
      'undefined dentro de array': { a: [1, undefined] },
      'array dentro de array': { a: [[1, 2]] },
      função: { a: () => 1 },
      'instância de classe': { a: new (class Coisa {})() },
      Map: { a: new Map() },
      Date: { a: new Date(0) },
      'campo de nome vazio': { '': 1 },
      'campo __reservado__': { __x__: 1 },
      'raiz array': [1, 2],
      'raiz null': null,
      'raiz texto': 'x',
      'acima de 1 MiB': { texto: 'x'.repeat(LIMITE_DO_DOCUMENTO) },
    }
    for (const [nome, dados] of Object.entries(recusados)) {
      assert.equal(await host.progresso.salvar(dados), false, nome)
      assert.equal(
        await host.progresso.salvar(dados, { mesclar: true }),
        false,
        `${nome} (mesclar)`,
      )
    }
    assert.deepEqual(host.progressoGuardado(), { intacto: true })
    assert.ok(host.avisosDoHost.some((a) => /array dentro de array/.test(a)))
  })

  test('o save do RoqueCraft depois do portal: outrasDimensoes é array dentro de array', async () => {
    // roqueCraftSave.js:203-212 grava [[id, [cx, cz, li, id, …]], …]. O
    // firebase 12.7.0 do front recusa com "Nested arrays are not supported".
    const host = criarHostFalso({ uid: 'ana' })
    const payload = { seed: 1, outrasDimensoes: [['nether', [0, 0, 1, 2]]] }
    assert.equal(await host.progresso.salvar(payload), false)
    const consertado = { seed: 1, outrasDimensoes: [{ id: 'nether', edits: [0, 0, 1, 2] }] }
    assert.equal(
      await host.progresso.salvar(consertado),
      true,
      'array > mapa > array o Firestore aceita',
    )
  })

  test('o que o Firestore aceita, aceita: null, NaN, array de mapas, mapa aninhado', async () => {
    const host = criarHostFalso({ uid: 'ana' })
    const ok = { a: null, b: NaN, c: [{ d: [1] }], e: { f: { g: 'h' } }, i: [], j: {} }
    assert.equal(await host.progresso.salvar(ok), true)
    assert.equal(problemaDoDocumento(ok), null)
  })

  test('sem conta, disponivel é false: carregar é null sem tentar, salvar é false', async () => {
    const host = criarHostFalso({ progresso: { salvo: { x: 1 }, falharLeitura: true } })
    assert.equal(host.progresso.disponivel(), false)
    assert.equal(await host.progresso.carregar(), null, 'nem tentou ler, então não falhou')
    assert.equal(await host.progresso.salvar({ x: 2 }), false)
    host.disparar('identidade', { uid: 'ana' })
    assert.equal(host.progresso.disponivel(), true, 'segue a conta, como no RoqueOS')
  })

  test('escrita que falha é false, e mesclar sobre leitura que falha também', async () => {
    const host = criarHostFalso({ uid: 'ana', progresso: { salvo: { x: 1 }, falharEscrita: true } })
    assert.equal(await host.progresso.salvar({ x: 2 }), false)
    host.disparar('progresso', { falharEscrita: false, falharLeitura: true })
    assert.equal(await host.progresso.salvar({ y: 1 }, { mesclar: true }), false)
    assert.deepEqual(host.progressoGuardado(), { x: 1 })
  })

  test('o que volta e o que foi é cópia: mexer depois não mexe no guardado', async () => {
    const host = criarHostFalso({ uid: 'ana' })
    const dados = { bolsa: ['a'] }
    await host.progresso.salvar(dados)
    dados.bolsa.push('trapaça')
    const lido = await host.progresso.carregar()
    lido.bolsa.push('outra')
    assert.deepEqual(host.progressoGuardado(), { bolsa: ['a'] })
  })

  test('salvar nunca lança, nem com opções tortas', async () => {
    const host = criarHostFalso({ uid: 'ana' })
    assert.equal(await host.progresso.salvar({ a: 1 }, null), true)
    assert.equal(await host.progresso.salvar(), false)
  })

  test('progresso: false tira a capacidade', () => {
    const host = criarHostFalso({ progresso: false })
    assert.equal(host.progresso, undefined)
    assert.throws(() => host.disparar('progresso', {}), /progresso: false/)
  })
})

describe('progresso no host de desenvolvimento', () => {
  const abrir = (janela) =>
    criarHostDeDesenvolvimento({ jogoId: 'mundo', janela, registro: silencio })

  test('mora no localStorage em roqueos:<jogo>:progresso e volta depois de recarregar', async () => {
    const janela = janelaFalsa()
    assert.equal(await abrir(janela).progresso.salvar({ blocos: 3 }), true)
    assert.deepEqual(JSON.parse(janela.dados.get('roqueos:mundo:progresso')), { blocos: 3 })
    const recarregada = abrir(janelaFalsa({ dados: janela.dados }))
    assert.deepEqual(await recarregada.progresso.carregar(), { blocos: 3 })
  })

  test('JSON quebrado é rejeição indisponivel, e mesclar não grava por cima dele', async () => {
    const janela = janelaFalsa()
    janela.dados.set('roqueos:mundo:progresso', '{quebrado')
    const host = abrir(janela)
    await assert.rejects(host.progresso.carregar(), { codigo: 'indisponivel' })
    assert.equal(await host.progresso.salvar({ a: 1 }, { mesclar: true }), false)
    assert.equal(janela.dados.get('roqueos:mundo:progresso'), '{quebrado')
  })

  test('mesclar funde com o que estava no localStorage', async () => {
    const host = abrir(janelaFalsa())
    await host.progresso.salvar({ heroi: { nivel: 1, classe: 'mago' } })
    await host.progresso.salvar({ heroi: { nivel: 2 } }, { mesclar: true })
    assert.deepEqual(await host.progresso.carregar(), { heroi: { nivel: 2, classe: 'mago' } })
  })

  test('recusa o mesmo que o host falso: array dentro de array', async () => {
    const host = abrir(janelaFalsa())
    assert.equal(await host.progresso.salvar({ a: [[1]] }), false)
    assert.equal(await host.progresso.carregar(), null)
  })

  test('cota estourada é false, sem lançar', async () => {
    const janela = janelaFalsa()
    const host = abrir(janela)
    janela.localStorage.setItem = () => {
      throw new Error('QuotaExceededError')
    }
    assert.equal(await host.progresso.salvar({ a: 1 }), false)
  })

  test('sem localStorage (Safari privado) não há onde guardar', async () => {
    const host = abrir(janelaFalsa({ storageQuebrado: true }))
    assert.equal(host.progresso.disponivel(), false)
    assert.equal(await host.progresso.carregar(), null)
    assert.equal(await host.progresso.salvar({ a: 1 }), false)
  })
})

describe('as regras do documento', () => {
  test('o tamanho segue a conta publicada do Firestore', () => {
    // nome do documento (96) + mapa + 32; "ab": 3+1 do nome, texto "xyz" 3+1; n: 1+1, 8
    assert.equal(tamanhoDoDocumento({ ab: 'xyz', n: 1 }), 96 + (3 + 4) + (2 + 8) + 32)
  })

  test('mesclar: mapa vazio substitui, array substitui, mapa funde', () => {
    assert.deepEqual(
      mesclarDocumento({ a: { x: 1 }, b: [1, 2], c: { y: 1 } }, { a: {}, b: [3], c: { z: 2 } }),
      { a: {}, b: [3], c: { y: 1, z: 2 } },
    )
  })
})
