// O espaço de chaves de um jogo: roqueos:<jogo>:<chave>.
//
// É o formato que os jogos já usavam no localStorage do RoqueOS (o recorde do
// 2048 mora em `roqueos:game2048:best`). O host do RoqueOS e o de
// desenvolvimento usam o mesmo formato, então extrair um jogo do front não
// zera o recorde de ninguém.

export const chaveDoJogo = (jogoId, chave) => `roqueos:${jogoId}:${chave}`

/**
 * Um Storage em memória, para quando o navegador não deixa usar o de verdade.
 * Enumera como o de verdade (`length` e `key(i)`), porque a sala ao vivo
 * precisa achar as folhas de uma sala que já existia antes de a janela abrir.
 */
export function armazenamentoEmMemoria() {
  const dados = new Map()
  // A lista de chaves só é refeita quando uma chave nasce ou some: percorrer
  // as n chaves com key(i) não pode custar n² numa sala com mil folhas.
  let chaves = null
  return {
    getItem: (k) => (dados.has(k) ? dados.get(k) : null),
    setItem(k, v) {
      if (!dados.has(k)) chaves = null
      dados.set(k, String(v))
    },
    removeItem(k) {
      if (dados.delete(k)) chaves = null
    },
    key: (i) => (chaves ??= [...dados.keys()])[i] ?? null,
    get length() {
      return dados.size
    },
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
