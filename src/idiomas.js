// Os dez idiomas do RoqueOS. pt-BR é o canônico, en-US é obrigatório junto,
// e ar-AR corre da direita para a esquerda. Um jogo que entra no RoqueOS fala
// os dez, porque a galeria, a App Store e o site falam os dez.

export const IDIOMAS = Object.freeze([
  'pt-BR',
  'en-US',
  'es-ES',
  'fr-FR',
  'de-DE',
  'ja-JP',
  'zh-CN',
  'hi-IN',
  'ru-RU',
  'ar-AR',
])

export const IDIOMA_CANONICO = 'pt-BR'
export const IDIOMA_DE_RECUO = 'en-US'

/**
 * Leva o que o navegador diz (`pt`, `pt-PT`, `en-GB`, `zh-Hans-CN`) para um
 * dos dez. Sem casamento, cai no en-US, que é o recuo da casa.
 * @param {string | null | undefined} pedido
 * @returns {string}
 */
export function normalizarIdioma(pedido) {
  if (!pedido || typeof pedido !== 'string') return IDIOMA_DE_RECUO
  const exato = IDIOMAS.find((i) => i.toLowerCase() === pedido.toLowerCase())
  if (exato) return exato
  const lingua = pedido.split(/[-_]/)[0].toLowerCase()
  return IDIOMAS.find((i) => i.split('-')[0] === lingua) ?? IDIOMA_DE_RECUO
}
