// O cenário de mercado (Goal 83): modelos, texturas PBR e céu pedidos de uma vez, com o que
// faltar ficando de fora sem derrubar o resto. Three de verdade, loaders falsos.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { PERFIS, criarCenario } from '../src/modelos.js'

function contarDescarte(...recursos) {
  const contagem = new Map()
  for (const recurso of recursos) {
    contagem.set(recurso, 0)
    recurso.addEventListener('dispose', () => contagem.set(recurso, contagem.get(recurso) + 1))
  }
  return () => {
    for (const n of contagem.values()) assert.equal(n, 1)
  }
}
const encerrado = (erro) => erro.codigo === 'CENARIO_ENCERRADO' && !erro.message.includes('https:')
function promessaControlada() {
  let ok, falhar
  const promessa = new Promise((resolve, reject) => {
    ok = resolve
    falhar = reject
  })
  return { promessa, ok, falhar }
}

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

describe('abandono explícito antes da transferência', () => {
  test('descarta originais compartilhados, PBR e HDR uma vez; faltaram não abandona sozinho', async () => {
    const mapa = new THREE.Texture(),
      geometria = new THREE.BoxGeometry()
    const material = new THREE.MeshStandardMaterial({ map: mapa, normalMap: mapa })
    const raiz = new THREE.Group()
    raiz.add(new THREE.Mesh(geometria, material), new THREE.Mesh(geometria, [material, material]))
    let baixas = 0,
      descartes = 0
    class GLTFLoader {
      async loadAsync(url) {
        baixas++
        if (url.includes('ruim')) throw new Error('arquivo ausente')
        return { scene: raiz, animations: [] }
      }
    }
    class TextureLoader {
      async loadAsync() {
        return mapa
      }
    }
    class RGBELoader {
      async loadAsync() {
        return mapa
      }
    }
    mapa.addEventListener('dispose', () => descartes++)
    const conferir = contarDescarte(mapa, geometria, material)
    const c = criarCenario({ THREE, GLTFLoader, TextureLoader, RGBELoader })
    const resultado = await c.carregar({
      modelos: { a: 'bom', b: 'bom', ruim: 'ruim' },
      texturas: ['piso'],
      ceu: 'ceu',
    })
    assert.deepEqual(resultado.faltaram, ['ruim'])
    assert.equal(baixas, 2, 'o modelo compartilhado ainda usa o cache original')
    assert.equal(descartes, 0, 'faltaram não libera os irmãos bons')
    assert.equal(c.modelo('a').children[0].children[0].geometry, geometria)
    c.liberar()
    c.liberar()
    conferir()
    assert.equal(c.tem('a'), false)
    assert.equal(c.tem('piso'), false)
    assert.equal(c.ceu, null)
    assert.deepEqual(c.faltaram, [])
    await assert.rejects(c.carregar({ modelos: { novo: 'https://asset/segredo' } }), encerrado)
    assert.equal(baixas, 2, 'cenário encerrado não inicia outro download')
    assert.throws(() => c.modelo('a'), encerrado)
    const alvo = new THREE.MeshStandardMaterial()
    assert.throws(() => c.vestir(alvo, 'piso'), encerrado)
    assert.equal(alvo.map, null)
    assert.throws(() => c.aplicarCeu({}, new THREE.Scene()), encerrado)
  })

  test('descarta chegadas anteriores e tardias sem repopular tabelas ou duplicar recursos', async () => {
    const a = promessaControlada(),
      b = promessaControlada(),
      hdr = promessaControlada()
    const cor = promessaControlada(),
      normal = promessaControlada(),
      arm = promessaControlada()
    const mapa = new THREE.Texture(),
      tardio = new THREE.Texture(),
      ceu = new THREE.Texture()
    const geometria = new THREE.BoxGeometry(),
      outra = new THREE.SphereGeometry()
    const material = new THREE.MeshStandardMaterial({ map: mapa })
    const matTardio = new THREE.MeshStandardMaterial({ map: mapa, normalMap: tardio })
    const antes = new THREE.Group(),
      depois = new THREE.Group()
    antes.add(new THREE.Mesh(geometria, material))
    depois.add(new THREE.Mesh(geometria, material), new THREE.Mesh(outra, matTardio))
    class GLTFLoader {
      loadAsync(url) {
        return url === 'a' ? a.promessa : b.promessa
      }
    }
    class TextureLoader {
      loadAsync(url) {
        return url.includes('/cor.')
          ? cor.promessa
          : url.includes('/normal.')
            ? normal.promessa
            : arm.promessa
      }
    }
    class RGBELoader {
      loadAsync() {
        return hdr.promessa
      }
    }
    const conferir = contarDescarte(mapa, tardio, ceu, geometria, outra, material, matTardio)
    const c = criarCenario({ THREE, GLTFLoader, TextureLoader, RGBELoader })
    const carga = c.carregar({ modelos: { a: 'a', b: 'b' }, texturas: ['piso'], ceu: 'h' })
    const rejeitada = assert.rejects(carga, encerrado)
    a.ok({ scene: antes })
    cor.ok(mapa)
    for (let i = 0; i < 4; i++) await Promise.resolve()
    assert.equal(c.tem('a'), true)
    c.liberar()
    b.ok({ scene: depois })
    normal.ok(tardio)
    arm.ok(mapa)
    hdr.ok(ceu)
    await rejeitada
    c.liberar()
    conferir()
    assert.equal(c.tem('a'), false)
    assert.equal(c.tem('b'), false)
    assert.equal(c.tem('piso'), false)
    assert.equal(c.ceu, null)
    assert.deepEqual(c.faltaram, [])
  })

  test('também libera ids sobrescritos e não registra falha tardia em cenário encerrado', async () => {
    const registros = []
    class TextureLoader {
      async loadAsync() {
        const t = new THREE.Texture()
        registros.push(t)
        return t
      }
    }
    const c = criarCenario({ THREE, ...loaders(), TextureLoader })
    await c.carregar({ texturas: ['piso'] })
    await c.carregar({ texturas: ['piso'] })
    assert.equal(registros.length, 6)
    const conferir = contarDescarte(...registros)
    c.liberar()
    conferir()
    const pendente = promessaControlada()
    class GLTFLoader {
      loadAsync() {
        return pendente.promessa
      }
    }
    const outro = criarCenario({ THREE, GLTFLoader })
    const promessa = outro.carregar({ modelos: { a: 'a' } })
    const rejeitada = assert.rejects(promessa, encerrado)
    outro.liberar()
    pendente.falhar(new Error('https://segredo/interno'))
    await rejeitada
    assert.deepEqual(outro.faltaram, [])
  })
})
