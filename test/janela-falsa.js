// Uma janela de navegador mínima para os testes do host de desenvolvimento.
// `storageQuebrado` imita o Safari em modo privado, que lança no getItem.
//
// Duas abas do mesmo navegador dividem o localStorage e cada uma tem o seu
// sessionStorage: passe o mesmo `dados` para as duas. O evento `storage` NÃO
// é entregue sozinho na outra aba, de propósito: o teste dispara à mão com
// `emitir('storage', { key })`, e assim prova que é o evento que carrega a
// mudança, e não um atalho do teste.

function storageSobre(dados) {
  return {
    getItem: (k) => (dados.has(k) ? dados.get(k) : null),
    setItem: (k, v) => void dados.set(k, String(v)),
    removeItem: (k) => void dados.delete(k),
  }
}

export function janelaFalsa({
  language = 'pt-BR',
  coarse = false,
  deviceMemory,
  storageQuebrado = false,
  dados = new Map(),
  sessao = new Map(),
  href = 'http://localhost:5173/',
} = {}) {
  const ouvintes = {}
  const quebra = () => {
    throw new Error('SecurityError')
  }
  const quebrado = { getItem: quebra, setItem: quebra, removeItem: quebra }
  return {
    dados,
    sessao,
    navigator: { language, deviceMemory },
    location: { href },
    localStorage: storageQuebrado ? quebrado : storageSobre(dados),
    sessionStorage: storageQuebrado ? quebrado : storageSobre(sessao),
    matchMedia: (q) => ({ matches: q === '(pointer: coarse)' && coarse }),
    addEventListener: (ev, fn) => (ouvintes[ev] ??= []).push(fn),
    emitir(ev, evento) {
      for (const fn of ouvintes[ev] ?? []) fn(evento)
    },
  }
}
