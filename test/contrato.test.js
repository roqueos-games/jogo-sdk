import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  CAPACIDADES,
  ERROS_DA_SALA,
  OBRIGATORIAS,
  OPCIONAIS,
  SITUACOES_DA_SALA,
  VERSAO_DO_CONTRATO,
  verificarHost,
} from '../src/index.js'
import { FN } from '../src/contrato.js'
import { criarHostFalso } from '../src/host/falso.js'
import { criarHostDeDesenvolvimento } from '../src/host/desenvolvimento.js'
import { janelaFalsa } from './janela-falsa.js'

describe('o contrato', () => {
  test('toda capacidade diz por que existe', () => {
    for (const [nome, c] of Object.entries(CAPACIDADES)) {
      assert.ok(c.porque?.length > 60, `${nome} sem motivo escrito`)
    }
  })

  test('as obrigatórias são as que 20 jogos já usam, e mais nenhuma', () => {
    assert.deepEqual([...OBRIGATORIAS].sort(), [
      'armazenamento',
      'audio',
      'avisar',
      'desempenho',
      'identidade',
      'idioma',
      'metricas',
      'placar',
    ])
  })

  test('sala é opcional, com as seis funções e mais nenhuma', () => {
    const { obrigatoria, forma } = CAPACIDADES.sala
    assert.equal(obrigatoria, false, 'jogo sem partida online não pode ser obrigado a ter sala')
    assert.ok(OPCIONAIS.includes('sala'))
    assert.deepEqual(Object.keys(forma).sort(), [
      'conviteRecebido',
      'criar',
      'encerrar',
      'entrar',
      'jogar',
      'observar',
    ])
    for (const [nome, f] of Object.entries(forma)) assert.equal(f, FN, `sala.${nome}`)
  })

  test('o motivo da sala diz o limite dela: sem banco, estado opaco, sem conta sem sala', () => {
    const { porque } = CAPACIDADES.sala
    assert.match(porque, /não fala com banco/)
    assert.match(porque, /opaco/)
    assert.match(porque, /Sem conta não há sala/)
  })

  test('a sala tem vocabulário fechado: três situações, quatro recusas', () => {
    assert.deepEqual([...SITUACOES_DA_SALA], ['esperando', 'jogando', 'encerrada'])
    assert.deepEqual([...ERROS_DA_SALA].sort(), ['cheia', 'nao-encontrada', 'propria', 'sem-conta'])
  })

  test('a versão do contrato continua 1: capacidade opcional nova é versão menor do SDK', () => {
    assert.equal(VERSAO_DO_CONTRATO, 1)
  })
})

describe('verificarHost', () => {
  test('o host falso cumpre o contrato', () => {
    assert.deepEqual(verificarHost(criarHostFalso()), { ok: true, problemas: [] })
  })

  test('o host de desenvolvimento cumpre o contrato', () => {
    const host = criarHostDeDesenvolvimento({ jogoId: 'x', janela: janelaFalsa() })
    assert.deepEqual(verificarHost(host), { ok: true, problemas: [] })
  })

  test('host sem uma obrigatória reprova e diz qual', () => {
    const host = criarHostFalso()
    delete host.placar
    const { ok, problemas } = verificarHost(host)
    assert.equal(ok, false)
    assert.ok(problemas.includes('falta a capacidade "placar"'), problemas.join('; '))
  })

  test('forma errada reprova no caminho exato', () => {
    const host = criarHostFalso()
    host.placar = { carregar: async () => null, salvar: 'não é função' }
    assert.deepEqual(verificarHost(host).problemas, ['placar.salvar precisa ser função'])
  })

  test('versão errada do contrato reprova', () => {
    const host = criarHostFalso()
    host.versaoDoContrato = VERSAO_DO_CONTRATO + 1
    assert.match(verificarHost(host).problemas[0], /contrato 2, o jogo fala o 1/)
  })

  test('todos os problemas saem de uma vez, não só o primeiro', () => {
    const host = criarHostFalso()
    delete host.placar
    delete host.audio
    host.avisar = null
    assert.equal(verificarHost(host).problemas.length, 3)
  })

  test('opcional exigida pelo jogo passa a ser obrigatória para ele', () => {
    assert.deepEqual(verificarHost(criarHostFalso(), { exigidas: ['ia'] }).problemas, [
      'falta a capacidade "ia"',
    ])
    const comIa = criarHostFalso({ ia: async () => 'olá' })
    assert.equal(verificarHost(comIa, { exigidas: ['ia'] }).ok, true)
  })

  test('opcional presente com forma errada reprova mesmo sem ser exigida', () => {
    const host = criarHostFalso()
    host.teclado = { reivindicar() {} }
    assert.deepEqual(verificarHost(host).problemas, ['teclado.liberar precisa ser função'])
  })

  test('os dois hosts do SDK cumprem o contrato com a sala exigida', () => {
    const dev = criarHostDeDesenvolvimento({ jogoId: 'x', janela: janelaFalsa() })
    assert.deepEqual(verificarHost(criarHostFalso(), { exigidas: ['sala'] }).problemas, [])
    assert.deepEqual(verificarHost(dev, { exigidas: ['sala'] }).problemas, [])
  })

  test('host sem sala reprova quando o jogo exige, e passa quando não exige', () => {
    const semSala = criarHostFalso({ sala: false })
    assert.deepEqual(verificarHost(semSala, { exigidas: ['sala'] }).problemas, [
      'falta a capacidade "sala"',
    ])
    assert.equal(verificarHost(semSala).ok, true)
  })

  test('sala com forma errada reprova no caminho exato', () => {
    const host = criarHostFalso()
    host.sala = { ...host.sala, jogar: 'não é função' }
    delete host.sala.conviteRecebido
    assert.deepEqual(verificarHost(host).problemas, [
      'sala.jogar precisa ser função',
      'sala.conviteRecebido precisa ser função',
    ])
  })

  test('exigir capacidade que não existe é erro do jogo, e aparece', () => {
    assert.match(verificarHost(criarHostFalso(), { exigidas: ['camera'] }).problemas[0], /camera/)
  })

  test('host ausente', () => {
    assert.deepEqual(verificarHost(undefined), { ok: false, problemas: ['host ausente'] })
  })
})
