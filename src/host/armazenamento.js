// O espaço de chaves de um jogo: roqueos:<jogo>:<chave>.
//
// É o formato que os jogos já usavam no localStorage do RoqueOS (o recorde do
// 2048 mora em `roqueos:game2048:best`). O host do RoqueOS e o de
// desenvolvimento usam o mesmo formato, então extrair um jogo do front não
// zera o recorde de ninguém.

export const chaveDoJogo = (jogoId, chave) => `roqueos:${jogoId}:${chave}`

/** Um Storage em memória, para quando o navegador não deixa usar o de verdade. */
export function armazenamentoEmMemoria() {
  const dados = new Map()
  return {
    getItem: (k) => (dados.has(k) ? dados.get(k) : null),
    setItem: (k, v) => void dados.set(k, String(v)),
    removeItem: (k) => void dados.delete(k),
  }
}

/**
 * A capacidade `armazenamento` sobre qualquer Storage. Janela anônima, modo
 * privado do Safari e cota estourada lançam exceção no getItem/setItem; o jogo
 * não pode morrer por isso, então a falha vira null na leitura e false na
 * escrita.
 */
export function armazenamentoDoJogo(jogoId, storage) {
  return {
    ler(chave) {
      try {
        return storage.getItem(chaveDoJogo(jogoId, chave))
      } catch {
        return null
      }
    },
    gravar(chave, valor) {
      try {
        storage.setItem(chaveDoJogo(jogoId, chave), String(valor))
        return true
      } catch {
        return false
      }
    },
    apagar(chave) {
      try {
        storage.removeItem(chaveDoJogo(jogoId, chave))
        return true
      } catch {
        return false
      }
    },
  }
}
