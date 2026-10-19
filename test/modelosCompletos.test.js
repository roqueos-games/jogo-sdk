import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { criarCarregador, criarCenario } from '../src/modelos.js'

function contexto() {
  const gerentes = []
  let falhar = true
  class GLTFLoader {
    constructor(manager) {
      this.manager = manager
      gerentes.push(manager)
    }
    async loadAsync(url) {
      if (falhar && url.includes('falha')) this.manager?.itemError(`${url}?segredo=nao-ecoar`)
      const scene = new THREE.Group()
      scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()))
      return { scene }
    }
  }
  const c = criarCarregador({ GLTFLoader, LoadingManager: THREE.LoadingManager, estrito: true })
  return {
    c,
    GLTFLoader,
    gerentes,
    recuperar: () => {
      falhar = false
    },
  }
}
describe('modelos completos por opção explícita', () => {
  it('rejeita textura interna que o parser absorve, sem ecoar URL; retry usa gerente novo', async () => {
    const t = contexto()
    await assert.rejects(
      t.c.modelo('falha.gltf'),
      (erro) =>
        erro.codigo === 'MODELO_INCOMPLETO' &&
        !erro.message.includes('segredo') &&
        !erro.message.includes('falha.gltf'),
    )
    t.recuperar()
    const { cena } = await t.c.modelo('falha.gltf')
    assert.equal(cena.children.length, 1)
    assert.equal(t.gerentes.length, 2)
    assert.notEqual(t.gerentes[0], t.gerentes[1])
  })
  it('a falha de um modelo concorrente não contamina outro', async () => {
    const t = contexto()
    const [a, b] = await Promise.allSettled([t.c.modelo('falha.gltf'), t.c.modelo('integro.gltf')])
    assert.equal(a.status, 'rejected')
    assert.equal(b.status, 'fulfilled')
    assert.notEqual(t.gerentes[0], t.gerentes[1])
  })
  it('criarCenario sinaliza em faltaram o modelo com dependência interna ausente', async () => {
    const t = contexto()
    const cenario = criarCenario({ THREE, GLTFLoader: t.GLTFLoader, estrito: true })
    const { faltaram } = await cenario.carregar({ modelos: { mesa: 'falha.gltf' } })
    assert.deepEqual(faltaram, ['mesa'])
    assert.equal(cenario.modelo('mesa'), null)
  })
  it('o caminho legado mantém a política existente quando não há opt-in', async () => {
    const t = contexto()
    const c = criarCarregador({ GLTFLoader: t.GLTFLoader })
    const { cena } = await c.modelo('falha.gltf')
    assert.equal(cena.children.length, 1)
  })
})
