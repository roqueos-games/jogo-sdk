// HOST FALSO: o host de teste. Tudo em memória, e toda chamada fica anotada
// em `host.chamadas`, para o teste afirmar O QUE o jogo pediu ao sistema, e
// não só que ele não quebrou.
//
// `disparar` simula o que vem de fora: o jogador entra na conta no meio da
// partida, o idioma muda, o outro jogador entra na sala e joga, a conexão
// cai, o servidor de IA some, a leitura do save falha. Um teste que nunca
// troca o estado não prova que o jogo reage à troca.

import { VERSAO_DO_CONTRATO } from '../contrato.js'
import { armazenamentoDoJogo, armazenamentoEmMemoria } from './armazenamento.js'
import { conferirPedidoDaIa } from './ia.js'
import { capacidadeProgresso, erroIndisponivel } from './progresso.js'
import {
  capacidadeSala,
  entrarNaSala,
  jogadaNaSala,
  normalizarCodigo,
  novaSala,
  salaEncerrada,
  salasEmMemoria,
} from './sala.js'
import { criarSalaAoVivo } from './salaAoVivo.js'

/** Envolve cada função de uma capacidade para anotar a chamada antes de repassar. */
function anotada(capacidade, nome, anotar) {
  const saida = {}
  for (const [metodo, fn] of Object.entries(capacidade)) {
    saida[metodo] = (...args) => {
      anotar(nome, metodo, args)
      return fn(...args)
    }
  }
  return saida
}

/**
 * @param {{ jogoId?: string, uid?: string | null, nome?: string | null, idioma?: string,
 *   modoLeve?: boolean, ia?: ((pedido: object) => Promise<string | null>) | null,
 *   iaDisponivel?: boolean, sala?: boolean, salaAoVivo?: boolean, convite?: string | null,
 *   recusar?: ((pedido: { operacao: string, codigo: string, caminho: string,
 *     uid: string | null, valor?: unknown }) => boolean) | null,
 *   progresso?: false | { salvo?: object | null, falharLeitura?: boolean,
 *     falharEscrita?: boolean, disponivel?: boolean } }} [opcoes]
 *   `sala: false` e `salaAoVivo: false` tiram a capacidade, para o teste do
 *   jogo que joga sem ela; `convite` é o código com que a janela foi aberta
 *   (o link ou o QR), e vale para as duas salas. `recusar` faz o papel da
 *   regra do banco na sala ao vivo: devolve true e a operação é recusada.
 *   `progresso.disponivel` sem valor segue a conta, como no RoqueOS.
 */
export function criarHostFalso({
  jogoId = 'teste',
  uid = null,
  nome = null,
  idioma = 'pt-BR',
  modoLeve = false,
  ia = null,
  iaDisponivel = true,
  sala = true,
  salaAoVivo = true,
  convite = null,
  recusar = null,
  progresso = {},
} = {}) {
  const chamadas = []
  const anotar = (capacidade, metodo, args) => chamadas.push({ capacidade, metodo, args })
  const ouvintes = { identidade: new Set(), idioma: new Set() }
  const estado = { identidade: { uid, nome }, idioma, telaCheia: false, iaDisponivel }
  const storage = armazenamentoEmMemoria()
  const armazenamento = armazenamentoDoJogo(jogoId, storage)
  const salas = salasEmMemoria()
  /** O que o host falso diria no console (a sala ao vivo recusando, o save recusado). */
  const avisosDoHost = []
  const registro = { warn: (mensagem) => avisosDoHost.push(mensagem) }
  let placar = null

  const host = {
    versaoDoContrato: VERSAO_DO_CONTRATO,
    chamadas,
    storage,
    avisosDoHost,
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
     * com o código, 'sala' com { acao, codigo, ... } para o outro jogador
     * (veja `outroJogador` abaixo), 'salaAoVivo' com { acao, codigo, ... }
     * para os outros jogadores da sala ao vivo (veja `criarSalaAoVivo`),
     * 'conexao' com true ou false (cair roda o que o jogo armou com aoCair),
     * 'ia' com { disponivel } e 'progresso' com { falharLeitura,
     * falharEscrita, disponivel, salvo }.
     */
    disparar(o, valor) {
      if (o === 'sala') return outroJogador(valor)
      if (o === 'salaAoVivo') return exigirAoVivo().deFora(valor)
      if (o === 'conexao') return exigirAoVivo().definirConexao(valor, { executar: true })
      if (o === 'ia') {
        if (!host.ia) throw new Error('este host falso foi criado sem ia')
        estado.iaDisponivel = Boolean(valor?.disponivel)
        return
      }
      if (o === 'progresso') {
        if (!estadoDoProgresso) throw new Error('este host falso foi criado com progresso: false')
        for (const campo of ['falharLeitura', 'falharEscrita', 'disponivel']) {
          if (valor && campo in valor) estadoDoProgresso[campo] = valor[campo]
        }
        if (valor && 'salvo' in valor) {
          estadoDoProgresso.salvo = valor.salvo ? structuredClone(valor.salvo) : null
        }
        return
      }
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

  // A IA existe quando o teste dá a função que responde. O pedido é conferido
  // no formato do contrato; sem modelo, resposta que não é texto ou erro da
  // função, o jogo recebe null, como receberia do host do RoqueOS.
  if (ia) {
    host.ia = {
      disponivel() {
        anotar('ia', 'disponivel', [])
        return estado.iaDisponivel
      },
      async completar(pedido) {
        anotar('ia', 'completar', [pedido])
        conferirPedidoDaIa(pedido)
        if (!estado.iaDisponivel) return null
        try {
          const resposta = await ia(pedido)
          return typeof resposta === 'string' ? resposta : null
        } catch {
          return null
        }
      },
    }
  }

  // .invalid é reservado e nunca resolve: um link do teste que vaze para
  // algum lugar não abre a página de ninguém.
  const linkDaSala = (codigo) => `https://host-falso.invalid/${jogoId}?sala=${codigo}`

  if (sala) {
    const capacidade = capacidadeSala({
      salas,
      jogador: () => ({ ...estado.identidade }),
      link: linkDaSala,
      convite: () => convite,
    })
    host.sala = anotada(capacidade, 'sala', anotar)
    /** As salas guardadas, com os nomes do SDK, para o teste olhar sem passar pelo jogo. */
    host.salas = salas
  }

  // A sala ao vivo mora no mesmo Storage em memória do armazenamento, uma
  // folha por chave, com o mesmo motor do host de desenvolvimento. Os outros
  // jogadores entram por `disparar('salaAoVivo', { acao, codigo, uid, ... })`:
  //
  //   { acao: 'criar', codigo, uid, nome, meta }  o outro abriu a sala (o
  //       teste escolhe o código); o meta ganha host, hostName e createdAt
  //   { acao: 'gravar' | 'atualizar' | 'apagar', codigo, uid, caminho, valor }
  //   { acao: 'empurrar', codigo, uid, caminho, valor }  devolve a chave
  //   { acao: 'aoCair', codigo, uid, caminho }  o que some quando ele cair
  //   { acao: 'cair', uid }  a conexão dele caiu: roda o que ele armou
  //   { acao: 'sumir', codigo }  a sala inteira deixou de existir
  const aoVivo = salaAoVivo
    ? criarSalaAoVivo({
        storage,
        jogoId,
        jogador: () => ({ ...estado.identidade }),
        link: linkDaSala,
        convite: () => convite,
        registro,
        recusar,
      })
    : null
  function exigirAoVivo() {
    if (!aoVivo) throw new Error('este host falso foi criado com salaAoVivo: false')
    return aoVivo
  }
  if (aoVivo) {
    host.salaAoVivo = anotada(aoVivo.capacidade, 'salaAoVivo', anotar)
    /** A sala inteira como o banco devolveria, para o teste olhar sem passar pelo jogo. */
    host.arvoreDaSala = (codigo) => aoVivo.arvore(codigo)
  }

  // O progresso em memória, recusando o que o Firestore recusa.
  const estadoDoProgresso = progresso
    ? {
        salvo: progresso.salvo ? structuredClone(progresso.salvo) : null,
        falharLeitura: Boolean(progresso.falharLeitura),
        falharEscrita: Boolean(progresso.falharEscrita),
        disponivel: progresso.disponivel,
      }
    : null
  if (estadoDoProgresso) {
    const capacidade = capacidadeProgresso({
      registro,
      disponivel: () => estadoDoProgresso.disponivel ?? Boolean(estado.identidade.uid),
      guardado: {
        ler() {
          if (estadoDoProgresso.falharLeitura) {
            throw erroIndisponivel(new Error('a leitura falhou (host falso, falharLeitura)'))
          }
          return estadoDoProgresso.salvo
        },
        gravar(doc) {
          if (estadoDoProgresso.falharEscrita) return false
          estadoDoProgresso.salvo = doc
          return true
        },
      },
    })
    host.progresso = anotada(capacidade, 'progresso', anotar)
    /** O documento guardado agora (cópia), para o teste olhar sem passar pelo jogo. */
    host.progressoGuardado = () =>
      estadoDoProgresso.salvo === null ? null : structuredClone(estadoDoProgresso.salvo)
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
