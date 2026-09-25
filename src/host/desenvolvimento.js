// HOST DE DESENVOLVIMENTO: o jogo rodando sozinho, sem o RoqueOS em volta.
//
// É o que roda no `yarn dev` de um repo de jogo e o que permite a alguém de
// fora contribuir sem conta, sem Firebase de produção e sem o código do
// RoqueOS. Tudo aqui usa só o navegador: localStorage no lugar da conta,
// console no lugar do analytics, e nenhuma capacidade de IA (o jogo que usa IA
// precisa funcionar sem ela, e é aqui que se prova que funciona).

import { VERSAO_DO_CONTRATO } from '../contrato.js'
import { normalizarIdioma } from '../idiomas.js'
import { armazenamentoDoJogo, armazenamentoEmMemoria } from './armazenamento.js'

function storageDisponivel(janela) {
  try {
    const s = janela.localStorage
    if (!s) return null
    s.getItem('roqueos:teste')
    return s
  } catch {
    return null
  }
}

/**
 * @param {{ jogoId: string, janela?: any, registro?: Pick<Console, 'info' | 'debug' | 'warn'> }} opcoes
 */
export function criarHostDeDesenvolvimento({
  jogoId,
  janela = globalThis,
  registro = console,
} = {}) {
  if (!jogoId) throw new TypeError('criarHostDeDesenvolvimento precisa do jogoId')
  const armazenamento = armazenamentoDoJogo(
    jogoId,
    storageDisponivel(janela) ?? armazenamentoEmMemoria(),
  )

  let contexto = null
  const audio = {
    contexto() {
      if (contexto) return contexto
      const Ctor = janela.AudioContext ?? janela.webkitAudioContext
      if (!Ctor) return null
      try {
        contexto = new Ctor()
      } catch {
        contexto = null
      }
      return contexto
    },
    async destravar() {
      const ctx = audio.contexto()
      if (ctx && ctx.state === 'suspended') {
        try {
          await ctx.resume()
        } catch {
          // Sem gesto do usuário o iOS recusa; o jogo tenta de novo no próximo toque.
        }
      }
    },
  }

  // `salvar` chama `carregar` pela variável, nunca por `this`: o jogo que faz
  // `const { salvar } = host.placar` perderia o `this` e quebraria calado.
  const placar = {
    async carregar() {
      const bruto = armazenamento.ler('placar')
      if (!bruto) return null
      try {
        return JSON.parse(bruto)
      } catch {
        return null
      }
    },
    async salvar(dados = {}) {
      const anterior = (await placar.carregar()) ?? {}
      return armazenamento.gravar(
        'placar',
        JSON.stringify({ ...anterior, ...dados, atualizadoEm: Date.now() }),
      )
    },
  }

  const nav = janela.navigator ?? {}
  const ouvintesDeIdioma = new Set()
  if (typeof janela.addEventListener === 'function') {
    janela.addEventListener('languagechange', () => {
      const novo = normalizarIdioma(nav.language)
      for (const fn of ouvintesDeIdioma) fn(novo)
    })
  }

  return {
    versaoDoContrato: VERSAO_DO_CONTRATO,
    identidade: {
      atual: () => ({ uid: null, nome: null }),
      aoMudar: () => () => {},
    },
    avisar(mensagem, { tipo = 'info' } = {}) {
      registro.info(`[${jogoId}] ${tipo}: ${mensagem}`)
    },
    audio,
    desempenho: {
      modoLeve() {
        const toque = janela.matchMedia?.('(pointer: coarse)')?.matches === true
        const memoriaCurta = typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4
        return toque || memoriaCurta
      },
    },
    metricas: {
      evento(nome, dados = {}) {
        registro.debug(`[${jogoId}] evento ${nome}`, dados)
      },
    },
    placar,
    armazenamento,
    idioma: {
      atual: () => normalizarIdioma(nav.language),
      aoMudar(fn) {
        ouvintesDeIdioma.add(fn)
        return () => ouvintesDeIdioma.delete(fn)
      },
    },
    tela: {
      async alternarTelaCheia(el) {
        const doc = janela.document
        if (!doc) return
        if (doc.fullscreenElement) await doc.exitFullscreen?.()
        else await (el ?? doc.documentElement).requestFullscreen?.()
      },
      emTelaCheia: () => Boolean(janela.document?.fullscreenElement),
    },
    teclado: {
      reivindicar() {},
      liberar() {},
    },
  }
}
