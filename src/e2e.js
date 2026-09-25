// Modo de teste de ponta a ponta. Os harnesses (Playwright, Cypress) semeiam
// `window.__ROS_E2E__` antes de qualquer script da página, e o jogo usa isso
// para instalar o gancho de QA e pular o que o harness não consegue fazer
// (carregar modelo 3D de verdade, pedir permissão de áudio). Em produção
// ninguém escreve esse global, e as duas funções devolvem falso e null.

/** @returns {boolean} */
export function emModoE2E(janela = globalThis) {
  return Boolean(janela && janela.__ROS_E2E__)
}

/**
 * @param {string} chave
 * @returns {unknown}
 */
export function estadoE2E(chave, janela = globalThis) {
  return (janela && janela.__ROS_E2E__ && janela.__ROS_E2E__[chave]) ?? null
}
