// O MANIFESTO DO JOGO: `jogo.json`, na raiz do repo de cada jogo.
//
// É o jogo dizendo quem ele é. O RoqueOS lê os manifestos dos jogos instalados
// e gera a partir deles o catálogo, os registros de janela, a lista de jogos
// que aceitam convite por QR e a lista do Pódio. Antes da extração isso eram
// cinco listas escritas à mão no front, e cada jogo novo precisava lembrar das
// cinco.
//
// O slug é o endereço público (roqueos.com.br/jogos/<slug>) e é PERMANENTE:
// mudar quebra link compartilhado e zera o histórico da URL na busca. Quem
// trava isso é o RoqueOS, que compara com o slug já publicado; aqui se confere
// só o formato.

import { CAPACIDADES, OPCIONAIS, VERSAO_DO_CONTRATO } from './contrato.js'
import { IDIOMAS } from './idiomas.js'

/**
 * As etiquetas que a galeria sabe desenhar. O rótulo traduzido mora no
 * RoqueOS, na chave `games.tag<Etiqueta>`; etiqueta nova é mudança nos dois
 * lados, e por isso a lista é fechada.
 */
export const ETIQUETAS = Object.freeze([
  '3d',
  'AI',
  'Arcade',
  'Bahia',
  'Board',
  'Chain',
  'Classic',
  'Creative',
  'Echo',
  'Flocking',
  'Lightning',
  'Logic',
  'Loot',
  'Memory',
  'Multiplayer',
  'Music',
  'OneTouch',
  'Phases',
  'Physics',
  'Puzzle',
  'Quiz',
  'Racing',
  'Reflex',
  'Rpg',
  'Sandbox',
  'Strategy',
  'Survival',
  'Swarm',
  'Waves',
  'Zen',
])

/** A meta description do buscador corta perto disso. */
export const LIMITE_DO_RESUMO = 160

const ID = /^[a-z][a-z0-9]*$/
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/
const texto = (v) => typeof v === 'string' && v.trim().length > 0

function porIdioma(valor, campo, problemas) {
  if (!valor || typeof valor !== 'object') {
    problemas.push(`${campo} precisa de um texto por idioma, nos ${IDIOMAS.length}`)
    return
  }
  const faltando = IDIOMAS.filter((i) => !texto(valor[i]))
  if (faltando.length) problemas.push(`${campo} sem texto em: ${faltando.join(', ')}`)
  const sobrando = Object.keys(valor).filter((i) => !IDIOMAS.includes(i))
  if (sobrando.length)
    problemas.push(`${campo} tem idioma que a casa não fala: ${sobrando.join(', ')}`)
}

function seo(valor, problemas) {
  // SEO é conteúdo escrito, não traduzido por máquina: existe em pt-BR e en-US,
  // e os outros oito idiomas caem no en-US. É a decisão que o catálogo já seguia.
  for (const idioma of ['pt-BR', 'en-US']) {
    const s = valor?.[idioma]
    if (!s) {
      problemas.push(`seo.${idioma} ausente`)
      continue
    }
    for (const campo of ['resumo', 'sobre', 'comoJogar']) {
      if (!texto(s[campo])) problemas.push(`seo.${idioma}.${campo} vazio`)
    }
    if (texto(s.resumo) && s.resumo.length > LIMITE_DO_RESUMO) {
      problemas.push(
        `seo.${idioma}.resumo tem ${s.resumo.length} caracteres, o limite é ${LIMITE_DO_RESUMO}`,
      )
    }
  }
}

/**
 * Confere um manifesto. Devolve todos os problemas de uma vez.
 * @param {any} m o conteúdo de jogo.json
 * @returns {string[]}
 */
export function validarManifesto(m) {
  const problemas = []
  if (!m || typeof m !== 'object') return ['jogo.json não é um objeto']

  if (!ID.test(m.id ?? '')) problemas.push(`id inválido: ${JSON.stringify(m.id)}`)
  if (!SLUG.test(m.slug ?? '')) problemas.push(`slug inválido: ${JSON.stringify(m.slug)}`)
  if (m.versaoDoContrato !== VERSAO_DO_CONTRATO) {
    problemas.push(
      `versaoDoContrato é ${m.versaoDoContrato}, este SDK fala o ${VERSAO_DO_CONTRATO}`,
    )
  }

  porIdioma(m.nome, 'nome', problemas)
  porIdioma(m.descricao, 'descricao', problemas)
  seo(m.seo, problemas)

  if (!Array.isArray(m.etiquetas) || m.etiquetas.length === 0) {
    problemas.push('etiquetas: ao menos uma')
  } else {
    const desconhecidas = m.etiquetas.filter((e) => !ETIQUETAS.includes(e))
    if (desconhecidas.length)
      problemas.push(`etiqueta que a galeria não conhece: ${desconhecidas.join(', ')}`)
  }

  if (!/^[\w./-]+\.(jpg|jpeg|png|webp)$/.test(m.capa ?? ''))
    problemas.push('capa: caminho de imagem no repo')
  if (!/^[\w./-]+\.svg$/.test(m.icone ?? '')) problemas.push('icone: caminho de SVG no repo')
  if (m.brilho !== undefined && !/^rgba?\(/.test(m.brilho)) problemas.push('brilho: cor rgba()')

  const j = m.janela
  if (
    !j ||
    ![j.largura, j.altura, j.minLargura, j.minAltura].every((n) => Number.isInteger(n) && n > 0)
  ) {
    problemas.push('janela: largura, altura, minLargura e minAltura em pixels')
  }

  for (const campo of ['aceitaConvite', 'entraNoPodio']) {
    if (typeof m[campo] !== 'boolean')
      problemas.push(`${campo}: true ou false, dito com todas as letras`)
  }
  if (m.entraNoPodio && !m.recorde)
    problemas.push('entraNoPodio sem recorde: o Pódio compara o quê?')
  if (m.recorde !== null && m.recorde !== undefined) {
    if (!texto(m.recorde.chave))
      problemas.push('recorde.chave: a chave do armazenamento onde o best mora')
    if (typeof m.recorde.maiorEMelhor !== 'boolean')
      problemas.push('recorde.maiorEMelhor: true ou false')
  }

  const caps = m.capacidades ?? []
  if (!Array.isArray(caps)) problemas.push('capacidades: lista')
  else {
    const erradas = caps.filter((c) => !OPCIONAIS.includes(c))
    if (erradas.length) {
      problemas.push(
        `capacidades só lista as opcionais que o jogo exige (${OPCIONAIS.join(', ')}); ` +
          `não reconhecidas ou obrigatórias: ${erradas.join(', ')}` +
          (erradas.some((c) => c in CAPACIDADES) ? ' (as obrigatórias o host sempre dá)' : ''),
      )
    }
    // O RoqueOS só abre o jogo pelo link do convite (e pelo QR) quando o
    // manifesto diz aceitaConvite. Jogo com sala e sem isso gera um convite
    // que abre o desktop e para ali, sem o jogo e sem erro nenhum.
    if (caps.includes('sala') && m.aceitaConvite === false) {
      problemas.push(
        'capacidades tem sala e aceitaConvite é false: o link do convite abriria o RoqueOS sem abrir o jogo',
      )
    }
  }
  return problemas
}
