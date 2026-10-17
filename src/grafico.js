// O gráfico dos jogos, igual em todos (pedido do fundador de 16/10/2026, 21h02: "pré-definições
// gráficas, sombras, HBAO, FOV, borrão de movimento e etc. no gráfico ultra, já deixe isso como
// padrão para todos os nossos jogos"). Quatro qualidades, cada efeito ligável à parte, a escolha
// do jogador guardada no armazenamento do host, e a cadeia de pós-processamento montada sobre o
// EffectComposer do three que o jogo entregar. É o mesmo desenho do Call of Roque (settings.ts e
// render/pipeline.ts), em WebGL e sem TypeScript, para o three 0.171 dos jogos.
//
// O SDK não importa o three: o jogo entrega os módulos (`modulos`) da versão dele.

/** As qualidades, da mais leve à mais pesada. */
export const QUALIDADES = Object.freeze(['baixo', 'medio', 'alto', 'ultra'])

/**
 * O que cada qualidade liga. `dpr` é o teto do pixel ratio; `sombra` o lado do mapa de sombra
 * (0 desliga); os efeitos são o ponto de partida, que o jogador muda um a um.
 */
export const PRESETS = Object.freeze({
  baixo: Object.freeze({
    dpr: 1,
    sombra: 0,
    anisotropia: 2,
    ao: false,
    bloom: false,
    borrao: false,
    aa: true,
    vinheta: false,
  }),
  medio: Object.freeze({
    dpr: 1.5,
    sombra: 1024,
    anisotropia: 4,
    ao: false,
    bloom: true,
    borrao: false,
    aa: true,
    vinheta: true,
  }),
  alto: Object.freeze({
    dpr: 2,
    sombra: 2048,
    anisotropia: 8,
    ao: true,
    bloom: true,
    borrao: false,
    aa: true,
    vinheta: true,
  }),
  ultra: Object.freeze({
    dpr: 2,
    sombra: 4096,
    anisotropia: 16,
    ao: true,
    bloom: true,
    borrao: true,
    aa: true,
    vinheta: true,
  }),
})

/** Os efeitos que o jogador liga e desliga, na ordem do menu. */
export const EFEITOS = Object.freeze(['ao', 'bloom', 'borrao', 'aa', 'vinheta'])

/** FOV vertical, em graus: o jogo diz o dele; o jogador mexe dentro desta faixa. */
export const FOV = Object.freeze({ min: 35, max: 90 })

/**
 * A qualidade de quem nunca escolheu: Ultra no computador (o pedido do fundador), Médio na
 * tela de toque, Baixo no aparelho que o host marca como fraco.
 */
export function qualidadePadrao({ modoLeve = false, toque = false } = {}) {
  if (modoLeve) return 'baixo'
  return toque ? 'medio' : 'ultra'
}

/** Configuração inicial: a qualidade do aparelho, sem efeito mexido e o FOV do jogo. */
export function configuracaoPadrao(aparelho = {}, { fov = 50 } = {}) {
  return { qualidade: qualidadePadrao(aparelho), efeitos: {}, fov }
}

const CHAVE = 'grafico'

/** Lê a escolha guardada (texto JSON no armazenamento do host); o que não fizer sentido volta ao padrão. */
export function carregarConfiguracao(armazenamento, padrao) {
  let salvo = null
  try {
    salvo = JSON.parse(armazenamento?.ler?.(CHAVE) ?? 'null')
  } catch {
    salvo = null
  }
  const cfg = { ...padrao, efeitos: {} }
  if (!salvo || typeof salvo !== 'object') return cfg
  if (QUALIDADES.includes(salvo.qualidade)) cfg.qualidade = salvo.qualidade
  if (Number.isFinite(salvo.fov)) cfg.fov = Math.min(FOV.max, Math.max(FOV.min, salvo.fov))
  for (const e of EFEITOS)
    if (typeof salvo.efeitos?.[e] === 'boolean') cfg.efeitos[e] = salvo.efeitos[e]
  return cfg
}

export function salvarConfiguracao(armazenamento, cfg) {
  return armazenamento?.gravar?.(
    CHAVE,
    JSON.stringify({ qualidade: cfg.qualidade, fov: cfg.fov, efeitos: cfg.efeitos }),
  )
}

/** O efeito como o jogador deixou; sem escolha, o da qualidade. */
export function efeitoLigado(cfg, nome) {
  const proprio = cfg?.efeitos?.[nome]
  return typeof proprio === 'boolean'
    ? proprio
    : Boolean(PRESETS[cfg?.qualidade ?? 'medio']?.[nome])
}

/** Trocar a qualidade recomeça os efeitos da tabela dela (o jogador mexe de novo, se quiser). */
export function trocarQualidade(cfg, qualidade) {
  if (!QUALIDADES.includes(qualidade)) return cfg
  return { ...cfg, qualidade, efeitos: {} }
}

/**
 * Borrão de movimento da câmera (Goal 34 do Call of Roque, em WebGL): reprojeta cada pixel com a
 * vista do quadro anterior a partir da profundidade e espalha a cor ao longo do caminho. Só a
 * câmera: o que se move sozinho na cena não borra. Corte de câmera (salto acima de CORTE metros)
 * não borra naquele quadro.
 */
export const BORRAO = Object.freeze({ amostras: 10, obturador: 0.35, maximo: 0.03, corte: 1.5 })

export const SHADER_DO_BORRAO = Object.freeze({
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    inversaAtual: { value: null },
    vistaAnterior: { value: null },
    obturador: { value: BORRAO.obturador },
    maximo: { value: BORRAO.maximo },
    ligado: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform mat4 inversaAtual;
    uniform mat4 vistaAnterior;
    uniform float obturador;
    uniform float maximo;
    uniform float ligado;
    varying vec2 vUv;
    float ruido(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
    void main() {
      vec4 cor = texture2D(tDiffuse, vUv);
      float z = texture2D(tDepth, vUv).x;
      if (ligado < 0.5 || z >= 1.0) { gl_FragColor = cor; return; }
      vec4 ndc = vec4(vUv * 2.0 - 1.0, z * 2.0 - 1.0, 1.0);
      vec4 mundo = inversaAtual * ndc;
      mundo /= mundo.w;
      vec4 antes = vistaAnterior * mundo;
      vec2 uvAntes = (antes.xy / antes.w) * 0.5 + 0.5;
      vec2 vel = (vUv - uvAntes) * obturador;
      float tam = length(vel);
      if (tam > maximo) vel *= maximo / tam;
      if (tam < 0.0005) { gl_FragColor = cor; return; }
      vec4 soma = cor;
      float j = ruido(gl_FragCoord.xy);
      for (int i = 1; i < ${BORRAO.amostras}; i++) {
        float t = (float(i) + j) / float(${BORRAO.amostras}) - 0.5;
        soma += texture2D(tDiffuse, clamp(vUv + vel * t, 0.0, 1.0));
      }
      gl_FragColor = soma / float(${BORRAO.amostras});
    }
  `,
})

/** Vinheta leve, a mesma em todos os jogos. */
export const SHADER_DA_VINHETA = Object.freeze({
  uniforms: { tDiffuse: { value: null }, forca: { value: 0.28 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float forca;
    varying vec2 vUv;
    void main() {
      vec4 cor = texture2D(tDiffuse, vUv);
      vec2 d = vUv - 0.5;
      cor.rgb *= 1.0 - forca * smoothstep(0.25, 0.85, dot(d, d) * 2.2);
      gl_FragColor = cor;
    }
  `,
})

/**
 * Aplica no renderizador o que não é pós-processamento: pixel ratio e sombra. `dprDoAparelho`
 * é o devicePixelRatio; a sombra de cada luz o jogo ajusta com `ladoDaSombra`.
 */
export function aplicarNoRenderizador(
  renderer,
  cfg,
  { dprDoAparelho = globalThis.devicePixelRatio ?? 1 } = {},
) {
  const p = PRESETS[cfg.qualidade] ?? PRESETS.medio
  renderer.setPixelRatio?.(Math.min(dprDoAparelho, p.dpr))
  if (renderer.shadowMap) renderer.shadowMap.enabled = p.sombra > 0
  return p
}

export const ladoDaSombra = (cfg) => (PRESETS[cfg.qualidade] ?? PRESETS.medio).sombra

/**
 * A cadeia do quadro: cena (com profundidade guardada) → oclusão de ambiente (GTAO) → borrão de
 * movimento → bloom → saída (tom e sRGB) → antisserrilhado (FXAA) → vinheta. Cada passe existe
 * sempre e liga ou desliga sem recompilar (`enabled`), para trocar no menu sem travar o jogo.
 *
 * `modulos`: { EffectComposer, RenderPass, GTAOPass, UnrealBloomPass, OutputPass, ShaderPass,
 *              FXAAShader } do three do jogo. `bloom`: { forca, raio, limiar }.
 */
export function criarPosProcesso({ THREE, renderer, scene, camera, modulos, cfg, bloom = {} }) {
  const {
    EffectComposer,
    RenderPass,
    GTAOPass,
    UnrealBloomPass,
    OutputPass,
    ShaderPass,
    FXAAShader,
  } = modulos
  const tamanho = renderer.getSize(new THREE.Vector2())
  const alvo = new THREE.WebGLRenderTarget(tamanho.x, tamanho.y, { type: THREE.HalfFloatType })
  alvo.depthTexture = new THREE.DepthTexture(tamanho.x, tamanho.y)
  const composer = new EffectComposer(renderer, alvo)

  const cena = new RenderPass(scene, camera)
  const ao = new GTAOPass(scene, camera, tamanho.x, tamanho.y)
  ao.output = GTAOPass.OUTPUT?.Default ?? 0
  const borrao = new ShaderPass(SHADER_DO_BORRAO)
  const brilho = new UnrealBloomPass(
    new THREE.Vector2(tamanho.x, tamanho.y),
    bloom.forca ?? 0.35,
    bloom.raio ?? 0.4,
    bloom.limiar ?? 0.9,
  )
  const saida = new OutputPass()
  const aa = new ShaderPass(FXAAShader)
  const vinheta = new ShaderPass(SHADER_DA_VINHETA)
  for (const p of [cena, ao, borrao, brilho, saida, aa, vinheta]) composer.addPass(p)

  // a profundidade da cena: o RenderPass desenha no alvo de leitura do quadro, e o alvo que o
  // composer recebeu e o clone dele carregam cada um a sua; o borrão lê a do alvo da vez
  const anterior = new THREE.Matrix4()
  const atual = new THREE.Matrix4()
  const ultimaPosicao = new THREE.Vector3()
  let primeiro = true
  let estado = cfg

  function aplicar(novo) {
    estado = novo
    ao.enabled = efeitoLigado(novo, 'ao')
    brilho.enabled = efeitoLigado(novo, 'bloom')
    borrao.enabled = efeitoLigado(novo, 'borrao')
    aa.enabled = efeitoLigado(novo, 'aa')
    vinheta.enabled = efeitoLigado(novo, 'vinheta')
    aplicarNoRenderizador(renderer, novo)
    redimensionar(tamanho.x, tamanho.y)
  }

  function redimensionar(w, h) {
    tamanho.set(w, h)
    const pr = renderer.getPixelRatio()
    composer.setPixelRatio?.(pr)
    composer.setSize(w, h)
    ao.setSize?.(w * pr, h * pr)
    brilho.setSize?.(w * pr, h * pr)
    aa.material.uniforms.resolution?.value.set(1 / (w * pr), 1 / (h * pr))
  }

  function render(dt) {
    camera.updateMatrixWorld()
    atual.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    const cortou = primeiro || camera.position.distanceTo(ultimaPosicao) > BORRAO.corte
    if (borrao.enabled) {
      borrao.uniforms.inversaAtual.value = atual.clone().invert()
      borrao.uniforms.vistaAnterior.value = cortou ? atual.clone() : anterior.clone()
      borrao.uniforms.tDepth.value = composer.readBuffer.depthTexture ?? alvo.depthTexture
      borrao.uniforms.ligado.value = cortou ? 0 : 1
    }
    composer.render(dt)
    anterior.copy(atual)
    ultimaPosicao.copy(camera.position)
    primeiro = false
  }

  aplicar(cfg)
  return {
    composer,
    passes: { cena, ao, borrao, brilho, saida, aa, vinheta },
    aplicar,
    render,
    redimensionar,
    get cfg() {
      return estado
    },
    dispose() {
      composer.dispose?.()
      ao.dispose?.()
      brilho.dispose?.()
      alvo.dispose()
    },
  }
}
