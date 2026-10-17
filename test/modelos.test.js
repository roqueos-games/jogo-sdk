// O kit de modelos com o three de verdade e um GLTFLoader falso: o que importa aqui é a
// combinação (perfil, cache, clone, sombra, caminho do alto), não o parser do three.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import {
  PERFIS,
  perfilDoJogo,
  prepararRenderizador,
  acenderAmbiente,
  caminhoDoPerfil,
  criarCarregador,
  liberar,
} from '../src/modelos.js'

function gltfFalso() {
  const cena = new THREE.Group()
  cena.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()))
  return { scene: cena, animations: [new THREE.AnimationClip('andar', 1, [])] }
}

function loaderFalso() {
  const chamadas = []
  class GLTFLoader {
    setMeshoptDecoder(d) {
      this.decoder = d
      GLTFLoader.decoder = d
    }
    async loadAsync(url) {
      chamadas.push(url)
      if (url.includes('quebrado')) throw new Error('404')
      return gltfFalso()
    }
  }
  return { GLTFLoader, chamadas }
}

describe('perfil', () => {
  test('o host decide: modoLeve é o perfil baixo', () => {
    const leve = { desempenho: { modoLeve: () => true } }
    const forte = { desempenho: { modoLeve: () => false } }
    assert.equal(perfilDoJogo(leve, { busca: '' }), PERFIS.baixo)
    assert.equal(perfilDoJogo(forte, { busca: '' }), PERFIS.alto)
  })

  test('?perfil= força, para o jogo olho fotografar os dois no mesmo desktop', () => {
    const forte = { desempenho: { modoLeve: () => false } }
    assert.equal(perfilDoJogo(forte, { busca: '?perfil=baixo' }), PERFIS.baixo)
    assert.equal(perfilDoJogo(forte, { busca: '?perfil=qualquer' }), PERFIS.alto)
  })

  test('os tetos são os da decisão de 16/10/2026', () => {
    assert.equal(PERFIS.baixo.tetoMB, 30)
    assert.equal(PERFIS.alto.tetoMB, 120)
  })
})

describe('renderizador e ambiente', () => {
  const renderizadorFalso = () => ({
    shadowMap: {},
    setPixelRatio(v) {
      this.dpr = v
    },
  })

  test('ACES, sRGB e sombra pelo perfil; pixelRatio com teto', () => {
    globalThis.devicePixelRatio = 3
    const baixo = prepararRenderizador({
      THREE,
      renderer: renderizadorFalso(),
      perfil: PERFIS.baixo,
    })
    assert.equal(baixo.toneMapping, THREE.ACESFilmicToneMapping)
    assert.equal(baixo.outputColorSpace, THREE.SRGBColorSpace)
    assert.equal(baixo.shadowMap.type, THREE.PCFShadowMap)
    assert.equal(baixo.dpr, 1.5)
    const alto = prepararRenderizador({ THREE, renderer: renderizadorFalso(), perfil: PERFIS.alto })
    assert.equal(alto.shadowMap.type, THREE.PCFSoftShadowMap)
    assert.equal(alto.dpr, 2)
  })

  test('sem HDR e sem RoomEnvironment, explica em vez de deixar a cena preta', () => {
    const FakeThree = {
      ...THREE,
      PMREMGenerator: class {
        dispose() {}
      },
    }
    assert.throws(
      () => acenderAmbiente({ THREE: FakeThree, renderer: {}, scene: new THREE.Scene() }),
      /entregue um HDR/,
    )
  })

  test('com HDR, a cena recebe o ambiente e o fundo', () => {
    const alvo = { texture: new THREE.Texture() }
    const FakeThree = {
      ...THREE,
      PMREMGenerator: class {
        fromEquirectangular() {
          return alvo
        }
        dispose() {}
      },
    }
    const cena = new THREE.Scene()
    const hdr = new THREE.Texture()
    acenderAmbiente({ THREE: FakeThree, renderer: {}, scene: cena, textura: hdr, fundo: true })
    assert.equal(cena.environment, alvo.texture)
    assert.equal(cena.background, hdr)
    assert.equal(hdr.mapping, THREE.EquirectangularReflectionMapping)
  })
})

describe('caminho por perfil', () => {
  test('texto vale nos dois; objeto escolhe pelo perfil', () => {
    assert.equal(caminhoDoPerfil('a.glb', PERFIS.alto), 'a.glb')
    const f = { baixo: 'carro.glb', alto: 'alto/carro.glb' }
    assert.equal(caminhoDoPerfil(f, PERFIS.baixo), 'carro.glb')
    assert.equal(caminhoDoPerfil(f, PERFIS.alto), 'alto/carro.glb')
  })

  test('sem versão de alto, o alto usa a do baixo', () => {
    assert.equal(caminhoDoPerfil({ baixo: 'carro.glb' }, PERFIS.alto), 'carro.glb')
  })

  test('caminho de alto fora de alto/ reprova: o jogo check não o tiraria dos 30 MB', () => {
    assert.throws(
      () => caminhoDoPerfil({ baixo: 'a.glb', alto: 'a-hd.glb' }, PERFIS.alto),
      /pasta alto\//,
    )
  })
})

describe('carregador', () => {
  test('baixa uma vez, entrega clone a cada pedido, com sombra e animações', async () => {
    const { GLTFLoader, chamadas } = loaderFalso()
    const c = criarCarregador({ GLTFLoader, base: '/games/x/', perfil: PERFIS.baixo })
    const a = await c.modelo('modelos/carro.glb')
    const b = await c.modelo('modelos/carro.glb')
    assert.deepEqual(chamadas, ['/games/x/modelos/carro.glb'])
    assert.notEqual(a.cena, b.cena)
    assert.equal(a.animacoes[0].name, 'andar')
    let comSombra = 0
    a.cena.traverse((o) => o.isMesh && o.castShadow && o.receiveShadow && comSombra++)
    assert.equal(comSombra, 1)
  })

  test('o progresso conta arquivos pedidos e prontos', async () => {
    const { GLTFLoader } = loaderFalso()
    const vistos = []
    const c = criarCarregador({ GLTFLoader, aoProgresso: (p) => vistos.push({ ...p }) })
    await c.preparar(['a.glb', 'b.glb', 'a.glb'])
    assert.deepEqual(c.progresso, { prontos: 2, pedidos: 2 })
    assert.deepEqual(vistos.at(-1), { prontos: 2, pedidos: 2 })
  })

  test('falha diz o endereço e não fica presa no cache', async () => {
    const { GLTFLoader, chamadas } = loaderFalso()
    const c = criarCarregador({ GLTFLoader })
    await assert.rejects(c.modelo('quebrado.glb'), /não carregou quebrado\.glb: 404/)
    await assert.rejects(c.modelo('quebrado.glb'))
    assert.equal(chamadas.length, 2)
  })

  test('o MeshoptDecoder vai para o loader (modelo do importador vem comprimido)', () => {
    const { GLTFLoader } = loaderFalso()
    const decoder = { decode() {} }
    criarCarregador({ GLTFLoader, MeshoptDecoder: decoder })
    assert.equal(GLTFLoader.decoder, decoder)
  })

  test('modelo com esqueleto usa o SkeletonUtils.clone quando o jogo entrega', async () => {
    let clonou = 0
    class GLTFLoader {
      async loadAsync() {
        const cena = new THREE.Group()
        const pele = new THREE.SkinnedMesh(
          new THREE.BoxGeometry(),
          new THREE.MeshStandardMaterial(),
        )
        cena.add(pele)
        return { scene: cena, animations: [] }
      }
    }
    const SkeletonUtils = { clone: (o) => (clonou++, o.clone(true)) }
    const c = criarCarregador({ GLTFLoader, SkeletonUtils })
    await c.modelo('heroi.glb')
    assert.equal(clonou, 1)
  })
})

test('liberar descarta geometria, material e textura', () => {
  const tex = new THREE.Texture()
  const mat = new THREE.MeshStandardMaterial({ map: tex })
  const geo = new THREE.BoxGeometry()
  let descartes = 0
  for (const x of [tex, mat, geo]) x.addEventListener('dispose', () => descartes++)
  const g = new THREE.Group()
  g.add(new THREE.Mesh(geo, mat))
  liberar(g)
  assert.equal(descartes, 3)
})
