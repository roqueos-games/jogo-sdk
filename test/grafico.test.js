// O gráfico comum dos jogos (16/10/2026): qualidades, efeitos à parte, escolha guardada e a cadeia
// de pós-processamento ligando e desligando cada passe. Three de verdade, passes de mentira (o
// EffectComposer precisa de WebGL).
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import {
  QUALIDADES,
  PRESETS,
  EFEITOS,
  FOV,
  DESFOQUE,
  FOCO,
  escalaDoDesfoque,
  BORRAO,
  SHADER_DO_BORRAO,
  qualidadePadrao,
  configuracaoPadrao,
  carregarConfiguracao,
  salvarConfiguracao,
  efeitoLigado,
  trocarQualidade,
  aplicarNoRenderizador,
  criarPosProcesso,
} from '../src/grafico.js'
import { TEXTOS_DO_PAINEL } from '../src/painel.js'
import { IDIOMAS } from '../src/idiomas.js'

const memoria = () => {
  const d = new Map()
  return { ler: (k) => d.get(k) ?? null, gravar: (k, v) => d.set(k, v), dados: d }
}

describe('qualidades', () => {
  test('Ultra no computador, Médio no toque, Baixo no aparelho fraco', () => {
    assert.equal(qualidadePadrao({}), 'ultra')
    assert.equal(qualidadePadrao({ toque: true }), 'medio')
    assert.equal(qualidadePadrao({ modoLeve: true, toque: false }), 'baixo')
  })

  test('o Ultra liga tudo: sombra 4096, AO, bloom, borrão, AA e vinheta', () => {
    const u = PRESETS.ultra
    assert.equal(u.sombra, 4096)
    for (const e of EFEITOS) assert.equal(u[e], true, e)
  })

  test('cada qualidade pesa mais que a anterior (sombra e pixel ratio)', () => {
    for (let i = 1; i < QUALIDADES.length; i++) {
      const a = PRESETS[QUALIDADES[i - 1]]
      const b = PRESETS[QUALIDADES[i]]
      assert.ok(b.sombra >= a.sombra && b.dpr >= a.dpr, QUALIDADES[i])
    }
  })

  test('o efeito do jogador vence a tabela, nos dois sentidos; trocar a qualidade zera', () => {
    let cfg = { qualidade: 'baixo', efeitos: { ao: true } }
    assert.equal(efeitoLigado(cfg, 'ao'), true)
    cfg = { qualidade: 'ultra', efeitos: { borrao: false } }
    assert.equal(efeitoLigado(cfg, 'borrao'), false)
    assert.equal(efeitoLigado(trocarQualidade(cfg, 'ultra'), 'borrao'), true)
    assert.equal(trocarQualidade(cfg, 'nada'), cfg)
  })
})

describe('escolha guardada', () => {
  test('volta como foi gravada; o que não faz sentido cai no padrão', () => {
    const a = memoria()
    const padrao = configuracaoPadrao({}, { fov: 50 })
    salvarConfiguracao(a, { qualidade: 'alto', fov: 70, efeitos: { bloom: false } })
    assert.deepEqual(carregarConfiguracao(a, padrao), {
      qualidade: 'alto',
      fov: 70,
      efeitos: { bloom: false },
    })
    a.gravar('grafico', JSON.stringify({ qualidade: 'xpto', fov: 500, efeitos: { ao: 'sim' } }))
    const c = carregarConfiguracao(a, padrao)
    assert.equal(c.qualidade, 'ultra')
    assert.equal(c.fov, FOV.max)
    assert.deepEqual(c.efeitos, {})
    a.gravar('grafico', '{quebrado')
    assert.equal(carregarConfiguracao(a, padrao).qualidade, 'ultra')
  })
})

describe('força do desfoque', () => {
  test('0 é nítido, o padrão é o do jogo, 1 é o dobro; fora da faixa fica na borda', () => {
    assert.equal(escalaDoDesfoque({}), 1)
    assert.equal(escalaDoDesfoque({ desfoque: DESFOQUE.padrao }), 1)
    assert.equal(escalaDoDesfoque({ desfoque: 0 }), 0)
    assert.equal(escalaDoDesfoque({ desfoque: 1 }), 2)
    assert.equal(escalaDoDesfoque({ desfoque: 7 }), 2)
    assert.equal(escalaDoDesfoque({ desfoque: NaN }), 1)
  })

  test('a escolha do jogador volta como foi gravada, e quem nunca mexeu não ganha o campo', () => {
    const a = memoria()
    const padrao = configuracaoPadrao({}, { fov: 50 })
    salvarConfiguracao(a, { ...padrao, desfoque: 0.8 })
    assert.equal(carregarConfiguracao(a, padrao).desfoque, 0.8)
    salvarConfiguracao(a, padrao)
    assert.equal('desfoque' in carregarConfiguracao(a, padrao), false)
    a.gravar('grafico', JSON.stringify({ desfoque: -3 }))
    assert.equal(carregarConfiguracao(a, padrao).desfoque, 0)
  })

  test('o painel nomeia a força nos dez idiomas', () => {
    for (const idioma of IDIOMAS) assert.ok(TEXTOS_DO_PAINEL[idioma].desfoque, idioma)
  })
})

describe('renderizador', () => {
  test('pixel ratio limitado pela qualidade; sombra desligada no Baixo', () => {
    const r = {
      pr: 0,
      shadowMap: { enabled: true },
      setPixelRatio(v) {
        this.pr = v
      },
    }
    aplicarNoRenderizador(r, { qualidade: 'baixo' }, { dprDoAparelho: 3 })
    assert.equal(r.pr, 1)
    assert.equal(r.shadowMap.enabled, false)
    aplicarNoRenderizador(r, { qualidade: 'ultra' }, { dprDoAparelho: 3 })
    assert.equal(r.pr, 2)
    assert.equal(r.shadowMap.enabled, true)
  })
})

describe('cadeia de pós-processamento', () => {
  class Passe {
    constructor() {
      this.enabled = true
      this.uniforms = SHADER_DO_BORRAO.uniforms
      this.material = { uniforms: { resolution: { value: new THREE.Vector2() } } }
    }
    setSize() {}
    render() {}
  }
  class Composer {
    constructor(r, alvo) {
      this.passes = []
      this.readBuffer = alvo
      this.quadros = 0
      // como o do three: o segundo alvo é clone do primeiro, e o clone divide a profundidade
      this.renderTarget1 = alvo
      this.renderTarget2 = { depthTexture: alvo.depthTexture, texture: {} }
    }
    addPass(p) {
      this.passes.push(p)
    }
    setSize() {}
    setPixelRatio() {}
    render() {
      this.quadros++
    }
  }
  const modulos = {
    EffectComposer: Composer,
    RenderPass: Passe,
    GTAOPass: Passe,
    UnrealBloomPass: Passe,
    OutputPass: Passe,
    ShaderPass: class extends Passe {
      constructor(shader) {
        super()
        this.uniforms = Object.fromEntries(
          Object.entries(shader.uniforms).map(([k, v]) => [k, { value: v.value }]),
        )
      }
    },
    FXAAShader: { uniforms: {} },
  }
  // Um composer que roda os passes como o do three: o RenderPass não troca os alvos, os outros
  // trocam; cada alvo tem a sua profundidade.
  class ComposerDeVerdade extends Composer {
    constructor(r, alvo) {
      super(r, alvo)
      this.leitura = alvo
      this.escrita = this.renderTarget2
      this.laco = []
    }
    render() {
      this.quadros++
      for (const p of this.passes) {
        if (!p.enabled) continue
        p.render(null, this.escrita, this.leitura)
        const presa = this.escrita.depthTexture
        if (p.uniforms?.tDepth && p.uniforms.tDepth.value === presa) this.laco.push(this.quadros)
        if (p !== this.passes[0]) [this.leitura, this.escrita] = [this.escrita, this.leitura]
      }
    }
  }
  const renderer = {
    getSize: (v) => v.set(800, 600),
    getPixelRatio: () => 1,
    setPixelRatio() {},
    shadowMap: { enabled: true },
  }

  test('liga e desliga cada passe pelo efeito, sem recriar a cadeia', () => {
    const camera = new THREE.PerspectiveCamera()
    const p = criarPosProcesso({
      THREE,
      renderer,
      scene: new THREE.Scene(),
      camera,
      modulos,
      cfg: { qualidade: 'ultra', efeitos: {} },
    })
    assert.equal(p.composer.passes.length, 7)
    assert.ok(p.passes.ao.enabled && p.passes.borrao.enabled && p.passes.brilho.enabled)
    p.aplicar({ qualidade: 'baixo', efeitos: {} })
    assert.ok(!p.passes.ao.enabled && !p.passes.borrao.enabled && !p.passes.brilho.enabled)
    assert.ok(p.passes.aa.enabled)
    assert.equal(p.composer.passes.length, 7)
  })

  test('o desfoque do fundo entra só se o jogo passar o BokehPass, liga no ultra e foca onde mandam', () => {
    class Bokeh extends Passe {
      constructor(scene, camera, p) {
        super()
        this.uniforms = { focus: { value: p.focus }, aperture: { value: p.aperture } }
      }
    }
    const camera = new THREE.PerspectiveCamera()
    const base = { THREE, renderer, scene: new THREE.Scene(), camera }
    const sem = criarPosProcesso({ ...base, modulos, cfg: { qualidade: 'ultra', efeitos: {} } })
    assert.equal(sem.passes.foco, null)
    assert.equal(sem.composer.passes.length, 7)
    const com = criarPosProcesso({
      ...base,
      modulos: { ...modulos, BokehPass: Bokeh },
      cfg: { qualidade: 'ultra', efeitos: {} },
    })
    assert.equal(com.composer.passes.length, 8)
    assert.equal(com.composer.passes[3], com.passes.foco, 'depois do AO, antes do bloom')
    assert.ok(com.passes.foco.enabled)
    com.focar(1.8)
    assert.equal(com.passes.foco.uniforms.focus.value, 1.8)
    com.focar(NaN)
    assert.equal(com.passes.foco.uniforms.focus.value, 1.8)
    com.aplicar({ qualidade: 'alto', efeitos: {} })
    assert.ok(!com.passes.foco.enabled)
  })

  test('o desfoque parte do que o jogo pediu e segue a força escolhida no painel', () => {
    class Bokeh extends Passe {
      constructor(scene, camera, p) {
        super()
        this.uniforms = {
          focus: { value: p.focus },
          aperture: { value: p.aperture },
          maxblur: { value: p.maxblur },
        }
      }
    }
    const camera = new THREE.PerspectiveCamera()
    const doJogo = { aperture: 0.004, maxblur: 0.016 }
    const p = criarPosProcesso({
      THREE,
      renderer,
      scene: new THREE.Scene(),
      camera,
      modulos: { ...modulos, BokehPass: Bokeh },
      foco: doJogo,
      cfg: { qualidade: 'ultra', efeitos: {} },
    })
    assert.equal(p.passes.foco.uniforms.aperture.value, doJogo.aperture)
    assert.equal(p.passes.foco.uniforms.maxblur.value, doJogo.maxblur)
    p.aplicar({ qualidade: 'ultra', efeitos: {}, desfoque: 1 })
    assert.equal(p.passes.foco.uniforms.aperture.value, doJogo.aperture * 2)
    assert.equal(p.passes.foco.uniforms.maxblur.value, doJogo.maxblur * 2)
    p.aplicar({ qualidade: 'ultra', efeitos: {}, desfoque: 0 })
    assert.equal(p.passes.foco.uniforms.maxblur.value, 0)
    // sem o do jogo, o padrão do SDK
    const padrao = criarPosProcesso({
      THREE,
      renderer,
      scene: new THREE.Scene(),
      camera,
      modulos: { ...modulos, BokehPass: Bokeh },
      cfg: { qualidade: 'ultra', efeitos: {} },
    })
    assert.equal(padrao.passes.foco.uniforms.aperture.value, FOCO.aperture)
  })

  test('o borrão não age no primeiro quadro nem num corte de câmera', () => {
    const camera = new THREE.PerspectiveCamera()
    const p = criarPosProcesso({
      THREE,
      renderer,
      scene: new THREE.Scene(),
      camera,
      modulos,
      cfg: { qualidade: 'ultra', efeitos: {} },
    })
    p.render(0.016)
    assert.equal(p.passes.borrao.uniforms.ligado.value, 0)
    camera.position.x += 0.1
    p.render(0.016)
    assert.equal(p.passes.borrao.uniforms.ligado.value, 1)
    camera.position.x += BORRAO.corte + 1
    p.render(0.016)
    assert.equal(p.passes.borrao.uniforms.ligado.value, 0)
    assert.equal(p.composer.quadros, 3)
  })

  test('lê a profundidade que a cena desenhou, e nunca a do alvo em que escreve', () => {
    const camera = new THREE.PerspectiveCamera()
    const p = criarPosProcesso({
      THREE,
      renderer,
      scene: new THREE.Scene(),
      camera,
      modulos: { ...modulos, EffectComposer: ComposerDeVerdade },
      cfg: { qualidade: 'ultra', efeitos: {} },
    })
    for (let i = 0; i < 4; i++) {
      const cenaDesenhaEm = p.composer.leitura.depthTexture
      camera.position.x += 0.1
      p.render(0.016)
      assert.equal(p.passes.borrao.uniforms.tDepth.value, cenaDesenhaEm)
    }
    assert.notEqual(p.composer.renderTarget2.depthTexture, p.composer.renderTarget1.depthTexture)
    assert.deepEqual(p.composer.laco, [])
  })
})

test('o painel fala os dez idiomas, com todas as chaves', () => {
  const base = TEXTOS_DO_PAINEL['pt-BR']
  for (const idioma of IDIOMAS) {
    const t = TEXTOS_DO_PAINEL[idioma]
    assert.ok(t, idioma)
    for (const k of Object.keys(base)) assert.ok(t[k], `${idioma}.${k}`)
    for (const q of QUALIDADES) assert.ok(t.q[q], `${idioma}.q.${q}`)
    for (const e of EFEITOS) assert.ok(t.e[e], `${idioma}.e.${e}`)
  }
})
