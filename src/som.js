// O som dos jogos (17/10/2026, a régua da Sinuca): gravações de verdade num pacote cifrado
// (`./pacote`), no espaço (HRTF, o ouvinte na câmera), prontas antes do primeiro toque, com a
// síntese só de reserva. Nasceu na Sinuca 0.2.8 e veio para o SDK para os outros jogos chegarem
// no mesmo nível sem copiar 300 linhas cada.
//
// O jogo dá o vocabulário dele (`tocar('peca-3.wav', { pos })`, `variacao('peca', 6)`); o SDK cuida
// do AudioContext do host, do pacote, do espaço, dos laços de ambiente e dos volumes do painel.
//
// O AudioContext é do host e só se toca com ele rodando: tocar num contexto suspenso enfileira
// som que sai tudo junto depois.

/** O espaço do som, em unidades da cena do jogo (metros, ou o que a cena usar). */
export const ESPACO_PADRAO = Object.freeze({
  refDistance: 1.2,
  rolloffFactor: 1.1,
  maxDistance: 40,
})

/** Tira os nós do grafo de áudio (o que já saiu não faz mal tirar de novo). */
export function soltar(...nos) {
  for (const no of nos) {
    try {
      no?.disconnect?.()
    } catch {
      /* já desligado */
    }
  }
}

/** Um PannerNode HRTF na posição; sem `pos` ou sem suporte (navegador velho, teste), null. */
export function criarPanner(c, pos, espaco = ESPACO_PADRAO) {
  if (!pos || !c?.createPanner) return null
  const p = c.createPanner()
  p.panningModel = 'HRTF'
  p.distanceModel = 'inverse'
  p.refDistance = espaco.refDistance
  p.rolloffFactor = espaco.rolloffFactor
  p.maxDistance = espaco.maxDistance
  if (p.positionX) {
    p.positionX.value = pos.x
    p.positionY.value = pos.y ?? 0
    p.positionZ.value = pos.z
  } else p.setPosition?.(pos.x, pos.y ?? 0, pos.z)
  return p
}

/**
 * @param {{ contexto: () => AudioContext | null }} audio a capacidade `audio` do host
 * @param {{
 *   pacote?: () => Promise<Map<string, ArrayBuffer>>,
 *   espaco?: { refDistance: number, rolloffFactor: number, maxDistance: number },
 *   sorteio?: () => number,
 *   base?: number,
 * }} [opcoes] `pacote` abre o .pak de sons do jogo; `espaco` na unidade da cena; `base` é o
 *   volume do desenho do jogo (0,4 de padrão), sobre o qual o painel manda.
 */
export function criarAudio(
  audio,
  { pacote, espaco = ESPACO_PADRAO, sorteio = Math.random, base = 0.4 } = {},
) {
  let mestre = null
  let efeitos = null
  let ambientes = null
  let dono = null
  let nivel = 1
  let nivelEfeitos = 1
  let nivelAmbiente = 1
  let amostras = null
  let carregando = null
  let falhou = false
  /** Os laços pedidos (nome → { lugares, ganho, vivo }), que ligam quando dá. */
  const lacos = new Map()

  const contexto = () => {
    try {
      const c = audio?.contexto?.()
      if (!c || c.state !== 'running') return null
      // O ganho mestre pertence a UM contexto. Se o host trocar de contexto (o iOS fecha o
      // antigo ao voltar do fundo), recria em vez de ligar num nó morto.
      if (dono !== c) {
        mestre = c.createGain()
        mestre.gain.value = base * nivel
        mestre.connect(c.destination)
        efeitos = c.createGain()
        efeitos.gain.value = nivelEfeitos
        efeitos.connect(mestre)
        ambientes = c.createGain()
        ambientes.gain.value = nivelAmbiente
        ambientes.connect(mestre)
        dono = c
        for (const l of lacos.values()) l.vivo = null
      }
      carregar(c)
      religar()
      return c
    } catch {
      return null
    }
  }

  // O pacote baixa e abre uma vez só, sem precisar do AudioContext.
  let arquivos = null
  const baixar = () => {
    if (!pacote) return Promise.resolve(null)
    arquivos ??= Promise.resolve()
      .then(() => pacote())
      .catch(() => null)
    return arquivos
  }

  async function decodificarCom(ctx) {
    try {
      const lista = await baixar()
      if (!lista) {
        falhou = true
        return
      }
      const prontos = new Map()
      for (const [nome, dados] of lista) {
        // decodeAudioData consome o ArrayBuffer: decodifica uma cópia
        prontos.set(nome, await ctx.decodeAudioData(dados.slice(0)))
      }
      amostras ??= prontos
      if (dono) religar()
    } catch {
      falhou = true
    }
  }

  function carregar(c) {
    if (amostras || carregando || falhou || !pacote) return
    carregando = decodificarCom(c)
  }

  /** Liga os laços pedidos que ainda não estão tocando (o pacote chegou, o contexto mudou). */
  function religar() {
    if (!dono || !amostras) return
    for (const [nome, l] of lacos) if (!l.vivo) l.vivo = ligarLaco(nome, l)
  }

  function ligarLaco(nome, { lugares, ganho, fade }) {
    const c = dono
    const buffer = amostras?.get(nome)
    if (!c || !buffer) return null
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, c.currentTime)
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, ganho), c.currentTime + fade)
    g.connect(ambientes)
    const fontes = []
    const pontos = lugares?.length && c.createPanner ? lugares : [{ ganho: 1 }]
    pontos.forEach((lugar, i) => {
      const fonte = c.createBufferSource()
      fonte.buffer = buffer
      fonte.loop = true
      // o MP3 traz um atraso do codificador no começo e no fim: o laço pula os dois
      fonte.loopStart = 0.06
      fonte.loopEnd = Math.max(0.12, buffer.duration - 0.06)
      const gi = c.createGain()
      gi.gain.value = lugar.ganho ?? 1
      fonte.connect(gi)
      const panner = criarPanner(c, lugar.x === undefined ? null : lugar, espaco)
      if (panner) {
        gi.connect(panner)
        panner.connect(g)
      } else gi.connect(g)
      // cada fonte num ponto diferente do laço, para não somar o mesmo trecho
      fonte.start(c.currentTime, 0.06 + ((i * 23) % Math.max(1, buffer.duration - 1)))
      fontes.push({ fonte, gi, panner })
    })
    return { fontes, g, c }
  }

  function pararLaco(vivo, fade = 0.6) {
    if (!vivo) return
    const { fontes, g, c } = vivo
    try {
      g.gain.cancelScheduledValues(c.currentTime)
      g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), c.currentTime)
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + fade)
      for (const { fonte, gi, panner } of fontes) {
        fonte.onended = () => soltar(fonte, gi, panner)
        fonte.stop(c.currentTime + fade + 0.05)
      }
      setTimeout(() => soltar(g), (fade + 0.2) * 1000)
    } catch {
      /* o contexto já fechou */
    }
  }

  const blip = (freq, type = 'sine', peak = 0.1, dur = 0.1) => {
    const c = contexto()
    if (!c) return
    const now = c.currentTime
    const o = c.createOscillator()
    o.type = type
    o.frequency.value = freq
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, now)
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), now + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur)
    g.connect(efeitos)
    o.connect(g)
    o.onended = () => soltar(o, g)
    o.start(now)
    o.stop(now + dur + 0.02)
  }

  const ultima = {}

  return {
    /** O contexto rodando, ou null (para o jogo que precisa dele, como a música). */
    contexto,
    /**
     * Toca uma gravação do pacote (no ponto `pos` da cena, se vier). Devolve false se ainda não há
     * gravação (o jogo cai na síntese). Cada golpe sai do grafo quando acaba: o panner HRTF é o
     * mais caro dos nós e uma jogada pode ter dezenas.
     */
    tocar(nome, { ganho = 1, taxa = 1, pos } = {}) {
      const c = contexto()
      const buffer = amostras?.get(nome)
      if (!c || !buffer) return false
      const fonte = c.createBufferSource()
      fonte.buffer = buffer
      fonte.playbackRate.value = taxa
      const g = c.createGain()
      g.gain.value = ganho
      fonte.connect(g)
      const panner = criarPanner(c, pos, espaco)
      if (panner) {
        g.connect(panner)
        panner.connect(efeitos)
      } else g.connect(efeitos)
      fonte.onended = () => soltar(fonte, g, panner)
      fonte.start()
      return true
    },
    /** `prefixo-N.wav`, N de 1 a `n`, nunca o mesmo duas vezes seguidas (a repetição soa falso). */
    variacao(prefixo, n, extensao = 'wav') {
      let i = 1 + Math.min(n - 1, Math.floor(sorteio() * n))
      if (n > 1 && i === ultima[prefixo]) i = (i % n) + 1
      ultima[prefixo] = i
      return `${prefixo}-${i}.${extensao}`
    },
    /** Uma leve variação de tom (0,96 a 1,04), para o mesmo golpe não soar carimbado. */
    tom: () => 0.96 + sorteio() * 0.08,
    /** A síntese de reserva: um oscilador curto. */
    blip,
    /**
     * Um laço de ambiente (o fogo, a chuva, o bar) saindo de `lugares` ({x,y,z,ganho}); sem
     * lugares, uma cama estéreo. Liga quando o pacote e o contexto chegarem, se ainda não
     * chegaram. `ligar` falso apaga com fade.
     */
    laco(nome, ligar = true, { lugares = [], ganho = 1, fade = 1.5 } = {}) {
      const atual = lacos.get(nome)
      if (!ligar) {
        lacos.delete(nome)
        pararLaco(atual?.vivo)
        return
      }
      if (atual) return
      lacos.set(nome, { lugares, ganho, fade, vivo: null })
      if (contexto()) religar()
    },
    /** Os laços tocando agora (para o teste). */
    lacosTocando: () => [...lacos].filter(([, l]) => l.vivo).map(([n]) => n),
    /**
     * Uma voz contínua que o jogo dirige a cada quadro: o motor do carro (tom pela rotação), o
     * pneu cantando (volume pela derrapagem). A gravação toca em laço e `definir({ taxa, ganho })`
     * desliza para os valores novos (sem estalo). Liga sozinha quando o pacote e o contexto
     * chegarem; se o host trocar de contexto, religa no novo. `parar()` apaga com fade e solta os
     * nós. `ambiente: true` manda pelo volume de ambiente do painel em vez do de efeitos.
     */
    voz(nome, { ambiente = false } = {}) {
      let viva = null
      let parada = false
      const deslizar = (param, valor, t) => {
        if (!param) return
        if (param.setTargetAtTime) param.setTargetAtTime(valor, t, 0.05)
        else param.value = valor
      }
      const calar = (v, fade) => {
        try {
          const t = v.c.currentTime
          if (v.g.gain.setTargetAtTime) v.g.gain.setTargetAtTime(0, t, Math.max(0.01, fade / 3))
          else v.g.gain.value = 0
          v.fonte.onended = () => soltar(v.fonte, v.g)
          v.fonte.stop(t + fade)
        } catch {
          soltar(v.fonte, v.g)
        }
      }
      const garantir = () => {
        if (parada) return null
        const c = contexto()
        const buffer = amostras?.get(nome)
        if (!c || !buffer) return null
        if (viva && viva.c === c) return viva
        if (viva) calar(viva, 0.05)
        const fonte = c.createBufferSource()
        fonte.buffer = buffer
        fonte.loop = true
        // o laço pula o atraso do codificador nas pontas, como os laços de ambiente
        fonte.loopStart = 0.03
        fonte.loopEnd = Math.max(0.06, (buffer.duration ?? 1) - 0.03)
        const g = c.createGain()
        g.gain.value = 0
        fonte.connect(g)
        g.connect(ambiente ? ambientes : efeitos)
        fonte.start()
        viva = { fonte, g, c }
        return viva
      }
      return {
        /** Desliza o tom (`taxa`, 1 = gravado) e o volume. Devolve se a voz está tocando. */
        definir({ taxa, ganho } = {}) {
          const v = garantir()
          if (!v) return false
          const t = v.c.currentTime
          if (taxa != null) deslizar(v.fonte.playbackRate, Math.max(0.05, taxa), t)
          if (ganho != null) deslizar(v.g.gain, Math.max(0, ganho), t)
          return true
        },
        tocando: () => Boolean(viva) && !parada,
        parar(fade = 0.3) {
          parada = true
          if (viva) calar(viva, fade)
          viva = null
        },
        /** Depois de `parar`, a voz volta a ligar no próximo `definir`. */
        retomar() {
          parada = false
        },
      }
    },
    /** O ouvinte é a câmera: `{ pos, frente, cima }`, a cada quadro. */
    ouvir(o) {
      const c = dono
      const l = c?.listener
      if (!l || !o?.pos) return
      if (l.positionX) {
        const t = c.currentTime
        l.positionX.setTargetAtTime(o.pos.x, t, 0.03)
        l.positionY.setTargetAtTime(o.pos.y, t, 0.03)
        l.positionZ.setTargetAtTime(o.pos.z, t, 0.03)
        l.forwardX.setTargetAtTime(o.frente.x, t, 0.03)
        l.forwardY.setTargetAtTime(o.frente.y, t, 0.03)
        l.forwardZ.setTargetAtTime(o.frente.z, t, 0.03)
        l.upX.setTargetAtTime(o.cima.x, t, 0.03)
        l.upY.setTargetAtTime(o.cima.y, t, 0.03)
        l.upZ.setTargetAtTime(o.cima.z, t, 0.03)
      } else {
        l.setPosition?.(o.pos.x, o.pos.y, o.pos.z)
        l.setOrientation?.(o.frente.x, o.frente.y, o.frente.z, o.cima.x, o.cima.y, o.cima.z)
      }
    },
    /** As gravações já estão prontas. */
    gravacoes: () => Boolean(amostras),
    /**
     * Baixa e decodifica as gravações antes do primeiro toque (num OfflineAudioContext: o
     * AudioBuffer serve em qualquer contexto). Entra na carga da tela de entrada (`./carga`), para
     * a primeira jogada já sair gravada. Resolve true quando as gravações estão prontas.
     */
    preparar(Offline = globalThis.OfflineAudioContext ?? globalThis.webkitOfflineAudioContext) {
      if (amostras) return Promise.resolve(true)
      if (!pacote) return Promise.resolve(false)
      if (!Offline) return baixar().then(() => false)
      if (!carregando) {
        try {
          carregando = decodificarCom(new Offline(2, 44100, 44100))
        } catch {
          return baixar().then(() => false)
        }
      }
      return carregando.then(() => Boolean(amostras))
    },
    /** Espera o pacote (para o teste). */
    pronto: () => carregando ?? Promise.resolve(),
    /** Os volumes do painel (0 a 1): geral, efeitos e ambiente. */
    volumes: () => ({ geral: nivel, efeitos: nivelEfeitos, ambiente: nivelAmbiente }),
    definirVolumes({ geral, efeitos: e, ambiente: a } = {}) {
      const faixa = (v) => Math.min(1, Math.max(0, Number(v) || 0))
      if (geral != null) {
        nivel = faixa(geral)
        if (mestre) mestre.gain.value = base * nivel
      }
      if (e != null) {
        nivelEfeitos = faixa(e)
        if (efeitos) efeitos.gain.value = nivelEfeitos
      }
      if (a != null) {
        nivelAmbiente = faixa(a)
        if (ambientes) ambientes.gain.value = nivelAmbiente
      }
    },
    /** Para tudo (desmontar): laços com fade curto. */
    liberar() {
      for (const l of lacos.values()) pararLaco(l.vivo, 0.1)
      lacos.clear()
    },
  }
}
