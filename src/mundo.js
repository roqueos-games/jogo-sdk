// Formatos públicos do mundo compartilhado. A autoridade de regras, equipamento e dano é
// do servidor do jogo; este porteiro apenas limita o que um host transporta, sem credenciais.
export const VERSAO_DO_MUNDO = 1
export const MAX_FICHA_DO_MUNDO = 3800

const palavra = /^[a-zA-Z0-9_-]{1,80}$/
const palavraValida = (v) => typeof v === 'string' && palavra.test(v)
const objeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const tamanho = (texto) => new TextEncoder().encode(texto).length

function copia(v, max) {
  let texto
  try {
    texto = JSON.stringify(v)
  } catch {
    throw new TypeError('mundo: formato não serializável')
  }
  if (typeof texto !== 'string' || tamanho(texto) > max)
    throw new TypeError('mundo: mensagem grande demais')
  const c = JSON.parse(texto)
  function conferir(o, nivel = 0) {
    if (nivel > 12) throw new TypeError('mundo: estrutura profunda demais')
    if (!o || typeof o !== 'object') return
    for (const [k, v] of Object.entries(o)) {
      if (['__proto__', 'constructor', 'prototype'].includes(k))
        throw new TypeError('mundo: chave inválida')
      conferir(v, nivel + 1)
    }
  }
  conferir(c)
  return c
}

export function conferirFichaDoMundo(ficha) {
  const f = copia(ficha, MAX_FICHA_DO_MUNDO)
  if (
    !objeto(f) ||
    !palavraValida(f.heroiId) ||
    !palavraValida(f.classId) ||
    !objeto(f.prog) ||
    !objeto(f.equipment) ||
    (f.pocoes !== undefined && !objeto(f.pocoes))
  ) {
    throw new TypeError('mundo: ficha inválida')
  }
  if (
    Object.keys(f).some((k) => !['heroiId', 'classId', 'prog', 'equipment', 'pocoes'].includes(k))
  )
    throw new TypeError('mundo: campo de ficha inválido')
  return f
}

const CAMPOS = Object.freeze({
  ataque: ['alvo', 'habilidade'],
  habilidade: ['habilidade', 'alvo', 'x', 'y'],
  esquiva: ['dx', 'dy'],
  pocao: ['pocao'],
  reviver: [],
  ficha: ['ficha'],
})

export function conferirAcaoDoMundo(intent) {
  // A whitelist confere exatamente o DTO que sairá na rede, inclusive se havia toJSON.
  intent = copia(intent, 4000)
  if (!objeto(intent) || !Object.hasOwn(CAMPOS, intent.tipo))
    throw new TypeError('mundo: ação inválida')
  if (Object.keys(intent).some((k) => k !== 'tipo' && !CAMPOS[intent.tipo].includes(k)))
    throw new TypeError('mundo: campo de ação inválido')
  if (
    intent.tipo === 'esquiva' &&
    ![intent.dx, intent.dy].every((v) => Number.isFinite(v) && Math.abs(v) <= 1)
  )
    throw new TypeError('mundo: direção inválida')
  if (
    intent.tipo === 'ataque' &&
    (typeof intent.alvo !== 'string' || !intent.alvo || intent.alvo.length > 120)
  )
    throw new TypeError('mundo: alvo inválido')
  if (
    (intent.tipo === 'habilidade' || Object.hasOwn(intent, 'habilidade')) &&
    !palavraValida(intent.habilidade)
  )
    throw new TypeError('mundo: habilidade inválida')
  if (intent.tipo === 'pocao' && !palavraValida(intent.pocao))
    throw new TypeError('mundo: poção inválida')
  for (const k of ['x', 'y'])
    if (Object.hasOwn(intent, k) && !Number.isFinite(intent[k]))
      throw new TypeError('mundo: posição inválida')
  const c = intent
  if (c.tipo === 'ficha') c.ficha = conferirFichaDoMundo(c.ficha)
  return c
}
