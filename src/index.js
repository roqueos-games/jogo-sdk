// A porta de entrada do SDK de jogo. Um jogo é um objeto com `mount`, criado
// por `definirJogo`, e é assim que ele entra no RoqueOS, no host de
// desenvolvimento e no teste, sem saber em qual dos três está.

import { VERSAO_DO_CONTRATO, verificarHost } from './contrato.js'

export {
  VERSAO_DO_CONTRATO,
  CAPACIDADES,
  OBRIGATORIAS,
  OPCIONAIS,
  SITUACOES_DA_SALA,
  ERROS_DA_SALA,
  verificarHost,
} from './contrato.js'
export { IDIOMAS, IDIOMA_CANONICO, IDIOMA_DE_RECUO, normalizarIdioma } from './idiomas.js'
export { emModoE2E, estadoE2E } from './e2e.js'
export { validarManifesto, ETIQUETAS, LIMITE_DO_RESUMO } from './manifesto.js'

const ID = /^[a-z][a-z0-9]*$/

/**
 * @typedef {object} Montagem
 * @property {(ativo: boolean) => void} [ativar] a janela ganhou ou perdeu o foco
 * @property {() => void} desmontar solta tudo: laço, listener, contexto WebGL, áudio
 */

/**
 * Define um jogo.
 *
 * `montar(el, host, { windowId, ativo })` recebe o elemento onde o jogo vive
 * (100% por 100%; o jogo mede o próprio tamanho) e devolve a montagem. O jogo
 * cria o próprio app (Vue, canvas cru, o que for) dentro de `el`.
 *
 * @param {{ id: string, capacidades?: string[], montar: Function }} definicao
 */
export function definirJogo({ id, capacidades = [], montar } = {}) {
  if (typeof id !== 'string' || !ID.test(id)) {
    throw new TypeError(
      `id de jogo inválido: ${JSON.stringify(id)} (minúsculas e dígitos, começando por letra)`,
    )
  }
  if (typeof montar !== 'function') {
    throw new TypeError(`[${id}] definirJogo precisa de montar(el, host, opcoes)`)
  }
  if (!Array.isArray(capacidades)) {
    throw new TypeError(`[${id}] capacidades é uma lista de nomes`)
  }
  const exigidas = Object.freeze([...capacidades])

  return Object.freeze({
    id,
    versaoDoContrato: VERSAO_DO_CONTRATO,
    capacidades: exigidas,
    /**
     * @param {object} el
     * @param {object} host
     * @param {{ windowId?: string | null, ativo?: boolean }} [opcoes]
     * @returns {Required<Montagem>}
     */
    mount(el, host, opcoes = {}) {
      if (!el || typeof el !== 'object') {
        throw new TypeError(`[${id}] mount precisa do elemento onde o jogo vive`)
      }
      const { ok, problemas } = verificarHost(host, { exigidas })
      if (!ok) throw new Error(`[${id}] host não cumpre o contrato: ${problemas.join('; ')}`)

      const montagem = montar(el, host, {
        windowId: opcoes.windowId ?? null,
        ativo: opcoes.ativo ?? true,
      })
      if (!montagem || typeof montagem.desmontar !== 'function') {
        throw new TypeError(`[${id}] montar precisa devolver { ativar, desmontar }`)
      }

      let desmontado = false
      return Object.freeze({
        ativar(ativo) {
          if (desmontado || typeof montagem.ativar !== 'function') return
          montagem.ativar(Boolean(ativo))
        },
        // Desmontar duas vezes acontece de verdade: a janela fecha e o
        // componente em volta desmonta logo depois. A segunda vez não faz nada.
        desmontar() {
          if (desmontado) return
          desmontado = true
          montagem.desmontar()
        },
      })
    },
  })
}
