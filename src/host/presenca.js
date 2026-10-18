// A PRESENÇA DOS HOSTS DE TESTE E DE DESENVOLVIMENTO (0.7.0).
//
// No RoqueOS quem leva a presença é o host, por um WebSocket do servidor do jogo (o runa-mundo
// da RagnaRoque). Aqui ela mora em memória (host falso) ou entre abas do mesmo navegador pelo
// BroadcastChannel (host de desenvolvimento), com as MESMAS regras que o host do RoqueOS
// aplica antes da rede: mapa é texto curto, pose são números, o jogo não manda mais que 10
// poses por segundo (o excesso é descartado aqui), e o `observar` nunca entrega dentro da
// própria chamada.

/** O teto de poses por segundo que o host deixa sair. */
export const POSES_POR_SEGUNDO = 10

const MAPA = /^[a-z0-9-]{1,32}$/
const PALAVRA = /^[a-z0-9_-]{1,32}$/
const COR = /^#[0-9a-f]{6}$/i

/** O mapa que o jogo pediu, ou TypeError: erro de quem porta, que aparece no teste. */
export function conferirMapa(mapa) {
  if (typeof mapa !== 'string' || !MAPA.test(mapa)) {
    throw new TypeError(`presenca: mapa "${String(mapa)}" fora do formato (a-z, 0-9 e hífen)`)
  }
  return mapa
}

/** A pose do contrato: { x, y, f, m }. TypeError no que não for número. */
export function conferirPose(p) {
  if (!p || typeof p !== 'object' || ![p.x, p.y].every(Number.isFinite)) {
    throw new TypeError('presenca: pose precisa de { x, y } numéricos')
  }
  const f = Number.isFinite(p.f) ? p.f : 0
  return { x: +p.x.toFixed(2), y: +p.y.toFixed(2), f: +f.toFixed(2), m: p.m === true }
}

/** A aparência que os outros desenham: classe, modelo e cor. Nada do save. */
export function conferirAparencia(a) {
  const o = a && typeof a === 'object' ? a : {}
  return {
    cls: typeof o.cls === 'string' && PALAVRA.test(o.cls) ? o.cls : 'aprendiz',
    modelo: typeof o.modelo === 'string' && PALAVRA.test(o.modelo) ? o.modelo : null,
    cor: typeof o.cor === 'string' && COR.test(o.cor) ? o.cor : null,
  }
}

const proximo = (fn) => Promise.resolve().then(fn)

/**
 * A capacidade `presenca` sobre um transporte simples.
 *
 * @param {{
 *   eu: () => { id: string, nome: string, conta: boolean },
 *   enviar: (mensagem: object) => void,
 *   agora?: () => number,
 * }} p  `enviar` leva { t: 'entrou' | 'pose' | 'mapa' | 'saiu', ... } aos outros.
 * @returns {{ capacidade: object, receber: (mensagem: object) => void, definirConexao: (v: boolean) => void }}
 */
export function criarPresenca({ eu, enviar, agora = () => Date.now() }) {
  const outros = new Map()
  const ouvintes = new Set()
  const ouvintesDaConexao = new Set()
  let conectado = true
  let dentro = null
  let janela = 0
  let contagem = 0

  const lista = () =>
    dentro
      ? [...outros.values()]
          .filter((o) => o.mapa === dentro.mapa)
          .map(({ id, nome, aparencia, pose, conta }) => ({ id, nome, aparencia, pose, conta }))
      : []
  const avisar = () => {
    const l = lista()
    for (const fn of ouvintes) fn(l)
  }

  const capacidade = {
    async entrar({ mapa, pose, aparencia } = {}) {
      conferirMapa(mapa)
      const p = conferirPose(pose)
      if (!conectado) return { erro: 'indisponivel' }
      const quem = eu()
      dentro = { mapa, pose: p, aparencia: conferirAparencia(aparencia) }
      enviar({ t: 'entrou', id: quem.id, nome: quem.nome, conta: quem.conta, ...dentro })
      proximo(avisar)
      return { eu: quem.id, instancia: `${mapa}#1` }
    },
    pose(pose) {
      if (!dentro) return false
      const p = conferirPose(pose)
      const t = agora()
      if (t - janela >= 1000) {
        janela = t
        contagem = 0
      }
      if (++contagem > POSES_POR_SEGUNDO) return false
      dentro.pose = p
      enviar({ t: 'pose', id: eu().id, pose: p })
      return true
    },
    observar(fn) {
      ouvintes.add(fn)
      proximo(() => ouvintes.has(fn) && fn(lista()))
      return () => ouvintes.delete(fn)
    },
    async trocarDeMapa(mapa, pose) {
      conferirMapa(mapa)
      if (!dentro) return false
      dentro.mapa = mapa
      if (pose) dentro.pose = conferirPose(pose)
      enviar({ t: 'mapa', id: eu().id, mapa, pose: dentro.pose })
      proximo(avisar)
      return true
    },
    sair() {
      if (!dentro) return
      dentro = null
      enviar({ t: 'saiu', id: eu().id })
      proximo(avisar)
    },
    conectado(fn) {
      ouvintesDaConexao.add(fn)
      proximo(() => ouvintesDaConexao.has(fn) && fn(conectado))
      return () => ouvintesDaConexao.delete(fn)
    },
  }

  /** O que chega dos outros (outra aba, ou o teste pelo `disparar`). */
  function receber(m) {
    if (!m || typeof m !== 'object' || typeof m.id !== 'string' || m.id === eu().id) return
    if (m.t === 'entrou') {
      outros.set(m.id, {
        id: m.id,
        nome: String(m.nome ?? ''),
        conta: m.conta === true,
        mapa: m.mapa,
        aparencia: conferirAparencia(m.aparencia),
        pose: conferirPose(m.pose),
      })
      // quem estava aqui responde para quem chegou se ver
      if (dentro && m.mapa === dentro.mapa && !m.resposta) {
        const quem = eu()
        enviar({
          t: 'entrou',
          id: quem.id,
          nome: quem.nome,
          conta: quem.conta,
          resposta: true,
          ...dentro,
        })
      }
    } else if (m.t === 'pose' && outros.has(m.id)) outros.get(m.id).pose = conferirPose(m.pose)
    else if (m.t === 'mapa' && outros.has(m.id))
      Object.assign(outros.get(m.id), { mapa: m.mapa, pose: conferirPose(m.pose) })
    else if (m.t === 'saiu') outros.delete(m.id)
    else return
    avisar()
  }

  function definirConexao(v) {
    conectado = Boolean(v)
    if (!conectado) outros.clear()
    for (const fn of ouvintesDaConexao) fn(conectado)
    avisar()
  }

  return { capacidade, receber, definirConexao }
}
