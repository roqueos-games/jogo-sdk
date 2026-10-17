// A carga do jogo, para a tela de entrada (fundador, 16/10/2026, na Sinuca: "um belo de um preloader"). O
// progresso é medido, não inventado: cada etapa é uma promessa de verdade (o salão, o bar vivo do
// ultra) e, dentro dela, os arquivos que o three baixa contam pelo LoadingManager dele.
//
// O número só sobe (um arquivo novo na fila não faz a barra voltar) e a carga fecha quando todas
// as etapas acabam, deram certo ou não: o que falhar deixa o desenho de antes no lugar, e a tela
// de entrada não pode ficar presa. O `teto` fecha de qualquer jeito.

/**
 * Etapas pesam igual; os arquivos do three preenchem o pedaço da etapa que falta, sem nunca
 * fechar sozinhos (quem fecha é a etapa).
 */
export function calcularProgresso({ feitas = 0, total = 0, itensFeitos = 0, itensTotal = 0 }) {
  if (!total) return 1
  const itens = itensTotal > 0 ? Math.min(0.95, itensFeitos / itensTotal) : 0
  return Math.max(0, Math.min(1, (feitas + itens * (total - feitas)) / total))
}

/**
 * @param {{ manager?: object, teto?: number, relogio?: { setTimeout: Function, clearTimeout: Function } }} [opcoes]
 */
export function criarCarga({ manager = null, teto = 30000, relogio = globalThis } = {}) {
  const etapas = new Map()
  const ouvintes = new Set()
  let itensFeitos = 0
  let itensTotal = 0
  let visto = 0
  let fechada = false
  let resolver
  const pronto = new Promise((r) => (resolver = r))

  const estado = () => ({
    progresso: progresso(),
    etapa: etapaAtual(),
    fechada,
  })
  const avisar = () => {
    const e = estado()
    ouvintes.forEach((f) => f(e))
  }
  function progresso() {
    if (fechada) return 1
    const lista = [...etapas.values()]
    const p = calcularProgresso({
      feitas: lista.filter(Boolean).length,
      total: lista.length,
      itensFeitos,
      itensTotal,
    })
    visto = Math.max(visto, lista.length ? p : 0)
    return visto
  }
  function etapaAtual() {
    for (const [nome, feita] of etapas) if (!feita) return nome
    return null
  }

  // o LoadingManager é de todo o three da página: encadeia no que já estava lá e devolve no fim
  const antes = manager ? { onStart: manager.onStart, onProgress: manager.onProgress } : null
  if (manager) {
    manager.onStart = (url, feitos, total) => {
      antes.onStart?.(url, feitos, total)
      itensFeitos = feitos
      itensTotal = total
      avisar()
    }
    manager.onProgress = (url, feitos, total) => {
      antes.onProgress?.(url, feitos, total)
      itensFeitos = feitos
      itensTotal = total
      avisar()
    }
  }
  const devolver = () => {
    if (!manager || !antes) return
    manager.onStart = antes.onStart
    manager.onProgress = antes.onProgress
  }

  const tempo = relogio.setTimeout(() => fechar(), teto)
  function fechar() {
    if (fechada) return
    fechada = true
    visto = 1
    relogio.clearTimeout(tempo)
    devolver()
    avisar()
    resolver()
  }

  return {
    pronto,
    /** Uma etapa da carga: `promessa` resolvendo ou falhando, a etapa acabou. */
    etapa(nome, promessa) {
      if (fechada) return
      etapas.set(nome, false)
      avisar()
      Promise.resolve(promessa)
        .catch(() => null)
        .then(() => {
          etapas.set(nome, true)
          avisar()
          if ([...etapas.values()].every(Boolean)) fechar()
        })
    },
    progresso,
    etapaAtual,
    fechada: () => fechada,
    /** `cb({ progresso, etapa, fechada })` a cada mudança; devolve o desligar. */
    aoMudar(cb) {
      ouvintes.add(cb)
      cb(estado())
      return () => ouvintes.delete(cb)
    },
    liberar() {
      ouvintes.clear()
      relogio.clearTimeout(tempo)
      devolver()
    },
  }
}
