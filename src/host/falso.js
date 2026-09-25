// HOST FALSO: o host de teste. Tudo em memória, e toda chamada fica anotada
// em `host.chamadas`, para o teste afirmar O QUE o jogo pediu ao sistema, e
// não só que ele não quebrou.
//
// `disparar` simula o que vem de fora: o jogador entra na conta no meio da
// partida, o idioma muda. Um teste que nunca troca o estado não prova que o
// jogo reage à troca.

import { VERSAO_DO_CONTRATO } from '../contrato.js'
import { armazenamentoDoJogo, armazenamentoEmMemoria } from './armazenamento.js'

/**
 * @param {{ jogoId?: string, uid?: string | null, nome?: string | null, idioma?: string,
 *   modoLeve?: boolean, ia?: ((pedido: object) => Promise<string | null>) | null }} [opcoes]
 */
export function criarHostFalso({
  jogoId = 'teste',
  uid = null,
  nome = null,
  idioma = 'pt-BR',
  modoLeve = false,
  ia = null,
} = {}) {
  const chamadas = []
  const anotar = (capacidade, metodo, args) => chamadas.push({ capacidade, metodo, args })
  const ouvintes = { identidade: new Set(), idioma: new Set() }
  const estado = { identidade: { uid, nome }, idioma, telaCheia: false }
  const storage = armazenamentoEmMemoria()
  const armazenamento = armazenamentoDoJogo(jogoId, storage)
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
    /** Simula mudança vinda de fora: 'identidade' com { uid, nome }, ou 'idioma' com o código. */
    disparar(o, valor) {
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
  return host
}
