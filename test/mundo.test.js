import { test } from 'node:test'
import assert from 'node:assert/strict'
import { conferirFichaDoMundo, conferirAcaoDoMundo } from '../src/mundo.js'
import { CAPACIDADES, verificarHost } from '../src/index.js'
import { criarHostFalso } from '../src/host/falso.js'
import * as formatosDoMundo from '../src/mundo.js'

test('controle de movimento separa sequência de pose de ação e não transporta campos extras', () => {
  const conferir = formatosDoMundo.conferirControleDoMovimento
  assert.equal(typeof conferir, 'function')
  const original = { v: 1, seq: 7, epoca: 'm:nonce-123:2' }
  const copia = conferir(original)
  assert.deepEqual(copia, original)
  copia.seq = 8
  assert.equal(original.seq, 7)
  assert.throws(() => conferir({ ...original, seq: 0 }), TypeError)
  assert.deepEqual(conferir({ ...original, seq: 0 }, { snapshot: true }), {
    ...original,
    seq: 0,
  })
  for (const campo of [{ ultimaAcao: 8 }, { idToken: 'credencial' }, { x: 5 }, { dano: 9 }])
    assert.throws(() => conferir({ ...original, ...campo }), TypeError)
})

test('controle de movimento recusa sequência e época inválidas inclusive após serialização', () => {
  const conferir = formatosDoMundo.conferirControleDoMovimento
  assert.equal(typeof conferir, 'function')
  const base = { v: 1, seq: 1, epoca: 'm:nonce:1' }
  for (const seq of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, Infinity, '1', null])
    assert.throws(() => conferir({ ...base, seq }), TypeError)
  for (const epoca of ['', 'a'.repeat(101), 'a\n', 'a/b', 'a b', {}, null])
    assert.throws(() => conferir({ ...base, epoca }), TypeError)
  for (const v of [0, 2, '1', null]) assert.throws(() => conferir({ ...base, v }), TypeError)
  assert.throws(
    () => conferir({ ...base, toJSON: () => ({ ...base, idToken: 'credencial' }) }),
    TypeError,
  )
})

const ficha = () => ({
  heroiId: 'heroi-123',
  classId: 'aprendiz',
  prog: { level: 1 },
  equipment: {},
})

test('mundo é opcional e a presença antiga continua suficiente para jogos antigos', () => {
  assert.equal(CAPACIDADES.mundo.obrigatoria, false)
  const host = criarHostFalso()
  assert.equal(verificarHost(host).ok, true)
  assert.equal(verificarHost(host, { exigidas: ['mundo'] }).ok, false)
  host.mundo = Object.fromEntries(Object.keys(CAPACIDADES.mundo.forma).map((k) => [k, () => {}]))
  assert.equal(verificarHost(host, { exigidas: ['mundo'] }).ok, true)
  delete host.mundo.confirmarRecompensa
  assert.equal(verificarHost(host, { exigidas: ['mundo'] }).ok, false)
})

test('ficha é cópia isolada, limitada em bytes e não recebe dano, HP ou credencial', () => {
  const original = ficha()
  assert.throws(() => conferirFichaDoMundo({ prog: {}, equipment: {} }), TypeError)
  const copia = conferirFichaDoMundo(original)
  copia.prog.level = 2
  assert.equal(original.prog.level, 1)
  for (const extra of [{ hp: 999 }, { dano: 999 }, { idToken: 'segredo' }]) {
    assert.throws(() => conferirFichaDoMundo({ ...ficha(), ...extra }), TypeError)
  }
  assert.throws(
    () => conferirFichaDoMundo({ ...ficha(), prog: { texto: 'á'.repeat(2000) } }),
    TypeError,
  )
  assert.throws(() => conferirFichaDoMundo({ ...ficha(), heroiId: '../outra-conta' }), TypeError)
  assert.throws(
    () =>
      conferirFichaDoMundo(
        JSON.parse('{"heroiId":"a","classId":"a","prog":{"__proto__":{}},"equipment":{}}'),
      ),
    TypeError,
  )
})

test('intenção é fechada: cliente não manda dano ou identidade, e ficha usa o mesmo porteiro', () => {
  const trocadaNaSerializacao = Object.assign(
    Object.create({
      toJSON() {
        return { tipo: 'ataque', alvo: 'mob-1', dano: 999, uid: 'outro' }
      },
    }),
    { tipo: 'reviver' },
  )
  assert.throws(() => conferirAcaoDoMundo(trocadaNaSerializacao), TypeError)
  assert.deepEqual(conferirAcaoDoMundo({ tipo: 'ataque', alvo: 'slime-1' }), {
    tipo: 'ataque',
    alvo: 'slime-1',
  })
  assert.deepEqual(conferirAcaoDoMundo({ tipo: 'esquiva', dx: 1, dy: 0 }), {
    tipo: 'esquiva',
    dx: 1,
    dy: 0,
  })
  assert.deepEqual(conferirAcaoDoMundo({ tipo: 'ficha', ficha: ficha() }).ficha, ficha())
  for (const acao of [
    { tipo: 'ataque', alvo: 'a', dano: 999 },
    { tipo: 'ataque', alvo: 'a', uid: 'outro' },
    { tipo: 'esquiva', dx: Infinity, dy: 0 },
    { tipo: 'ganhar-xp', xp: 999 },
    { tipo: 'reviver', hp: 999 },
  ]) {
    assert.throws(() => conferirAcaoDoMundo(acao), TypeError)
  }
})

test('compatibilidade pessoal não transporta vida, e usa ID idempotente independente do cursor', () => {
  const f = { ...ficha(), condicoes: { carga: 'pesado', sentado: true } }
  assert.deepEqual(conferirFichaDoMundo(f), f)
  assert.deepEqual(conferirAcaoDoMundo({ tipo: 'fonte' }), { tipo: 'fonte' })
  const a = {
    tipo: 'pessoal',
    ficha: f,
    operacaoId: 'compra-123',
    xp: 5,
    pocoesDelta: { 'tonico-vida-1': 1 },
  }
  assert.deepEqual(conferirAcaoDoMundo(a), a)
  for (const ruim of [
    { ...a, hp: 999 },
    { ...a, operacaoId: '' },
    { ...a, operacaoId: '__proto__' },
    { ...a, operacaoId: 'constructor' },
    { ...a, operacaoId: 'prototype' },
    { ...a, xp: -1 },
    { tipo: 'condicoes', carga: 'leve', sentado: 'sim' },
    { tipo: 'fonte', hp: 999 },
  ])
    assert.throws(() => conferirAcaoDoMundo(ruim), TypeError)
})
