// A SALA DOS HOSTS DE TESTE E DE DESENVOLVIMENTO.
//
// As regras de quem senta em qual cadeira são as do RoqueOS (o
// `useRealtimeMatch` do front, que o host de verdade continua usando por
// baixo): o anfitrião não entra como convidado da própria sala, um estranho
// não entra em sala que já tem convidado ou que já acabou, e quem já é o
// convidado volta sem mexer em nada. Ficam num lugar só porque o host falso e
// o de desenvolvimento precisam concordar com o de verdade; duas cópias da
// regra divergem na primeira correção.
//
// O que muda de um host para o outro é só onde a sala mora (`salas`): em
// memória no falso, no localStorage no de desenvolvimento. Os dois guardam a
// sala já com os nomes do SDK; o mapeamento para os campos do banco é do host
// do RoqueOS.

import { SITUACOES_DA_SALA } from '../contrato.js'

// Sem O/0 e I/1: o código é lido em voz alta e digitado de um QR na tela.
// É o mesmo alfabeto do RoqueOS, para o código do teste ter a cara do real.
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const TAMANHO_DO_CODIGO = 5

export function gerarCodigo(aleatorio = Math.random) {
  let codigo = ''
  for (let i = 0; i < TAMANHO_DO_CODIGO; i++) {
    codigo += ALFABETO[Math.floor(aleatorio() * ALFABETO.length)]
  }
  return codigo
}

/** O código como o jogo o recebe de um campo digitado: com espaço e minúscula. */
export function normalizarCodigo(codigo) {
  if (typeof codigo !== 'string') return null
  const c = codigo.trim().toUpperCase()
  return c || null
}

/**
 * O estado atravessa a sala como JSON, que é o que o banco de verdade guarda.
 * Copiar aqui pega cedo o jogo que manda função ou `undefined` no estado, e
 * impede que ele mexa na sala guardada mexendo no objeto que mandou.
 */
const copia = (v) => (v === undefined ? null : JSON.parse(JSON.stringify(v)))

export function erroSemConta() {
  const erro = new Error('partida online pede conta')
  erro.codigo = 'sem-conta'
  return erro
}

function erroDaSala(codigo, mensagem) {
  const erro = new Error(mensagem)
  erro.codigo = codigo
  return erro
}

export function novaSala({ uid, nome, estadoInicial, vez }) {
  return {
    anfitriao: uid,
    nomeDoAnfitriao: nome ?? null,
    convidado: null,
    nomeDoConvidado: null,
    situacao: 'esperando',
    // O RoqueOS começa com a vez do anfitrião quando o jogo não diz.
    vez: vez ?? 'anfitriao',
    estado: copia(estadoInicial),
    vencedor: null,
    anfitriaoSaiu: false,
  }
}

/**
 * Quem tenta sentar na cadeira do convidado. Devolve o resultado que o jogo
 * recebe e, quando alguém de fato sentou, a sala nova para gravar. A ordem
 * das perguntas é a do RoqueOS, e importa: quem já é o convidado volta mesmo
 * com a partida em andamento, antes da pergunta "a sala está cheia?".
 */
export function entrarNaSala(sala, { uid, nome }) {
  if (!uid) return { resultado: { erro: 'sem-conta' } }
  if (!sala) return { resultado: { erro: 'nao-encontrada' } }
  if (sala.convidado && sala.convidado === uid) return { resultado: { ok: true, reentrada: true } }
  if (sala.anfitriao === uid) return { resultado: { erro: 'propria' } }
  if (sala.situacao !== 'esperando' || sala.convidado) return { resultado: { erro: 'cheia' } }
  return {
    resultado: { ok: true },
    sala: { ...sala, convidado: uid, nomeDoConvidado: nome ?? null, situacao: 'jogando' },
  }
}

/**
 * Uma jogada. `estado` e `vez` sempre; `vencedor` e `situacao` só quando
 * vierem, como no RoqueOS. Recusa o que o banco de verdade recusaria (valor
 * `undefined` derruba a escrita no Firebase) e a situação fora do vocabulário
 * do SDK, que é o erro de quem porta o jogo e manda 'ended' em vez de
 * 'encerrada'.
 */
export function jogadaNaSala(sala, { estado, vez, vencedor, situacao } = {}) {
  if (!sala) throw erroDaSala('nao-encontrada', 'jogada numa sala que não existe')
  if (estado === undefined || vez === undefined) {
    throw new TypeError('jogar precisa de { estado, vez }')
  }
  if (situacao !== undefined && !SITUACOES_DA_SALA.includes(situacao)) {
    throw new TypeError(
      `situacao ${JSON.stringify(situacao)} não existe; use ${SITUACOES_DA_SALA.join(', ')}`,
    )
  }
  const nova = { ...sala, estado: copia(estado), vez: copia(vez) }
  if (vencedor !== undefined) nova.vencedor = copia(vencedor)
  if (situacao !== undefined) nova.situacao = situacao
  return nova
}

export function salaEncerrada(sala, vencedor = null) {
  return { ...sala, situacao: 'encerrada', vencedor: copia(vencedor) }
}

/**
 * Quem observa cada sala. A primeira entrega sai numa microtarefa, nunca
 * dentro do próprio `observar`: no banco de verdade ela chega depois, e o
 * jogo que conta com a entrega síncrona passaria no teste e quebraria no
 * RoqueOS. Parar é tirar o ouvinte do conjunto, e é o mesmo conjunto que
 * decide se a primeira entrega ainda sai: um mecanismo só, que o teste de
 * mutação consegue derrubar.
 * @param {(codigo: string) => object | null} ler
 */
export function criarOuvintes(ler) {
  const porCodigo = new Map()
  return {
    ouvir(codigo, fn) {
      const conjunto = porCodigo.get(codigo) ?? new Set()
      porCodigo.set(codigo, conjunto)
      conjunto.add(fn)
      queueMicrotask(() => {
        if (conjunto.has(fn)) fn(ler(codigo))
      })
      return () => {
        conjunto.delete(fn)
        if (conjunto.size === 0 && porCodigo.get(codigo) === conjunto) porCodigo.delete(codigo)
      }
    },
    /** Cada ouvinte recebe a sua cópia; quem parou no meio da entrega não recebe. */
    avisar(codigo) {
      const conjunto = porCodigo.get(codigo)
      if (!conjunto) return
      for (const fn of [...conjunto]) if (conjunto.has(fn)) fn(ler(codigo))
    },
    /** Os códigos com alguém observando agora. */
    codigos: () => [...porCodigo.keys()],
  }
}

/** Onde as salas moram no host falso: um Map, e a mudança avisa na hora. */
export function salasEmMemoria() {
  const dados = new Map()
  const ler = (codigo) => (dados.has(codigo) ? copia(dados.get(codigo)) : null)
  const ouvintes = criarOuvintes(ler)
  return {
    ler,
    gravar(codigo, sala) {
      if (sala === null) dados.delete(codigo)
      else dados.set(codigo, copia(sala))
      ouvintes.avisar(codigo)
    },
    ouvir: ouvintes.ouvir,
    observadas: ouvintes.codigos,
  }
}

/**
 * A capacidade `sala` sobre qualquer lugar onde as salas morem.
 *
 * @param {{
 *   salas: { ler: Function, gravar: Function, ouvir: Function },
 *   jogador: () => { uid: string | null, nome: string | null },
 *   link: (codigo: string) => string,
 *   convite: () => string | null,
 *   aleatorio?: () => number,
 *   aoCriar?: (codigo: string) => void,
 * }} opcoes
 */
export function capacidadeSala({
  salas,
  jogador,
  link,
  convite,
  aleatorio = Math.random,
  aoCriar,
}) {
  return {
    async criar({ estadoInicial = null, vez } = {}) {
      const { uid, nome } = jogador()
      if (!uid) throw erroSemConta()
      let codigo = gerarCodigo(aleatorio)
      // Colisão com sala viva é improvável, mas gravar por cima apagaria a
      // partida de outra pessoa; então tenta de novo, e desiste alto.
      for (let tentativa = 1; salas.ler(codigo); tentativa++) {
        if (tentativa > 20) throw new Error('não achei um código livre para a sala')
        codigo = gerarCodigo(aleatorio)
      }
      salas.gravar(codigo, novaSala({ uid, nome, estadoInicial, vez }))
      aoCriar?.(codigo)
      return { codigo, link: link(codigo) }
    },
    async entrar(codigo) {
      const c = normalizarCodigo(codigo)
      const { resultado, sala } = entrarNaSala(c ? salas.ler(c) : null, jogador())
      if (sala) salas.gravar(c, sala)
      return resultado
    },
    observar(codigo, fn) {
      if (typeof fn !== 'function') throw new TypeError('observar(codigo, fn) precisa da função')
      // Código vazio não tem sala: a entrega é null, como a de sala que sumiu.
      return salas.ouvir(normalizarCodigo(codigo) ?? '', fn)
    },
    async jogar(codigo, jogada) {
      const c = normalizarCodigo(codigo)
      salas.gravar(c, jogadaNaSala(c ? salas.ler(c) : null, jogada))
    },
    // Melhor esforço: é chamado na saída, no desmontar, com a rede caindo, e
    // um erro ali não tem mais quem mostre. Nunca lança.
    async encerrar(codigo, vencedor = null) {
      try {
        const c = normalizarCodigo(codigo)
        const sala = c ? salas.ler(c) : null
        if (sala) salas.gravar(c, salaEncerrada(sala, vencedor))
      } catch {
        // storage cheio ou bloqueado: quem sai não tem o que fazer com isso
      }
    },
    conviteRecebido: () => normalizarCodigo(convite()),
  }
}
