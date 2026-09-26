// HOST DE DESENVOLVIMENTO: o jogo rodando sozinho, sem o RoqueOS em volta.
//
// É o que roda no `yarn dev` de um repo de jogo e o que permite a alguém de
// fora contribuir sem conta, sem Firebase de produção e sem o código do
// RoqueOS. Tudo aqui usa só o navegador: localStorage no lugar da conta,
// console no lugar do analytics, e nenhuma capacidade de IA (o jogo que usa IA
// precisa funcionar sem ela, e é aqui que se prova que funciona).
//
// A sala online roda entre duas abas do mesmo navegador: a sala mora no
// localStorage, e o evento `storage` leva a mudança de uma aba para a outra.
// Sem rede e sem Firebase, para quem contribui testar a partida online sem
// conta nenhuma.

import { VERSAO_DO_CONTRATO } from '../contrato.js'
import { normalizarIdioma } from '../idiomas.js'
import { armazenamentoDoJogo, armazenamentoEmMemoria, chaveDoJogo } from './armazenamento.js'
import { capacidadeSala, criarOuvintes, gerarCodigo } from './sala.js'

function storageDisponivel(janela, qual = 'localStorage') {
  try {
    const s = janela[qual]
    if (!s) return null
    s.getItem('roqueos:teste')
    return s
  } catch {
    return null
  }
}

/**
 * Onde as salas moram aqui: `roqueos:<jogo>:sala:<CÓDIGO>` no localStorage,
 * em JSON. O navegador manda o evento `storage` para as OUTRAS abas, nunca
 * para a que escreveu; por isso `gravar` avisa na hora quem observa nesta
 * aba, e o evento cuida das outras.
 */
function salasNoStorage(jogoId, storage, janela) {
  const prefixo = chaveDoJogo(jogoId, 'sala:')
  const ler = (codigo) => {
    try {
      const bruto = storage.getItem(prefixo + codigo)
      return bruto ? JSON.parse(bruto) : null
    } catch {
      return null
    }
  }
  const ouvintes = criarOuvintes(ler)
  if (typeof janela.addEventListener === 'function') {
    janela.addEventListener('storage', (evento) => {
      const chave = evento?.key
      // Chave nula é o `localStorage.clear()` de outra aba: toda sala pode ter sumido.
      if (chave === null || chave === undefined) {
        for (const codigo of ouvintes.codigos()) ouvintes.avisar(codigo)
      } else if (typeof chave === 'string' && chave.startsWith(prefixo)) {
        ouvintes.avisar(chave.slice(prefixo.length))
      }
    })
  }
  return {
    ler,
    gravar(codigo, sala) {
      if (sala === null) storage.removeItem(prefixo + codigo)
      else storage.setItem(prefixo + codigo, JSON.stringify(sala))
      ouvintes.avisar(codigo)
    },
    ouvir: ouvintes.ouvir,
  }
}

/**
 * Cada aba é um jogador. Conta não existe aqui (a identidade continua a de
 * convidado), então a sala usa um jogador por aba, guardado no
 * sessionStorage: recarregar a aba volta como o mesmo jogador, e cai na
 * reentrada; abrir o link em outra aba é outra pessoa. Duplicar a aba copia o
 * sessionStorage e vira a mesma pessoa: a cópia da aba do anfitrião recebe
 * 'propria' ao entrar.
 */
function jogadorDaAba(jogoId, janela) {
  const s = storageDisponivel(janela, 'sessionStorage') ?? armazenamentoEmMemoria()
  const chave = chaveDoJogo(jogoId, 'jogador-da-aba')
  let sufixo = null
  try {
    sufixo = s.getItem(chave)
    if (!sufixo) {
      sufixo = gerarCodigo()
      s.setItem(chave, sufixo)
    }
  } catch {
    sufixo ??= gerarCodigo()
  }
  return { uid: `aba-${sufixo}`, nome: `Aba ${sufixo}` }
}

/** A própria página com ?sala=<código>, que é o que se abre na outra aba. */
function linkDaSala(janela, codigo) {
  try {
    const url = new URL(janela.location.href)
    url.searchParams.set('sala', codigo)
    return url.toString()
  } catch {
    return `?sala=${codigo}`
  }
}

function conviteDaUrl(janela) {
  try {
    return new URL(janela.location.href).searchParams.get('sala')
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
  const storage = storageDisponivel(janela) ?? armazenamentoEmMemoria()
  const armazenamento = armazenamentoDoJogo(jogoId, storage)

  const salas = salasNoStorage(jogoId, storage, janela)
  const jogador = jogadorDaAba(jogoId, janela)
  const criadasAqui = new Set()
  const sala = capacidadeSala({
    salas,
    jogador: () => jogador,
    link: (codigo) => linkDaSala(janela, codigo),
    convite: () => conviteDaUrl(janela),
    aoCriar(codigo) {
      criadasAqui.add(codigo)
      registro.info(`[${jogoId}] sala ${codigo}: abra ${linkDaSala(janela, codigo)} em outra aba`)
    },
  })
  // O RoqueOS marca `anfitriaoSaiu` quando a conexão do anfitrião cai. Aqui o
  // equivalente é a aba que criou a sala fechar ou recarregar.
  if (typeof janela.addEventListener === 'function') {
    janela.addEventListener('pagehide', () => {
      for (const codigo of criadasAqui) {
        try {
          const atual = salas.ler(codigo)
          if (atual) salas.gravar(codigo, { ...atual, anfitriaoSaiu: true })
        } catch {
          // a aba está fechando; não há a quem avisar
        }
      }
    })
  }

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
    sala,
  }
}
