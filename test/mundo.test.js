import { test } from 'node:test'
import assert from 'node:assert/strict'
import { conferirFichaDoMundo, conferirAcaoDoMundo } from '../src/mundo.js'
import { CAPACIDADES, verificarHost } from '../src/index.js'
import { criarHostFalso } from '../src/host/falso.js'

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
