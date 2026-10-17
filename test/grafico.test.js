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
  }
  class Composer {
    constructor(r, alvo) {
      this.passes = []
      this.readBuffer = alvo
      this.quadros = 0
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
