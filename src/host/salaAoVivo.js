// A SALA AO VIVO DOS HOSTS DE TESTE E DE DESENVOLVIMENTO.
//
// Um motor só para os dois, pelo mesmo motivo do `sala.js`: duas cópias da
// regra divergem na primeira correção. O host de verdade (o do RoqueOS) fala
// com o Realtime Database; este motor imita o que o jogo enxerga dele:
// árvore de caminhos, set/update/remove/push, onValue, onChildAdded/Changed/
// Removed com limitToLast, onDisconnect e a hora do servidor.
//
// ONDE A SALA MORA. Uma folha por chave no Storage (o localStorage no host de
// desenvolvimento, um em memória no falso):
//
//   roqueos:<jogo>:salaAoVivo:<CÓDIGO>/players/aba-X/x  →  "12.5"
//
// e não a sala num JSON só, porque duas abas publicando presença a 10 Hz
// fariam ler-modificar-gravar do mesmo JSON sem trava entre abas, e uma
// apagaria a outra. Com uma chave por folha, quem escreve em players/a nunca
// toca em players/b. Cada janela mantém em memória a árvore (o índice) das
// salas que abriu, e é dela que lê.
//
// COMO A OUTRA ABA FICA SABENDO. Toda escrita termina gravando a chave da sala
// sem barra (roqueos:<jogo>:salaAoVivo:<CÓDIGO>) com a lista das folhas que
// mudaram. O navegador entrega o evento `storage` às OUTRAS abas; elas releem
// só aquelas folhas e avisam quem observa UMA vez. Reagir a cada folha
// entregaria meio objeto: o anfitrião veria o golpe `{ m }` sem o `d`,
// aplicaria dano zero e apagaria o pedido antes do resto chegar. No banco de
// verdade uma escrita é atômica para quem ouve, e aqui também.
//
// Não emula regra do banco. Quem decide quem escreve onde é o
// database.rules.json do RoqueOS; no teste, a opção `recusar` faz esse papel.

import { erroSemConta, gerarCodigo } from './sala.js'

/** O marcador da hora do servidor, igual ao `serverTimestamp()` do Realtime Database. */
export const MARCADOR_DA_HORA = Object.freeze({ '.sv': 'timestamp' })

/** O banco não aceita caminho mais fundo que isso, nem chave maior que isso em bytes. */
export const PROFUNDIDADE_MAXIMA = 32
export const BYTES_POR_CHAVE = 768

const TENTATIVAS_DE_CODIGO = 20
const ACOES_AO_CAIR = Object.freeze(['apagar', 'cancelar'])

// ── Regras de caminho e de valor ────────────────────────────────────────────
//
// São as do Realtime Database (INVALID_KEY_REGEX_ do @firebase/database), com
// duas diferenças de propósito: segmento vazio ('a//b', 'players/') o banco
// engole calado e aqui é erro, porque quase sempre é um uid ou uma chave que
// chegou vazia; e o '..' ganha mensagem própria, porque quem escreve '..'
// está tentando sair da sala.

const PROIBIDOS = '.#$[]/'

function caractereProibido(segmento) {
  for (const c of segmento) {
    const n = c.codePointAt(0)
    if (n < 32 || n === 127 || PROIBIDOS.includes(c)) return c
  }
  return null
}

const bytes = (texto) => new TextEncoder().encode(texto).length

function conferirSegmento(segmento, caminho) {
  if (segmento === '') throw new TypeError(`caminho "${caminho}" tem segmento vazio`)
  if (segmento === '.' || segmento === '..') {
    throw new TypeError(
      `caminho "${caminho}" tem "${segmento}": o caminho é sempre de dentro da sala, não há pasta de cima`,
    )
  }
  const c = caractereProibido(segmento)
  if (c !== null) {
    throw new TypeError(
      `caminho "${caminho}" tem ${JSON.stringify(c)}, que o banco não aceita em chave (".", "#", "$", "[", "]", "/" e caractere de controle)`,
    )
  }
  if (bytes(segmento) > BYTES_POR_CHAVE) {
    throw new TypeError(`caminho "${caminho}" tem chave acima de ${BYTES_POR_CHAVE} bytes`)
  }
}

/**
 * O caminho em segmentos, ou TypeError. '' é a sala inteira.
 * @param {string} caminho
 * @returns {string[]}
 */
export function segmentosDoCaminho(caminho) {
  if (typeof caminho !== 'string') {
    throw new TypeError(`caminho precisa ser texto ('' é a sala inteira), veio ${typeof caminho}`)
  }
  if (caminho === '') return []
  const segmentos = caminho.split('/')
  for (const s of segmentos) conferirSegmento(s, caminho)
  if (segmentos.length > PROFUNDIDADE_MAXIMA) {
    throw new TypeError(`caminho "${caminho}" passa de ${PROFUNDIDADE_MAXIMA} níveis`)
  }
  return segmentos
}

const ehMarcadorDaHora = (v) =>
  v !== null &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  Object.keys(v).length === 1 &&
  v['.sv'] === 'timestamp'

function objetoSimples(v) {
  if (!v || typeof v !== 'object') return false
  const proto = Object.getPrototypeOf(v)
  return proto === Object.prototype || proto === null
}

function descrever(v) {
  if (v === null) return 'null'
  if (typeof v !== 'object') return typeof v
  return v.constructor?.name ? `um ${v.constructor.name}` : 'um objeto sem protótipo'
}

/**
 * Confere um valor antes de ele ir para a sala: o que o banco recusa vira
 * TypeError aqui, com o ponto exato. `onde` é o caminho, para a mensagem.
 */
export function conferirValor(valor, onde = 'valor', profundidade = 0) {
  if (valor === undefined) {
    throw new TypeError(`${onde} é undefined, que o banco recusa; para apagar, use null`)
  }
  if (valor === null || typeof valor === 'string' || typeof valor === 'boolean') return
  if (typeof valor === 'number') {
    if (!Number.isFinite(valor)) throw new TypeError(`${onde} é ${valor}, que o banco recusa`)
    return
  }
  if (typeof valor !== 'object') {
    throw new TypeError(
      `${onde} é ${typeof valor}; o banco guarda texto, número, booleano, objeto e array`,
    )
  }
  if ('.sv' in valor) {
    if (ehMarcadorDaHora(valor)) return
    throw new TypeError(
      `${onde} tem ".sv": o único marcador que o SDK conhece é o de horaDoServidor()`,
    )
  }
  if (!Array.isArray(valor) && !objetoSimples(valor)) {
    throw new TypeError(
      `${onde} é ${descrever(valor)}; o banco guarda objeto simples e array (uma data vai como número, Date.now())`,
    )
  }
  if (profundidade >= PROFUNDIDADE_MAXIMA) {
    throw new TypeError(`${onde} passa de ${PROFUNDIDADE_MAXIMA} níveis`)
  }
  for (const [chave, filho] of Object.entries(valor)) {
    if (!Array.isArray(valor)) conferirSegmento(chave, `${onde}.${chave}`)
    conferirValor(filho, `${onde}.${chave}`, profundidade + 1)
  }
}

/**
 * As chaves de um `atualizar`, cada uma um caminho, conferidas como o banco
 * confere: nenhuma pode ser ancestral de outra na mesma atualização.
 * @returns {Array<[string[], unknown]>}
 */
export function conferirAtualizacao(parcial, onde = 'atualizar') {
  if (!objetoSimples(parcial)) {
    throw new TypeError(
      `${onde} precisa de um objeto { caminho: valor }, veio ${descrever(parcial)}`,
    )
  }
  const entradas = Object.entries(parcial).map(([chave, valor]) => {
    const segmentos = segmentosDoCaminho(chave)
    if (segmentos.length === 0) throw new TypeError(`${onde} tem chave vazia`)
    conferirValor(valor, `${onde}["${chave}"]`, segmentos.length)
    return [segmentos, valor]
  })
  const caminhos = entradas.map(([s]) => s.join('/')).sort()
  for (let i = 1; i < caminhos.length; i++) {
    if (caminhos[i].startsWith(caminhos[i - 1] + '/')) {
      throw new TypeError(
        `${onde}: "${caminhos[i - 1]}" é ancestral de "${caminhos[i]}" na mesma atualização`,
      )
    }
  }
  return entradas
}

/** O código como o jogo o recebe de um campo digitado, ou null se não pode ser código. */
export function normalizarCodigoDaSala(codigo) {
  if (typeof codigo !== 'string') return null
  const c = codigo.trim().toUpperCase()
  return /^[A-Z0-9]{4,12}$/.test(c) ? c : null
}

// ── Ordem das chaves e chave de empurrar ────────────────────────────────────

const INTEIRO_32 = /^-?(0*)\d{1,10}$/
function comoInteiro(chave) {
  if (!INTEIRO_32.test(chave)) return null
  const n = Number(chave)
  return n >= -2147483648 && n <= 2147483647 ? n : null
}

/**
 * A ordem dos filhos no banco (o `nameCompare` do Realtime Database): chave
 * que é inteiro de 32 bits vem antes, por valor; o resto, por texto.
 */
export function compararChaves(a, b) {
  if (a === b) return 0
  const x = comoInteiro(a)
  const y = comoInteiro(b)
  if (x !== null) return y !== null ? x - y || a.length - b.length : -1
  if (y !== null) return 1
  return a < b ? -1 : 1
}

const CARACTERES_DA_CHAVE = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz'

/**
 * Chaves de `empurrar` como as do banco: 20 caracteres, os 8 primeiros são o
 * tempo, então a ordem das chaves é a ordem em que foram criadas, e duas no
 * mesmo milissegundo continuam em ordem porque a parte aleatória sobe de um.
 */
export function criarGeradorDeChaves({ agora = Date.now, aleatorio = Math.random } = {}) {
  let ultimoTempo = 0
  const ultimos = new Array(12).fill(0)
  return function proximaChave() {
    let tempo = agora()
    const mesmoTempo = tempo === ultimoTempo
    ultimoTempo = tempo
    const letras = new Array(8)
    for (let i = 7; i >= 0; i--) {
      letras[i] = CARACTERES_DA_CHAVE.charAt(tempo % 64)
      tempo = Math.floor(tempo / 64)
    }
    if (!mesmoTempo) {
      for (let i = 0; i < 12; i++) ultimos[i] = Math.floor(aleatorio() * 64)
    } else {
      let i = 11
      for (; i >= 0 && ultimos[i] === 63; i--) ultimos[i] = 0
      if (i >= 0) ultimos[i]++
    }
    return letras.join('') + ultimos.map((n) => CARACTERES_DA_CHAVE.charAt(n)).join('')
  }
}

// ── A árvore em memória ─────────────────────────────────────────────────────
//
// Nó interno é um Map (chave → nó); folha é o valor primitivo. Um Map vazio
// não existe: apagar poda os ancestrais que ficaram sem filho, como o banco.

const INDICE_DE_ARRAY = /^(0|[1-9]\d*)$/

function noEm(raiz, segmentos) {
  let no = raiz
  for (const s of segmentos) {
    if (!(no instanceof Map)) return undefined
    no = no.get(s)
    if (no === undefined) return undefined
  }
  return no
}

const folhaEm = (raiz, segmentos) => {
  const no = noEm(raiz, segmentos)
  return no instanceof Map ? undefined : no
}

const filhosEmOrdem = (no) => [...no.keys()].sort(compararChaves)

/**
 * O valor de um nó como o banco devolve: objeto vazio é null, e um objeto
 * cujas chaves são todas inteiras volta array quando mais da metade dos
 * índices até a maior está preenchida (a conta do `val()` do banco).
 */
export function valorDoNo(no) {
  if (no === undefined) return null
  if (!(no instanceof Map)) return no
  if (no.size === 0) return null
  const objeto = {}
  let maior = 0
  let todasInteiras = true
  for (const chave of filhosEmOrdem(no)) {
    objeto[chave] = valorDoNo(no.get(chave))
    if (todasInteiras && INDICE_DE_ARRAY.test(chave)) maior = Math.max(maior, Number(chave))
    else todasInteiras = false
  }
  if (todasInteiras && maior < 2 * no.size) {
    const array = []
    for (const chave of Object.keys(objeto)) array[chave] = objeto[chave]
    return array
  }
  return objeto
}

function folhasDoNo(no, prefixo, saida) {
  if (no === undefined) return saida
  if (!(no instanceof Map)) {
    saida.set(prefixo.join('/'), no)
    return saida
  }
  for (const [chave, filho] of no) folhasDoNo(filho, [...prefixo, chave], saida)
  return saida
}

function definirFolha(raiz, segmentos, valor) {
  let no = raiz
  for (let i = 0; i < segmentos.length - 1; i++) {
    let filho = no.get(segmentos[i])
    if (!(filho instanceof Map)) {
      filho = new Map()
      no.set(segmentos[i], filho)
    }
    no = filho
  }
  no.set(segmentos.at(-1), valor)
}

/** Tira o nó (folha ou subárvore) e poda os ancestrais que ficaram vazios. */
function removerNo(raiz, segmentos) {
  const trilha = [raiz]
  for (let i = 0; i < segmentos.length - 1; i++) {
    const filho = trilha[i].get(segmentos[i])
    if (!(filho instanceof Map)) return
    trilha.push(filho)
  }
  trilha.at(-1).delete(segmentos.at(-1))
  for (let i = trilha.length - 1; i > 0 && trilha[i].size === 0; i--) {
    trilha[i - 1].delete(segmentos[i - 1])
  }
}

/** Achata um valor já conferido nas folhas que ele vira, com a hora resolvida. */
function achatar(valor, prefixo, hora, saida) {
  if (valor === null) return saida
  if (typeof valor !== 'object') {
    saida.push([prefixo, valor])
    return saida
  }
  if (ehMarcadorDaHora(valor)) {
    saida.push([prefixo, hora])
    return saida
  }
  for (const [chave, filho] of Object.entries(valor))
    achatar(filho, [...prefixo, chave], hora, saida)
  return saida
}

/**
 * Grava `valor` em `segmentos`, substituindo o que havia ali, e anota em
 * `tocadas` o valor ORIGINAL de cada folha mexida (a primeira anotação vale).
 */
function gravarNaArvore(raiz, segmentos, valor, hora, tocadas) {
  const tocar = (caminho, original) => {
    if (!tocadas.has(caminho)) tocadas.set(caminho, original)
  }
  const atual = noEm(raiz, segmentos)
  if (atual !== undefined) {
    for (const [caminho, v] of folhasDoNo(atual, segmentos, new Map())) tocar(caminho, v)
    if (segmentos.length === 0) raiz.clear()
    else removerNo(raiz, segmentos)
  }
  const novas = achatar(valor, segmentos, hora, [])
  if (novas.length === 0) return
  // Uma folha no caminho de cima vira pasta: o valor dela sai.
  for (let i = 1; i < segmentos.length; i++) {
    const acima = noEm(raiz, segmentos.slice(0, i))
    if (acima === undefined) break
    if (!(acima instanceof Map)) {
      tocar(segmentos.slice(0, i).join('/'), acima)
      removerNo(raiz, segmentos.slice(0, i))
      break
    }
  }
  for (const [caminho, v] of novas) {
    tocar(caminho.join('/'), undefined)
    definirFolha(raiz, caminho, v)
  }
}

/** A foto de um valor para comparar "mudou ou não", sem depender da ordem de inserção. */
const foto = (valor) => JSON.stringify(valor)

// ── As salas no Storage ─────────────────────────────────────────────────────

function lerFolhaGuardada(bruto) {
  if (bruto === null || bruto === undefined) return undefined
  try {
    const v = JSON.parse(bruto)
    return v !== null && typeof v !== 'object' ? v : undefined
  } catch {
    return undefined
  }
}

/**
 * As salas de UM jogo sobre um Storage. Cada sala aberta nesta janela tem a
 * árvore em memória; o Storage é onde ela mora e o que as abas dividem.
 */
function salasNoStorage({ storage, base }) {
  const salas = new Map()
  let commits = 0

  const prefixoDasFolhas = (codigo) => `${base}${codigo}/`

  function lerDoStorage(codigo) {
    const prefixo = prefixoDasFolhas(codigo)
    const chaves = []
    let total = 0
    try {
      total = storage.length ?? 0
    } catch {
      total = 0
    }
    for (let i = 0; i < total; i++) {
      let chave = null
      try {
        chave = storage.key(i)
      } catch {
        chave = null
      }
      if (typeof chave === 'string' && chave.startsWith(prefixo)) chaves.push(chave)
    }
    // Mais raso primeiro: se uma folha e um filho dela convivem (duas abas
    // escreveram ao mesmo tempo em caminhos que se cruzam), o mais fundo vence.
    chaves.sort((a, b) => a.length - b.length)
    const raiz = new Map()
    for (const chave of chaves) {
      let valor
      try {
        valor = lerFolhaGuardada(storage.getItem(chave))
      } catch {
        valor = undefined
      }
      if (valor === undefined) continue
      let segmentos
      try {
        segmentos = segmentosDoCaminho(chave.slice(prefixo.length))
      } catch {
        continue
      }
      if (segmentos.length) definirFolha(raiz, segmentos, valor)
    }
    return raiz
  }

  /** Relê a sala inteira do Storage e devolve as folhas que mudaram. */
  function recarregar(codigo) {
    const sala = salas.get(codigo)
    const nova = lerDoStorage(codigo)
    if (!sala) {
      salas.set(codigo, { codigo, raiz: nova, ouvintes: new Set() })
      return []
    }
    const antes = folhasDoNo(sala.raiz, [], new Map())
    const depois = folhasDoNo(nova, [], new Map())
    sala.raiz = nova
    const mudadas = []
    for (const [c, v] of antes) if (depois.get(c) !== v) mudadas.push(c)
    for (const c of depois.keys()) if (!antes.has(c)) mudadas.push(c)
    return mudadas
  }

  /** A sala desta janela, lida do Storage na primeira vez. */
  function abrir(codigo) {
    if (!salas.has(codigo)) recarregar(codigo)
    return salas.get(codigo)
  }

  /**
   * Aplica gravações na árvore e no Storage de uma vez: `gravacoes` é uma
   * lista de [segmentos, valor]. Grava cada folha mudada e, por último, a
   * chave da sala com a lista delas, que é o que a outra aba escuta. Se o
   * Storage recusar no meio (cota), desfaz o que gravou e relê a sala: ou vai
   * tudo, ou nada. Devolve as folhas que mudaram.
   */
  function transacao(codigo, gravacoes, hora) {
    const sala = abrir(codigo)
    const tocadas = new Map()
    for (const [segmentos, valor] of gravacoes) {
      gravarNaArvore(sala.raiz, segmentos, valor, hora, tocadas)
    }
    const mudancas = []
    for (const [caminho, original] of tocadas) {
      const agora = folhaEm(sala.raiz, caminho.split('/'))
      if (agora !== original) mudancas.push([caminho, agora])
    }
    if (mudancas.length === 0) return []
    const prefixo = prefixoDasFolhas(codigo)
    const feitas = []
    try {
      for (const [caminho, valor] of mudancas) {
        const chave = prefixo + caminho
        feitas.push([chave, storage.getItem(chave)])
        if (valor === undefined) storage.removeItem(chave)
        else storage.setItem(chave, JSON.stringify(valor))
      }
      const chaveDaSala = base + codigo
      feitas.push([chaveDaSala, storage.getItem(chaveDaSala)])
      if (sala.raiz.size === 0) storage.removeItem(chaveDaSala)
      else {
        // A marca só existe para o valor mudar sempre: o navegador não manda
        // evento `storage` quando o valor gravado é igual ao anterior.
        commits += 1
        const marca = `${commits}-${Math.floor(Math.random() * 1e9)}`
        const valor = JSON.stringify({ marca, folhas: mudancas.map(([caminho]) => caminho) })
        storage.setItem(chaveDaSala, valor)
      }
    } catch (erro) {
      for (const [chave, anterior] of feitas.reverse()) {
        try {
          if (anterior === null) storage.removeItem(chave)
          else storage.setItem(chave, anterior)
        } catch {
          // o Storage recusou até desfazer; a releitura abaixo mostra o que ficou
        }
      }
      recarregar(codigo)
      throw erro
    }
    return mudancas.map(([caminho]) => caminho)
  }

  /**
   * Outra aba gravou: relê só as folhas que ela disse que mudaram. Primeiro o
   * que sumiu, depois o que chegou, porque uma folha que virou pasta aparece
   * nas duas listas e a ordem inversa apagaria a pasta nova.
   */
  function aplicarDeFora(codigo, folhas) {
    const sala = salas.get(codigo)
    if (!sala) return []
    const prefixo = prefixoDasFolhas(codigo)
    const lidas = []
    for (const caminho of folhas) {
      let segmentos
      try {
        segmentos = segmentosDoCaminho(caminho)
      } catch {
        continue
      }
      if (segmentos.length === 0) continue
      let valor
      try {
        valor = lerFolhaGuardada(storage.getItem(prefixo + caminho))
      } catch {
        valor = undefined
      }
      lidas.push([caminho, segmentos, valor])
    }
    const mudadas = []
    for (const [caminho, segmentos, valor] of lidas) {
      if (valor !== undefined) continue
      if (folhaEm(sala.raiz, segmentos) !== undefined) {
        removerNo(sala.raiz, segmentos)
        mudadas.push(caminho)
      }
    }
    for (const [, segmentos, valor] of lidas) {
      if (valor === undefined || folhaEm(sala.raiz, segmentos) === valor) continue
      const tocadas = new Map()
      gravarNaArvore(sala.raiz, segmentos, valor, null, tocadas)
      mudadas.push(...tocadas.keys())
    }
    return mudadas
  }

  return { salas, abrir, recarregar, transacao, aplicarDeFora }
}

// ── Quem observa ────────────────────────────────────────────────────────────

/**
 * Chama o jogo sem deixar o erro dele desfazer a escrita que o avisou. O
 * banco faz igual (exceptionGuard): relança fora, onde o console e o teste
 * enxergam.
 */
function entregar(fn, ...args) {
  try {
    fn(...args)
  } catch (erro) {
    setTimeout(() => {
      throw erro
    }, 0)
  }
}

/** O observador do valor de um caminho. Só entrega quando o valor muda de verdade. */
function ouvinteDeValor(sala, segmentos, fn) {
  const o = {
    ativo: true,
    pronto: false,
    caminho: segmentos.join('/'),
    ultima: undefined,
    atualizar() {
      const valor = valorDoNo(noEm(sala.raiz, segmentos))
      const f = foto(valor)
      if (o.pronto && f === o.ultima) return
      o.pronto = true
      o.ultima = f
      entregar(fn, valor)
    },
  }
  return o
}

/**
 * O observador dos filhos de um caminho, na ordem das chaves. Guarda a foto
 * de cada filho da janela (os `ultimos`, se pedido) e entrega a diferença:
 * primeiro quem saiu, depois quem chegou, depois quem mudou, como o banco.
 */
function ouvinteDeFilhos(sala, segmentos, { adicionado, mudado, removido }, ultimos) {
  const o = {
    ativo: true,
    pronto: false,
    caminho: segmentos.join('/'),
    fotos: new Map(),
    atualizar() {
      const no = noEm(sala.raiz, segmentos)
      let chaves = no instanceof Map ? filhosEmOrdem(no) : []
      if (ultimos) chaves = chaves.slice(-ultimos)
      const valores = new Map()
      const fotos = new Map()
      for (const chave of chaves) {
        const valor = valorDoNo(no.get(chave))
        valores.set(chave, valor)
        fotos.set(chave, foto(valor))
      }
      const antes = o.fotos
      o.fotos = fotos
      o.pronto = true
      const saiu = [...antes.keys()].filter((c) => !fotos.has(c)).sort(compararChaves)
      const chegou = chaves.filter((c) => !antes.has(c))
      const mudou = chaves.filter((c) => antes.has(c) && antes.get(c) !== fotos.get(c))
      for (const c of saiu) if (o.ativo && removido) entregar(removido, c, JSON.parse(antes.get(c)))
      for (const c of chegou) if (o.ativo && adicionado) entregar(adicionado, c, valores.get(c))
      for (const c of mudou) if (o.ativo && mudado) entregar(mudado, c, valores.get(c))
    },
  }
  return o
}

/**
 * Avisa quem observa um caminho que cruza alguma folha mudada: o próprio
 * caminho, um de cima (a pasta mudou) ou um de baixo (a folha que o cobria
 * mudou). Quem ainda não recebeu a primeira entrega espera por ela.
 */
function notificar(sala, mudadas) {
  if (!sala || mudadas.length === 0) return
  const cruzados = new Set([''])
  for (const caminho of mudadas) {
    let acumulado = ''
    for (const s of caminho.split('/')) {
      acumulado = acumulado ? `${acumulado}/${s}` : s
      cruzados.add(acumulado)
    }
  }
  for (const o of [...sala.ouvintes]) {
    if (!o.ativo || !o.pronto) continue
    const cruza = cruzados.has(o.caminho) || mudadas.some((c) => o.caminho.startsWith(`${c}/`))
    if (cruza) o.atualizar()
  }
}

function registrarOuvinte(sala, o) {
  sala.ouvintes.add(o)
  // No banco a primeira entrega chega depois; o jogo que conta com ela dentro
  // da própria chamada passaria aqui e quebraria no RoqueOS.
  queueMicrotask(() => {
    if (o.ativo) o.atualizar()
  })
  return () => {
    o.ativo = false
    sala.ouvintes.delete(o)
  }
}

// ── A capacidade ────────────────────────────────────────────────────────────

function erroDaSala(codigo, mensagem) {
  const erro = new Error(mensagem)
  erro.codigo = codigo
  return erro
}

function conferirFuncoesDosFilhos(fns) {
  const nomes = ['adicionado', 'mudado', 'removido']
  if (!fns || typeof fns !== 'object') {
    throw new TypeError('observarFilhos precisa de { adicionado, mudado, removido }')
  }
  for (const nome of nomes) {
    if (fns[nome] !== undefined && typeof fns[nome] !== 'function') {
      throw new TypeError(`observarFilhos: ${nome} precisa ser função`)
    }
  }
  if (!nomes.some((n) => typeof fns[n] === 'function')) {
    throw new TypeError('observarFilhos sem adicionado, mudado nem removido não observa nada')
  }
}

/**
 * A capacidade `salaAoVivo` sobre um Storage, e o que os hosts de teste
 * precisam por fora dela.
 *
 * @param {{
 *   storage: Storage,
 *   jogoId: string,
 *   jogador: () => { uid: string | null, nome: string | null },
 *   link: (codigo: string) => string,
 *   convite: () => string | null,
 *   registro?: { warn?: Function },
 *   agora?: () => number,
 *   aleatorio?: () => number,
 *   recusar?: ((pedido: { operacao: string, codigo: string, caminho: string, uid: string | null, valor: unknown }) => boolean) | null,
 *   conectado?: boolean,
 *   aoCriar?: (codigo: string) => void,
 * }} opcoes
 */
export function criarSalaAoVivo({
  storage,
  jogoId,
  jogador,
  link,
  convite,
  registro = console,
  agora = Date.now,
  aleatorio = Math.random,
  recusar = null,
  conectado = true,
  aoCriar,
}) {
  const base = `roqueos:${jogoId}:salaAoVivo:`
  const guardadas = salasNoStorage({ storage, base })
  const proximaChave = criarGeradorDeChaves({ agora, aleatorio })
  /** As salas que ESTA janela criou ou em que entrou: fora delas, nada se escreve. */
  const naJanela = new Set()
  /** O que esta janela armou para apagar quando cair: código → caminhos. */
  const armadas = new Map()
  /** O que os outros jogadores do host falso armaram: uid → código → caminhos. */
  const armadasDeFora = new Map()
  const conexao = { valor: Boolean(conectado), ouvintes: new Set() }

  const avisar = (mensagem) => registro?.warn?.(`[${jogoId}] salaAoVivo: ${mensagem}`)
  const naSala = (codigo) => {
    const c = normalizarCodigoDaSala(codigo)
    return c && naJanela.has(c) ? c : null
  }
  const foraDaSala = (metodo, codigo) =>
    avisar(`${metodo} em ${JSON.stringify(codigo)}, sala que esta janela não criou nem entrou`)

  const existe = (codigo) => {
    notificar(guardadas.salas.get(codigo), guardadas.recarregar(codigo))
    return noEm(guardadas.salas.get(codigo).raiz, ['meta']) !== undefined
  }

  /** Grava e avisa quem observa. O erro do Storage vira false, nunca exceção. */
  function escrever(codigo, gravacoes) {
    let mudadas
    try {
      mudadas = guardadas.transacao(codigo, gravacoes, agora())
    } catch (erro) {
      avisar(`o armazenamento recusou a escrita em ${codigo} (${erro?.message ?? erro})`)
      return false
    }
    notificar(guardadas.salas.get(codigo), mudadas)
    return true
  }

  /** O caminho de toda escrita que o JOGO pede: está na sala? a regra deixa? */
  function escritaDoJogo(operacao, codigo, caminho, valor, gravacoes) {
    const c = naSala(codigo)
    if (!c) {
      foraDaSala(operacao, codigo)
      return false
    }
    if (recusar?.({ operacao, codigo: c, caminho, uid: jogador().uid ?? null, valor })) {
      return false
    }
    return escrever(c, gravacoes)
  }

  const paraApagar = (caminhos) => [...caminhos].map((c) => [c ? c.split('/') : [], null])

  function cair() {
    for (const [codigo, caminhos] of armadas) {
      if (caminhos.size) escrever(codigo, paraApagar(caminhos))
    }
    armadas.clear()
  }

  function armar(mapa, codigo, caminho, acao) {
    const caminhos = mapa.get(codigo) ?? new Set()
    mapa.set(codigo, caminhos)
    if (acao === 'apagar') caminhos.add(caminho)
    else {
      for (const armado of [...caminhos]) {
        if (caminho === '' || armado === caminho || armado.startsWith(`${caminho}/`)) {
          caminhos.delete(armado)
        }
      }
    }
  }

  const capacidade = {
    criar(opcoes = {}) {
      const meta = opcoes?.meta ?? {}
      if (!objetoSimples(meta)) throw new TypeError('criar({ meta }): meta é um objeto simples')
      conferirValor(meta, 'criar: meta', 1)
      return (async () => {
        const { uid, nome } = jogador()
        if (!uid) throw erroSemConta()
        let codigo = gerarCodigo(aleatorio)
        // Gravar por cima de uma sala viva apagaria a partida de outra pessoa:
        // tenta de novo e, sem código livre, desiste alto.
        for (let tentativa = 1; existe(codigo); tentativa++) {
          if (tentativa >= TENTATIVAS_DE_CODIGO) {
            throw new Error('não achei um código livre para a sala ao vivo')
          }
          codigo = gerarCodigo(aleatorio)
        }
        // O host escreve host, hostName e createdAt POR ÚLTIMO: o jogo não cria
        // sala em nome de outro.
        const final = {
          ...meta,
          host: uid,
          hostName: String(nome || 'Host').slice(0, 24),
          createdAt: MARCADOR_DA_HORA,
        }
        let mudadas
        try {
          mudadas = guardadas.transacao(codigo, [[['meta'], final]], agora())
        } catch (erro) {
          throw new Error('não consegui gravar a sala ao vivo', { cause: erro })
        }
        naJanela.add(codigo)
        notificar(guardadas.salas.get(codigo), mudadas)
        aoCriar?.(codigo)
        return { codigo, link: link(codigo), eu: { uid, nome: nome ?? null } }
      })()
    },

    async entrar(codigo) {
      const { uid, nome } = jogador()
      if (!uid) return { erro: 'sem-conta' }
      const c = normalizarCodigoDaSala(codigo)
      if (!c || !existe(c)) return { erro: 'nao-encontrada' }
      naJanela.add(c)
      const meta = valorDoNo(noEm(guardadas.salas.get(c).raiz, ['meta']))
      return { ok: true, meta, eu: { uid, nome: nome ?? null } }
    },

    sair(codigo) {
      const c = normalizarCodigoDaSala(codigo)
      if (!c) return
      naJanela.delete(c)
      const sala = guardadas.salas.get(c)
      if (!sala) return
      for (const o of sala.ouvintes) o.ativo = false
      sala.ouvintes.clear()
    },

    conviteRecebido: () => normalizarCodigoDaSala(convite()),

    conectado(fn) {
      if (typeof fn !== 'function') throw new TypeError('conectado(fn) precisa da função')
      const o = { ativo: true, pronto: false, fn }
      conexao.ouvintes.add(o)
      queueMicrotask(() => {
        if (!o.ativo) return
        o.pronto = true
        entregar(fn, conexao.valor)
      })
      return () => {
        o.ativo = false
        conexao.ouvintes.delete(o)
      }
    },

    horaDoServidor: () => ({ '.sv': 'timestamp' }),

    ler(codigo, caminho) {
      const segmentos = segmentosDoCaminho(caminho)
      const c = naSala(codigo)
      if (!c) {
        return Promise.reject(
          erroDaSala('fora-da-sala', `ler em ${codigo}: esta janela não criou nem entrou na sala`),
        )
      }
      if (recusar?.({ operacao: 'ler', codigo: c, caminho, uid: jogador().uid ?? null })) {
        return Promise.reject(erroDaSala('indisponivel', `ler "${caminho}" em ${c}: recusado`))
      }
      return Promise.resolve(valorDoNo(noEm(guardadas.abrir(c).raiz, segmentos)))
    },

    gravar(codigo, caminho, valor) {
      const segmentos = segmentosDoCaminho(caminho)
      conferirValor(valor, `gravar "${caminho}"`, segmentos.length)
      if (segmentos.length === 0 && valor !== null && !objetoSimples(valor)) {
        throw new TypeError('gravar em "" é gravar a sala inteira, que é um objeto')
      }
      return Promise.resolve(escritaDoJogo('gravar', codigo, caminho, valor, [[segmentos, valor]]))
    },

    atualizar(codigo, caminho, parcial) {
      const segmentos = segmentosDoCaminho(caminho)
      const entradas = conferirAtualizacao(parcial, `atualizar "${caminho}"`)
      const gravacoes = entradas.map(([s, v]) => [[...segmentos, ...s], v])
      for (const [s] of gravacoes) {
        if (s.length > PROFUNDIDADE_MAXIMA) {
          throw new TypeError(`atualizar "${caminho}" passa de ${PROFUNDIDADE_MAXIMA} níveis`)
        }
      }
      return Promise.resolve(escritaDoJogo('atualizar', codigo, caminho, parcial, gravacoes))
    },

    apagar(codigo, caminho) {
      const segmentos = segmentosDoCaminho(caminho)
      return Promise.resolve(escritaDoJogo('apagar', codigo, caminho, null, [[segmentos, null]]))
    },

    empurrar(codigo, caminho, valor) {
      const segmentos = segmentosDoCaminho(caminho)
      conferirValor(valor, `empurrar "${caminho}"`, segmentos.length + 1)
      const chave = proximaChave()
      const filho = [...segmentos, chave]
      const ok = escritaDoJogo('empurrar', codigo, filho.join('/'), valor, [[filho, valor]])
      return Promise.resolve(ok ? chave : null)
    },

    observar(codigo, caminho, fn) {
      const segmentos = segmentosDoCaminho(caminho)
      if (typeof fn !== 'function')
        throw new TypeError('observar(codigo, caminho, fn) precisa da função')
      const c = naSala(codigo)
      if (!c) {
        foraDaSala('observar', codigo)
        return () => {}
      }
      const sala = guardadas.abrir(c)
      return registrarOuvinte(sala, ouvinteDeValor(sala, segmentos, fn))
    },

    observarFilhos(codigo, caminho, fns, opcoes = {}) {
      const segmentos = segmentosDoCaminho(caminho)
      conferirFuncoesDosFilhos(fns)
      const ultimos = opcoes?.ultimos
      if (ultimos !== undefined && !(Number.isInteger(ultimos) && ultimos > 0)) {
        throw new TypeError('observarFilhos: ultimos é um inteiro maior que zero')
      }
      const c = naSala(codigo)
      if (!c) {
        foraDaSala('observarFilhos', codigo)
        return () => {}
      }
      const sala = guardadas.abrir(c)
      return registrarOuvinte(sala, ouvinteDeFilhos(sala, segmentos, fns, ultimos))
    },

    aoCair(codigo, caminho, acao) {
      const segmentos = segmentosDoCaminho(caminho)
      if (!ACOES_AO_CAIR.includes(acao)) {
        throw new TypeError(
          `aoCair: acao é ${ACOES_AO_CAIR.join(' ou ')}, veio ${JSON.stringify(acao)}`,
        )
      }
      const c = naSala(codigo)
      if (!c) {
        foraDaSala('aoCair', codigo)
        return Promise.resolve(false)
      }
      if (
        recusar?.({
          operacao: 'aoCair',
          codigo: c,
          caminho,
          uid: jogador().uid ?? null,
          valor: acao,
        })
      ) {
        return Promise.resolve(false)
      }
      armar(armadas, c, segmentos.join('/'), acao)
      return Promise.resolve(true)
    },
  }

  /**
   * A conexão desta janela com o banco. Quando cai e `executar` pede, roda o
   * que foi armado com aoCair e esquece: o servidor faz igual, e quem volta
   * precisa rearmar (é por isso que o RoqueCraft rearma na reentrada).
   */
  function definirConexao(valor, { executar = false } = {}) {
    const novo = Boolean(valor)
    if (novo === conexao.valor) return
    if (!novo && executar) cair()
    conexao.valor = novo
    for (const o of [...conexao.ouvintes]) if (o.ativo && o.pronto) entregar(o.fn, novo)
  }

  /**
   * O outro jogador do host falso. Não passa pelo jogo, então não vai para
   * `chamadas`, não precisa ter entrado na sala e não passa por `recusar`:
   * quem faz o papel dele é o próprio teste.
   */
  function deFora({ acao, codigo, uid = 'outro', nome = null, caminho = '', valor, meta } = {}) {
    const exigirCodigo = () => {
      const c = normalizarCodigoDaSala(codigo)
      if (!c)
        throw new Error(`disparar('salaAoVivo', { acao: '${acao}' }) precisa do código da sala`)
      return c
    }
    const escreverDeFora = (c, gravacoes) => {
      notificar(guardadas.abrir(c), guardadas.transacao(c, gravacoes, agora()))
    }
    switch (acao) {
      case 'criar': {
        const c = exigirCodigo()
        if (existe(c)) throw new Error(`disparar('salaAoVivo'): a sala ${c} já existe`)
        const m = meta ?? {}
        conferirValor(m, 'meta', 1)
        const hostName = String(nome || 'Host').slice(0, 24)
        escreverDeFora(c, [[['meta'], { ...m, host: uid, hostName, createdAt: MARCADOR_DA_HORA }]])
        return c
      }
      case 'gravar': {
        const segmentos = segmentosDoCaminho(caminho)
        conferirValor(valor, `gravar "${caminho}"`, segmentos.length)
        return void escreverDeFora(exigirCodigo(), [[segmentos, valor]])
      }
      case 'atualizar': {
        const segmentos = segmentosDoCaminho(caminho)
        const entradas = conferirAtualizacao(valor, `atualizar "${caminho}"`)
        return void escreverDeFora(
          exigirCodigo(),
          entradas.map(([s, v]) => [[...segmentos, ...s], v]),
        )
      }
      case 'apagar':
        return void escreverDeFora(exigirCodigo(), [[segmentosDoCaminho(caminho), null]])
      case 'empurrar': {
        const segmentos = segmentosDoCaminho(caminho)
        conferirValor(valor, `empurrar "${caminho}"`, segmentos.length + 1)
        const chave = proximaChave()
        escreverDeFora(exigirCodigo(), [[[...segmentos, chave], valor]])
        return chave
      }
      case 'aoCair': {
        const c = exigirCodigo()
        const doOutro = armadasDeFora.get(uid) ?? new Map()
        armadasDeFora.set(uid, doOutro)
        return void armar(doOutro, c, segmentosDoCaminho(caminho).join('/'), 'apagar')
      }
      case 'cair': {
        for (const [c, caminhos] of armadasDeFora.get(uid) ?? []) {
          if (caminhos.size) escreverDeFora(c, paraApagar(caminhos))
        }
        return void armadasDeFora.delete(uid)
      }
      case 'sumir':
        return void escreverDeFora(exigirCodigo(), [[[], null]])
      default:
        throw new Error(`disparar('salaAoVivo') não conhece a ação "${acao}"`)
    }
  }

  /**
   * O evento `storage` que o navegador entrega às OUTRAS abas. Só a chave da
   * sala (sem barra) importa: ela traz a lista das folhas daquela escrita. As
   * folhas uma a uma são ignoradas, de propósito (veja o cabeçalho). Chave
   * nula é o `localStorage.clear()` de outra aba: toda sala aberta é relida.
   */
  function receberEventoDoStorage(evento) {
    const chave = evento?.key
    if (chave === null || chave === undefined) {
      for (const codigo of [...guardadas.salas.keys()]) {
        notificar(guardadas.salas.get(codigo), guardadas.recarregar(codigo))
      }
      return
    }
    if (typeof chave !== 'string' || !chave.startsWith(base)) return
    const codigo = chave.slice(base.length)
    if (codigo.includes('/') || !guardadas.salas.has(codigo)) return
    let folhas = null
    try {
      const dado = JSON.parse(evento.newValue ?? 'null')
      if (dado && Array.isArray(dado.folhas)) folhas = dado.folhas
    } catch {
      folhas = null
    }
    const sala = guardadas.salas.get(codigo)
    notificar(sala, folhas ? guardadas.aplicarDeFora(codigo, folhas) : guardadas.recarregar(codigo))
  }

  return {
    capacidade,
    cair,
    definirConexao,
    deFora,
    receberEventoDoStorage,
    /** A sala inteira, para o teste olhar sem passar pelo jogo. */
    arvore(codigo) {
      const c = normalizarCodigoDaSala(codigo)
      return c ? valorDoNo(guardadas.abrir(c).raiz) : null
    },
  }
}
