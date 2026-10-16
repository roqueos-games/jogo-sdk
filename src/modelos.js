// O kit de modelos: o mesmo jeito de carregar modelo 3D de mercado, de acender a cena e
// de escolher o perfil em todos os jogos da roqueos-games (desde 0.4.0, Goal 80).
//
// O SDK não importa o three.js: cada jogo fixa a própria versão, e duas cópias do three na
// mesma página quebram o `instanceof`. Quem chama entrega os módulos (`THREE`, `GLTFLoader`,
// `MeshoptDecoder`) e o kit só os combina. Por isso nada aqui puxa `three` no import.

/**
 * Os dois perfis. O baixo é o celular e a TV: 30 MB de teto de download (o `jogo check`
 * soma), sem sombra suave, pixelRatio até 1,5. O alto é o desktop: 120 MB, sombra suave,
 * pixelRatio até 2. Os números de pixelRatio e de sombra vêm do que o Call of Roque e a
 * Agentolandia mediram; o teto de download é a decisão do fundador de 16/10/2026.
 */
export const PERFIS = Object.freeze({
  baixo: Object.freeze({
    nome: 'baixo',
    pixelRatioMax: 1.5,
    sombra: 'basica',
    mapaDeSombra: 1024,
    tetoMB: 30,
  }),
  alto: Object.freeze({
    nome: 'alto',
    pixelRatioMax: 2,
    sombra: 'suave',
    mapaDeSombra: 2048,
    tetoMB: 120,
  }),
})

/**
 * O perfil sai do host: `desempenho.modoLeve()` já é o jeito do RoqueOS dizer que o
 * aparelho pede o leve (celular, TV, bateria). O jogo não adivinha pelo user agent.
 * `?perfil=baixo|alto` na URL força um dos dois, para o `jogo olho` fotografar os dois
 * no mesmo desktop.
 */
export function perfilDoJogo(host, { busca = globalThis.location?.search ?? '' } = {}) {
  const forcado = new URLSearchParams(busca).get('perfil')
  if (forcado === 'baixo' || forcado === 'alto') return PERFIS[forcado]
  const leve = typeof host?.desempenho?.modoLeve === 'function' ? host.desempenho.modoLeve() : false
  return leve ? PERFIS.baixo : PERFIS.alto
}

/**
 * Acerta o renderizador para PBR de mercado: cor em sRGB, tom ACES (o mesmo nos jogos,
 * para um modelo da Poly Haven não ficar lavado num jogo e estourado no outro), sombra
 * pelo perfil e pixelRatio com teto. Devolve o renderizador para encadear.
 */
export function prepararRenderizador({ THREE, renderer, perfil = PERFIS.alto, exposicao = 1 }) {
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = exposicao
  const dpr = globalThis.devicePixelRatio ?? 1
  renderer.setPixelRatio(Math.min(dpr, perfil.pixelRatioMax))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = perfil.sombra === 'suave' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap
  return renderer
}

/**
 * Luz de ambiente por imagem. Com `textura` (um HDR já carregado pelo jogo, de preferência
 * da Poly Haven), ela vira o ambiente e, se `fundo`, o céu. Sem textura, usa o
 * `RoomEnvironment` que o jogo entregar: reflexo neutro de estúdio, que já tira o metal do
 * preto chapado. Devolve a textura PMREM, que o jogo descarta no `destroy`.
 */
export function acenderAmbiente({
  THREE,
  renderer,
  scene,
  textura,
  RoomEnvironment,
  fundo = false,
  intensidade = 1,
}) {
  const pmrem = new THREE.PMREMGenerator(renderer)
  let alvo
  if (textura) {
    textura.mapping = THREE.EquirectangularReflectionMapping
    alvo = pmrem.fromEquirectangular(textura)
  } else if (RoomEnvironment) {
    alvo = pmrem.fromScene(new RoomEnvironment(), 0.04)
  } else {
    pmrem.dispose()
    throw new Error('acenderAmbiente: entregue um HDR em `textura` ou o `RoomEnvironment` do three')
  }
  pmrem.dispose()
  scene.environment = alvo.texture
  if ('environmentIntensity' in scene) scene.environmentIntensity = intensidade
  if (fundo) scene.background = textura ? textura : alvo.texture
  return alvo.texture
}

/**
 * Qual arquivo o perfil pede. `{ baixo, alto }` escolhe pelo perfil; texto é o mesmo nos
 * dois. O que só o desktop carrega mora numa pasta `alto/` (é ela que o `jogo check`
 * deixa fora da soma dos 30 MB), então o caminho de alto sem `alto/` é erro de quem chama.
 */
export function caminhoDoPerfil(fonte, perfil) {
  if (typeof fonte === 'string') return fonte
  const caminho = fonte?.[perfil.nome] ?? fonte?.baixo
  if (!caminho) throw new Error('caminhoDoPerfil: fonte sem caminho para o perfil')
  if (perfil.nome === 'alto' && fonte.alto && !fonte.alto.split('/').includes('alto')) {
    throw new Error(
      `caminhoDoPerfil: "${fonte.alto}" é só do desktop e precisa morar numa pasta alto/`,
    )
  }
  return caminho
}

/**
 * O carregador de modelos. Um arquivo é baixado uma vez e cada pedido recebe um clone
 * (`SkeletonUtils.clone` quando o modelo tem esqueleto e o jogo entregou o módulo, para o
 * personagem animado não dividir os ossos com o vizinho). O progresso conta arquivos, não
 * bytes, porque é o que o jogo mostra na tela de carga sem mentir.
 */
export function criarCarregador({
  GLTFLoader,
  MeshoptDecoder,
  SkeletonUtils,
  base = '',
  perfil = PERFIS.alto,
  aoProgresso,
  manager,
} = {}) {
  if (!GLTFLoader) throw new Error('criarCarregador: entregue o GLTFLoader do three')
  const loader = new GLTFLoader(manager)
  if (MeshoptDecoder) loader.setMeshoptDecoder(MeshoptDecoder)
  const cache = new Map()
  let pedidos = 0
  let prontos = 0
  const avisar = () => aoProgresso?.({ prontos, pedidos })

  function baixar(caminho) {
    if (!cache.has(caminho)) {
      pedidos++
      avisar()
      const url = base ? `${base.replace(/\/$/, '')}/${caminho.replace(/^\//, '')}` : caminho
      const promessa = loader.loadAsync(url).then(
        (gltf) => {
          prontos++
          avisar()
          return gltf
        },
        (erro) => {
          cache.delete(caminho)
          throw new Error(`não carregou ${url}: ${erro?.message ?? erro}`)
        },
      )
      cache.set(caminho, promessa)
    }
    return cache.get(caminho)
  }

  const temEsqueleto = (obj) => {
    let achou = false
    obj.traverse?.((o) => {
      if (o.isSkinnedMesh) achou = true
    })
    return achou
  }

  return {
    /** O modelo pronto para pôr na cena: `{ cena, animacoes }`. */
    async modelo(fonte, { sombra = true } = {}) {
      const gltf = await baixar(caminhoDoPerfil(fonte, perfil))
      const cena =
        SkeletonUtils && temEsqueleto(gltf.scene)
          ? SkeletonUtils.clone(gltf.scene)
          : gltf.scene.clone(true)
      if (sombra) {
        cena.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = true
            o.receiveShadow = true
          }
        })
      }
      return { cena, animacoes: gltf.animations ?? [] }
    },
    /** Baixa antes de precisar, para a tela de carga cobrir tudo de uma vez. */
    preparar(fontes) {
      return Promise.all(fontes.map((f) => baixar(caminhoDoPerfil(f, perfil))))
    },
    get progresso() {
      return { prontos, pedidos }
    },
    /** Esquece o cache. A GPU o jogo libera no destroy, com `liberar`. */
    esquecer() {
      cache.clear()
    },
  }
}

/** Libera geometria, material e textura de uma árvore. Jogo que monta e desmonta no RoqueOS vaza sem isso. */
export function liberar(raiz) {
  const texturas = new Set()
  raiz?.traverse?.((o) => {
    o.geometry?.dispose?.()
    const materiais = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []
    for (const m of materiais) {
      for (const v of Object.values(m)) if (v?.isTexture) texturas.add(v)
      m.dispose?.()
    }
  })
  for (const t of texturas) t.dispose?.()
}
