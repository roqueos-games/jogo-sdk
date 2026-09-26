// O pedido da capacidade `ia`, conferido do jeito que o contrato escreve:
// completar({ sistema, mensagens: [{ papel: 'jogador' | 'modelo', texto }] }).
// O host falso confere, para quem porta um jogo descobrir no teste que mandou
// `role: 'user'` ou uma lista de textos soltos, e não no RoqueOS.

import { PAPEIS_DA_IA } from '../contrato.js'

export function conferirPedidoDaIa(pedido) {
  if (!pedido || typeof pedido !== 'object') {
    throw new TypeError('completar precisa de { sistema, mensagens }')
  }
  const { sistema, mensagens } = pedido
  if (sistema !== undefined && typeof sistema !== 'string') {
    throw new TypeError('completar: sistema é texto')
  }
  if (!Array.isArray(mensagens) || mensagens.length === 0) {
    throw new TypeError('completar: mensagens é uma lista com ao menos uma mensagem')
  }
  mensagens.forEach((m, i) => {
    if (!m || !PAPEIS_DA_IA.includes(m.papel) || typeof m.texto !== 'string') {
      throw new TypeError(
        `completar: mensagens[${i}] precisa ser { papel: ${PAPEIS_DA_IA.map((p) => `'${p}'`).join(' | ')}, texto }, veio ${JSON.stringify(m)}`,
      )
    }
  })
}
