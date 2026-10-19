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
 * @param {{ manager?: object, teto?: number, estrita?: boolean, relogio?: { setTimeout: Function, clearTimeout: Function } }} [opcoes]
 */
export function criarCarga({
  manager = null,
  teto = 30000,
  relogio = globalThis,
  estrita = false,
} = {}) {
  if (estrita) return criarCargaEstrita({ manager, teto, relogio })
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

// Somente callbacks da carga estrita entram aqui. Uma carga que termina antes da outra
// não pode recolocar, no fim da segunda, um callback já liberado da primeira.
const callbacksEstritos = new WeakMap()

function criarCargaEstrita({ manager, teto, relogio }) {
  const etapas = new Map()
  const ouvintes = new Set()
  let itensFeitos = 0
  let itensTotal = 0
  let visto = 0
  let selada = false
  let fechada = false
  let sucesso = false
  let erro = null
  let resolver, rejeitar
  const pronto = new Promise((a, b) => ((resolver = a), (rejeitar = b)))
  // Observar a falha depois da montagem continua possível. Só esta reação interna é
  // consumida: quem aguarda a promessa original ainda recebe a rejeição.
  pronto.catch(() => {})

  const necessarias = () => [...etapas].filter(([, e]) => !e.opcional)
  const pendentes = () =>
    necessarias()
      .filter(([, e]) => !e.feita)
      .map(([nome]) => nome)
  const progresso = () => {
    if (sucesso) return 1
    if (fechada) return visto
    const lista = necessarias()
    const p = lista.length
      ? calcularProgresso({
          feitas: lista.filter(([, e]) => e.feita).length,
          total: lista.length,
          itensFeitos,
          itensTotal,
        })
      : 0
    // Mesmo todas as tarefas feitas não significam pronto enquanto falta selar.
    visto = Math.max(visto, Math.min(0.99, p))
    return visto
  }
  const etapaAtual = () => pendentes()[0] ?? null
  const estado = () => ({
    progresso: progresso(),
    etapa: etapaAtual(),
    fechada,
    sucesso,
    erro,
    selada,
  })
  const avisar = () => {
    const e = estado()
    ouvintes.forEach((fn) => fn(e))
  }
  const falha = (codigo, nomes = []) => {
    const e = new Error('A carga não foi concluída.')
    e.codigo = codigo
    e.etapas = Object.freeze([...nomes])
    return Object.freeze(e)
  }

  const antes = {}
  const nossos = {}
  if (manager) {
    for (const chave of ['onStart', 'onProgress']) {
      const anterior = { fn: manager[chave], propria: Object.hasOwn(manager, chave) }
      antes[chave] = anterior
      const fn = (url, feitas, total) => {
        anterior.fn?.call(manager, url, feitas, total)
        if (fechada) return
        itensFeitos = feitas
        itensTotal = total
        avisar()
      }
      callbacksEstritos.set(fn, { anterior, ativa: () => !fechada })
      nossos[chave] = fn
      manager[chave] = fn
    }
  }
  const devolver = () => {
    if (!manager) return
    for (const chave of ['onStart', 'onProgress']) {
      if (manager[chave] !== nossos[chave]) continue
      let anterior = antes[chave]
      let camada = callbacksEstritos.get(anterior.fn)
      while (camada && !camada.ativa()) {
        anterior = camada.anterior
        camada = callbacksEstritos.get(anterior.fn)
      }
      if (anterior.propria) manager[chave] = anterior.fn
      else delete manager[chave]
    }
  }
  const tempo = relogio.setTimeout(() => terminar(falha('tempo-esgotado', pendentes())), teto)
  function terminar(motivo = null, notificar = true) {
    if (fechada) return
    progresso()
    fechada = true
    erro = motivo
    sucesso = !motivo
    relogio.clearTimeout(tempo)
    devolver()
    if (motivo) rejeitar(motivo)
    else resolver()
    if (notificar) avisar()
    ouvintes.clear()
  }
  const conferirFim = () => {
    if (!fechada && selada && !pendentes().length) terminar()
  }
  const recusar = (codigo, nomes) => {
    const motivo = falha(codigo, nomes)
    terminar(motivo)
    throw motivo
  }

  return {
    pronto,
    etapa(nome, promessa, { opcional = false } = {}) {
      // O chamador pode já ter iniciado uma tarefa ao passar a promessa. Consumir a
      // rejeição dela também quando o registro é inválido evita erro solto no unmount.
      const tarefa = Promise.resolve(promessa)
      tarefa.catch(() => {})
      if (selada || fechada) recusar('registro-fechado', [])
      // Rótulos lógicos, nunca URL, caminho, mensagem de rede ou credencial do asset.
      if (typeof nome !== 'string' || !/^[a-z][a-z0-9_-]{0,31}$/i.test(nome))
        recusar('etapa-invalida', [])
      if (etapas.has(nome)) recusar('etapa-duplicada', [nome])
      const etapa = { opcional: opcional === true, feita: false }
      etapas.set(nome, etapa)
      avisar()
      tarefa.then(
        () => {
          if (fechada || etapa.opcional) return
          etapa.feita = true
          avisar()
          conferirFim()
        },
        () => {
          if (!fechada && !etapa.opcional) terminar(falha('etapa-falhou', [nome]))
        },
      )
    },
    /** Encerra o registro. Nenhuma tarefa, inclusive opcional, pode entrar depois. */
    selar() {
      if (fechada || selada) return
      selada = true
      avisar()
      conferirFim()
    },
    progresso,
    etapaAtual,
    fechada: () => fechada,
    sucesso: () => sucesso,
    erro: () => erro,
    aoMudar(cb) {
      if (!fechada) ouvintes.add(cb)
      cb(estado())
      return () => ouvintes.delete(cb)
    },
    liberar() {
      terminar(falha('cancelada', pendentes()), false)
      ouvintes.clear()
    },
  }
}
