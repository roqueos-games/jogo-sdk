// O cenário de mercado (Goal 83): modelos, texturas PBR e céu pedidos de uma vez, com o que
// faltar ficando de fora sem derrubar o resto. Three de verdade, loaders falsos.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { PERFIS, criarCenario } from '../src/modelos.js'

function loaders() {
  const urls = []
  class GLTFLoader {
    setMeshoptDecoder() {}
    async loadAsync(url) {
      urls.push(url)
      if (url.includes('quebrado')) throw new Error('404')
      const cena = new THREE.Group()
      const m = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 1), new THREE.MeshStandardMaterial())
      m.position.set(5, 7, -3)
      cena.add(m)
      return { scene: cena, animations: [] }
    }
  }
  class TextureLoader {
    async loadAsync(url) {
      urls.push(url)
      if (url.includes('sem-arm/arm')) throw new Error('404')
      return new THREE.Texture()
    }
  }
  class RGBELoader {
    async loadAsync(url) {
      urls.push(url)
      return new THREE.DataTexture(new Uint16Array(4), 1, 1)
    }
  }
  return { GLTFLoader, TextureLoader, RGBELoader, urls }
}

describe('criarCenario', () => {
  test('carrega o que existe e lista o que faltou sem rejeitar', async () => {
    const l = loaders()
    const c = criarCenario({ THREE, ...l, base: '/games/x/v2' })
    const { faltaram } = await c.carregar({
      modelos: { banco: 'modelos/banco.gltf', ruim: 'modelos/quebrado.gltf' },
      texturas: ['madeira', 'sem-arm'],
      ceu: 'ceu/sala.hdr',
    })
    assert.deepEqual(faltaram.sort(), ['ruim', 'sem-arm.arm'])
    assert.ok(c.tem('banco'))
    assert.ok(!c.tem('ruim'))
    assert.ok(c.tem('madeira'))
    assert.ok(c.ceu)
    assert.ok(l.urls.includes('/games/x/v2/texturas/madeira/normal.webp'))
    assert.ok(l.urls.includes('/games/x/v2/ceu/sala.hdr'))
  })

  test('o céu respeita o perfil: o baixo não baixa o HDR do alto', async () => {
    const l = loaders()
    const c = criarCenario({ THREE, ...l, perfil: PERFIS.baixo })
    await c.carregar({ ceu: { baixo: 'ceu/1k.hdr', alto: 'alto/ceu/2k.hdr' } })
    assert.deepEqual(l.urls, ['ceu/1k.hdr'])
  })

  test('modelo vem na medida, assentado no chão e centrado', async () => {
    const c = criarCenario({ THREE, ...loaders() })
    await c.carregar({ modelos: { banco: 'banco.gltf' } })
    const g = c.modelo('banco', 0.8)
    const caixa = new THREE.Box3().setFromObject(g)
    const tam = caixa.getSize(new THREE.Vector3())
    assert.ok(Math.abs(tam.y - 0.8) < 1e-6, `altura ${tam.y}`)
    assert.ok(Math.abs(caixa.min.y) < 1e-6, `pé em ${caixa.min.y}`)
    const centro = caixa.getCenter(new THREE.Vector3())
    assert.ok(Math.abs(centro.x) < 1e-6 && Math.abs(centro.z) < 1e-6)
    const lado = c.modelo('banco', 3, { porLado: true })
    const t2 = new THREE.Box3().setFromObject(lado).getSize(new THREE.Vector3())
    assert.ok(Math.abs(Math.max(t2.x, t2.y, t2.z) - 3) < 1e-6)
    assert.notEqual(g.children[0], lado.children[0], 'cada pedido é um clone')
    assert.equal(c.modelo('ruim', 1), null)
  })

  test('vestir põe cor sRGB, normal e arm com a repetição pedida', async () => {
    const c = criarCenario({ THREE, ...loaders() })
    await c.carregar({ texturas: ['madeira'] })
    const mat = new THREE.MeshStandardMaterial({ color: 0x00ff00 })
    assert.equal(c.vestir(mat, 'madeira', 3, 2), true)
    assert.equal(mat.map.colorSpace, THREE.SRGBColorSpace)
    assert.equal(mat.map.wrapS, THREE.RepeatWrapping)
    assert.deepEqual([mat.map.repeat.x, mat.map.repeat.y], [3, 2])
    assert.ok(mat.normalMap && mat.roughnessMap && mat.metalnessMap)
    assert.equal(mat.color.getHex(), 0xffffff)
    const outro = new THREE.MeshStandardMaterial()
    c.vestir(outro, 'madeira', 1, 1)
    assert.deepEqual([mat.map.repeat.x, outro.map.repeat.x], [3, 1], 'repetição não vaza')
    assert.equal(c.vestir(new THREE.MeshStandardMaterial(), 'nada'), false)
  })
})
