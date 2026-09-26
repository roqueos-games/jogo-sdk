// HOST FALSO: o host de teste. Tudo em memória, e toda chamada fica anotada
// em `host.chamadas`, para o teste afirmar O QUE o jogo pediu ao sistema, e
// não só que ele não quebrou.
//
// `disparar` simula o que vem de fora: o jogador entra na conta no meio da
// partida, o idioma muda, o outro jogador entra na sala e joga. Um teste que
// nunca troca o estado não prova que o jogo reage à troca.

import { VERSAO_DO_CONTRATO } from '../contrato.js'
import { armazenamentoDoJogo, armazenamentoEmMemoria } from './armazenamento.js'
import {
  capacidadeSala,
  entrarNaSala,
  jogadaNaSala,
  normalizarCodigo,
  novaSala,
  salaEncerrada,
  salasEmMemoria,
} from './sala.js'

/**
 * @param {{ jogoId?: string, uid?: string | null, nome?: string | null, idioma?: string,
 *   modoLeve?: boolean, ia?: ((pedido: object) => Promise<string | null>) | null,
 *   sala?: boolean, convite?: string | null }} [opcoes]
 *   `sala: false` tira a capacidade, para o teste do jogo que joga sem ela;
 *   `convite` é o código com que a janela foi aberta (o link ou o QR).
 */
export function criarHostFalso({
  jogoId = 'teste',
  uid = null,
  nome = null,
  idioma = 'pt-BR',
  modoLeve = false,
  ia = null,
  sala = true,
  convite = null,
} = {}) {
  const chamadas = []
  const anotar = (capacidade, metodo, args) => chamadas.push({ capacidade, metodo, args })
  const ouvintes = { identidade: new Set(), idioma: new Set() }
  const estado = { identidade: { uid, nome }, idioma, telaCheia: false }
  const storage = armazenamentoEmMemoria()
  const armazenamento = armazenamentoDoJogo(jogoId, storage)
  const salas = salasEmMemoria()
  let placar = null

  const host = {
    versaoDoContrato: VERSAO_DO_CONTRATO,
    chamadas,
    storage,
    identidade: {
      atual: () => ({ ...estado.identidade }),
      aoMudar(fn) {
        ouvintes.identidade.add(fn)
        return () => ouvintes.identidade.delete(fn)
      },
    },
    avisar(mensagem, opcoes = {}) {
      anotar('avisar', 'avisar', [mensagem, opcoes])
    },
    audio: {
      contexto: () => null,
      async destravar() {
        anotar('audio', 'destravar', [])
      },
    },
    desempenho: { modoLeve: () => modoLeve },
    metricas: {
      evento(nomeDoEvento, dados = {}) {
        anotar('metricas', 'evento', [nomeDoEvento, dados])
      },
    },
    placar: {
      async carregar() {
        anotar('placar', 'carregar', [])
        return placar ? { ...placar } : null
      },
      async salvar(dados = {}) {
        anotar('placar', 'salvar', [dados])
        placar = { ...(placar ?? {}), ...dados }
        return true
      },
    },
    armazenamento,
    idioma: {
      atual: () => estado.idioma,
      aoMudar(fn) {
        ouvintes.idioma.add(fn)
        return () => ouvintes.idioma.delete(fn)
      },
    },
    tela: {
      async alternarTelaCheia() {
        estado.telaCheia = !estado.telaCheia
        anotar('tela', 'alternarTelaCheia', [])
      },
      emTelaCheia: () => estado.telaCheia,
    },
    teclado: {
      reivindicar() {
        anotar('teclado', 'reivindicar', [])
      },
      liberar() {
        anotar('teclado', 'liberar', [])
      },
    },
    /**
     * Simula mudança vinda de fora: 'identidade' com { uid, nome }, 'idioma'
     * com o código, ou 'sala' com { acao, codigo, ... } para o outro jogador
     * (veja `outroJogador` abaixo).
     */
    disparar(o, valor) {
      if (o === 'sala') return outroJogador(valor)
      if (o === 'identidade')
        estado.identidade = { uid: valor?.uid ?? null, nome: valor?.nome ?? null }
      else if (o === 'idioma') estado.idioma = valor
      else throw new Error(`disparar não conhece "${o}"`)
      for (const fn of ouvintes[o]) fn(o === 'identidade' ? { ...estado.identidade } : valor)
    },
    /** Quantas vezes o jogo chamou capacidade.metodo. */
    contar(capacidade, metodo) {
      return chamadas.filter((c) => c.capacidade === capacidade && c.metodo === metodo).length
    },
  }

  if (ia) {
    host.ia = {
      async completar(pedido) {
        anotar('ia', 'completar', [pedido])
        return ia(pedido)
      },
    }
  }

  if (sala) {
    const capacidade = capacidadeSala({
      salas,
      jogador: () => ({ ...estado.identidade }),
      // .invalid é reservado e nunca resolve: um link do teste que vaze para
      // algum lugar não abre a página de ninguém.
      link: (codigo) => `https://host-falso.invalid/${jogoId}?sala=${codigo}`,
      convite: () => convite,
    })
    host.sala = {}
    for (const [metodo, fn] of Object.entries(capacidade)) {
      host.sala[metodo] = (...args) => {
        anotar('sala', metodo, args)
        return fn(...args)
      }
    }
    /** As salas guardadas, com os nomes do SDK, para o teste olhar sem passar pelo jogo. */
    host.salas = salas
  }

  /**
   * O outro jogador, do outro lado da sala. Ele não passa pelo jogo, então
   * nada disto vai para `chamadas`: `chamadas` é o que o JOGO pediu. As
   * regras de quem senta onde são as mesmas da capacidade.
   *
   *   { acao: 'criar', codigo, uid, nome, estadoInicial, vez }  o outro abriu a
   *       sala do convite (o teste escolhe o código)
   *   { acao: 'entrar', codigo, uid, nome }  devolve o que o `entrar` devolveria
   *   { acao: 'jogar', codigo, estado, vez, vencedor, situacao }
   *   { acao: 'encerrar', codigo, vencedor }
   *   { acao: 'anfitriaoSaiu', codigo }  o anfitrião fechou a aba
   *   { acao: 'sumir', codigo }  a sala deixou de existir; quem observa recebe null
   */
  function outroJogador({
    acao,
    codigo,
    uid: outro = 'outro',
    nome: nomeDoOutro = null,
    ...resto
  } = {}) {
    if (!sala) throw new Error('este host falso foi criado com sala: false')
    const c = normalizarCodigo(codigo)
    if (!c) throw new Error(`disparar('sala') precisa do código da sala`)
    const atual = salas.ler(c)
    const exigirSala = () => {
      if (!atual) throw new Error(`disparar('sala'): não há sala ${c}`)
      return atual
    }
    switch (acao) {
      case 'criar':
        if (atual) throw new Error(`disparar('sala'): a sala ${c} já existe`)
        salas.gravar(c, novaSala({ uid: outro, nome: nomeDoOutro, ...resto }))
        return c
      case 'entrar': {
        const { resultado, sala: sentada } = entrarNaSala(atual, { uid: outro, nome: nomeDoOutro })
        if (sentada) salas.gravar(c, sentada)
        return resultado
      }
      case 'jogar':
        return void salas.gravar(c, jogadaNaSala(atual, resto))
      case 'encerrar':
        return void salas.gravar(c, salaEncerrada(exigirSala(), resto.vencedor ?? null))
      case 'anfitriaoSaiu':
        return void salas.gravar(c, { ...exigirSala(), anfitriaoSaiu: true })
      case 'sumir':
        return void salas.gravar(c, null)
      default:
        throw new Error(`disparar('sala') não conhece a ação "${acao}"`)
    }
  }

  return host
}
