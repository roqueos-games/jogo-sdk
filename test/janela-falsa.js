// Uma janela de navegador mínima para os testes do host de desenvolvimento.
// `storageQuebrado` imita o Safari em modo privado, que lança no getItem.

export function janelaFalsa({
  language = 'pt-BR',
  coarse = false,
  deviceMemory,
  storageQuebrado = false,
} = {}) {
  const dados = new Map()
  const ouvintes = {}
  const quebra = () => {
    throw new Error('SecurityError')
  }
  return {
    dados,
    navigator: { language, deviceMemory },
    localStorage: storageQuebrado
      ? { getItem: quebra, setItem: quebra, removeItem: quebra }
      : {
          getItem: (k) => (dados.has(k) ? dados.get(k) : null),
          setItem: (k, v) => void dados.set(k, String(v)),
          removeItem: (k) => void dados.delete(k),
        },
    matchMedia: (q) => ({ matches: q === '(pointer: coarse)' && coarse }),
    addEventListener: (ev, fn) => (ouvintes[ev] ??= []).push(fn),
    emitir(ev) {
      for (const fn of ouvintes[ev] ?? []) fn()
    },
  }
}
