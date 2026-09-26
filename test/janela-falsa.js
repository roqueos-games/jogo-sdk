// Uma janela de navegador mínima para os testes do host de desenvolvimento.
// `storageQuebrado` imita o Safari em modo privado, que lança no getItem.
//
// Duas abas do mesmo navegador dividem o localStorage e cada uma tem o seu
// sessionStorage: passe o mesmo `dados` para as duas. O evento `storage` NÃO
// é entregue sozinho na outra aba, de propósito: o teste dispara à mão com
// `emitir('storage', { key })`, ou com `entregarStorage()`, que entrega em
// ordem os eventos que as outras abas geraram desde a última entrega, como o
// navegador faria (com key, oldValue e newValue, e só quando o valor mudou).
// Assim o teste prova que é o evento que carrega a mudança, e não um atalho,
// e controla QUANDO ele chega: duas abas podem escrever antes de uma ouvir a
// outra.

const abasPorDados = new WeakMap()

function storageSobre(dados, aoMudar) {
  return {
    getItem: (k) => (dados.has(k) ? dados.get(k) : null),
    setItem(k, v) {
      const antes = dados.has(k) ? dados.get(k) : null
      dados.set(k, String(v))
      if (antes !== String(v)) aoMudar?.({ key: k, oldValue: antes, newValue: String(v) })
    },
    removeItem(k) {
      if (!dados.has(k)) return
      const antes = dados.get(k)
      dados.delete(k)
      aoMudar?.({ key: k, oldValue: antes, newValue: null })
    },
    key: (i) => [...dados.keys()][i] ?? null,
    get length() {
      return dados.size
    },
  }
}

export function janelaFalsa({
  language = 'pt-BR',
  coarse = false,
  deviceMemory,
  onLine = true,
  storageQuebrado = false,
  dados = new Map(),
  sessao = new Map(),
  href = 'http://localhost:5173/',
} = {}) {
  const ouvintes = {}
  const quebra = () => {
    throw new Error('SecurityError')
  }
  const quebrado = {
    getItem: quebra,
    setItem: quebra,
    removeItem: quebra,
    key: quebra,
    get length() {
      return quebra()
    },
  }
  const abas = abasPorDados.get(dados) ?? new Set()
  abasPorDados.set(dados, abas)
  const pendentes = []
  const janela = {
    dados,
    sessao,
    pendentes,
    navigator: { language, deviceMemory, onLine },
    location: { href },
    localStorage: storageQuebrado
      ? quebrado
      : storageSobre(dados, (evento) => {
          for (const outra of abas) if (outra !== janela) outra.pendentes.push(evento)
        }),
    sessionStorage: storageQuebrado ? quebrado : storageSobre(sessao),
    matchMedia: (q) => ({ matches: q === '(pointer: coarse)' && coarse }),
    addEventListener: (ev, fn) => (ouvintes[ev] ??= []).push(fn),
    emitir(ev, evento) {
      for (const fn of ouvintes[ev] ?? []) fn(evento)
    },
    /** Entrega os eventos `storage` que as outras abas geraram. Devolve quantos. */
    entregarStorage() {
      const lote = pendentes.splice(0)
      for (const evento of lote) janela.emitir('storage', evento)
      return lote.length
    },
  }
  abas.add(janela)
  return janela
}
