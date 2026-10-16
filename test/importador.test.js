// `jogo assets importar` e `jogo olho`: as partes puras com dado de mentira, e o importador
// de ponta a ponta num GLB de verdade gerado no teste (sem rede: fonte `arquivo`).
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Document, NodeIO } from '@gltf-transform/core'
import {
  conferirTrava,
  dentro,
  registrarNoLedger,
  sha256,
  validarLista,
} from '../src/importador.js'
import { CENARIOS, resumirQuadros, urlDoCenario } from '../src/olho.js'

const SDK = fileURLToPath(new URL('..', import.meta.url))
const CLI = join(SDK, 'bin/jogo.mjs')

const item = (extra = {}) => ({
  id: 'palmeira',
  saida: 'public/games/x/palmeira.glb',
  licenca: 'CC0-1.0',
  origem: 'https://polyhaven.com/a/palmeira',
  fonte: { polyhaven: 'palmeira' },
  ...extra,
})

describe('lista de importação', () => {
  test('a lista boa passa', () => {
    assert.deepEqual(validarLista({ itens: [item()] }), [])
  })

  test('cada furo reprova antes de baixar qualquer coisa', () => {
    const p = validarLista({
      itens: [
        item({ saida: 'src/palmeira.glb' }),
        item({ licenca: '' }),
        item({ id: 'b', origem: '' }),
        item({ id: 'c', fonte: {} }),
        item({ id: 'd', fonte: { polyhaven: 'x', arquivo: 'y' } }),
        item({ id: 'e', licenca: 'Fab Standard' }),
      ],
    })
    assert.match(p.join('\n'), /saida precisa ser um \.glb dentro de public\//)
    assert.match(p.join('\n'), /item "palmeira": id repetido/)
    assert.match(p.join('\n'), /sem licença/)
    assert.match(p.join('\n'), /item "b": sem origem/)
    assert.match(p.join('\n'), /item "c": fonte precisa de polyhaven OU arquivo/)
    assert.match(p.join('\n'), /item "d": fonte precisa de polyhaven OU arquivo/)
    assert.match(p.join('\n'), /item "e": asset do Fab não sai cru/)
  })

  test('lista vazia reprova', () => {
    assert.deepEqual(validarLista({ itens: [] }), ['assets/importar.json sem itens'])
  })

  test('caminho que sai da pasta é recusado', () => {
    assert.throws(() => dentro('/jogo', '../../etc/passwd'), /caminho inseguro/)
    assert.equal(dentro('/jogo', 'public/a.glb'), '/jogo/public/a.glb')
  })
})

describe('trava e ledger', () => {
  test('a fonte que mudou na origem para o import', () => {
    const trava = {}
    conferirTrava(trava, 'a/x.gltf', { url: 'u', bytes: 1, sha256: 'a'.repeat(64) })
    conferirTrava(trava, 'a/x.gltf', { url: 'u', bytes: 1, sha256: 'a'.repeat(64) })
    assert.throws(
      () => conferirTrava(trava, 'a/x.gltf', { url: 'u', bytes: 1, sha256: 'b'.repeat(64) }),
      /a fonte fixada mudou: a\/x\.gltf/,
    )
  })

  test('o ledger troca a linha que existe e acrescenta a nova na tabela', () => {
    const base =
      '# Origem\n\n| Caminho | Licença | Origem |\n| --- | --- | --- |\n| `public/a.png` | autoral | eu |\n\nfim\n'
    const um = registrarNoLedger(base, {
      caminho: 'public/b.glb',
      licenca: 'CC0-1.0',
      origem: 'ph',
      sha: 'f'.repeat(64),
    })
    assert.match(
      um,
      /\| `public\/a\.png` \| autoral \| eu \|\n\| `public\/b\.glb` \| CC0-1\.0 \| ph \| f{64} \|\n\nfim/,
    )
    const dois = registrarNoLedger(um, {
      caminho: 'public/b.glb',
      licenca: 'CC-BY-4.0',
      origem: 'sf',
      sha: 'e'.repeat(64),
    })
    assert.equal(dois.match(/public\/b\.glb/g).length, 1)
    assert.match(dois, /\| `public\/b\.glb` \| CC-BY-4\.0 \| sf \| e{64} \|/)
  })
})

describe('olho', () => {
  test('três cenários: desktop no alto, celular e TV no baixo', () => {
    assert.deepEqual(
      CENARIOS.map((c) => `${c.nome}:${c.perfil}`),
      ['desktop:alto', 'celular:baixo', 'tv:baixo'],
    )
    assert.equal(CENARIOS[1].hasTouch, true)
  })

  test('o perfil vai na busca da URL, sem perder a que já existe', () => {
    assert.equal(
      urlDoCenario('http://localhost:5199/?x=1', CENARIOS[1]),
      'http://localhost:5199/?x=1&perfil=baixo',
    )
  })

  test('p50, p99, pior e quadros acima de 100 ms', () => {
    const intervalos = [...Array(98).fill(16.7), 120, 250]
    assert.deepEqual(resumirQuadros(intervalos), {
      quadros: 100,
      p50: 16.7,
      p99: 250,
      pior: 250,
      acimaDe100: 2,
    })
    assert.equal(resumirQuadros([]).p50, null)
  })
})

describe('jogo assets importar, de ponta a ponta', () => {
  test('um GLB vira saída comprimida, com SHA no ledger que o jogo check confere', async () => {
    // Dentro do SDK, para o import achar o gltf-transform do node_modules daqui.
    mkdirSync(join(SDK, '.tmp-teste'), { recursive: true })
    const jogo = mkdtempSync(join(SDK, '.tmp-teste', 'jogo-'))
    try {
      const doc = new Document()
      const buffer = doc.createBuffer()
      const pos = doc
        .createAccessor()
        .setType('VEC3')
        .setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]))
        .setBuffer(buffer)
      const ind = doc
        .createAccessor()
        .setType('SCALAR')
        .setArray(new Uint16Array([0, 1, 2, 0, 2, 3]))
        .setBuffer(buffer)
      const prim = doc.createPrimitive().setAttribute('POSITION', pos).setIndices(ind)
      const mesh = doc.createMesh('Tronco').addPrimitive(prim)
      doc.createScene().addChild(doc.createNode('Tronco').setMesh(mesh))
      mkdirSync(join(jogo, '.local/asset-source'), { recursive: true })
      writeFileSync(
        join(jogo, '.local/asset-source/palmeira.glb'),
        await new NodeIO().writeBinary(doc),
      )
      writeFileSync(
        join(jogo, 'package.json'),
        JSON.stringify({ name: 'x', license: 'UNLICENSED' }),
      )
      mkdirSync(join(jogo, 'assets'))
      writeFileSync(
        join(jogo, 'assets/importar.json'),
        JSON.stringify({
          itens: [item({ fonte: { arquivo: '.local/asset-source/palmeira.glb' } })],
        }),
      )
      const r = spawnSync(process.execPath, [CLI, 'assets', 'importar'], {
        cwd: jogo,
        encoding: 'utf8',
      })
      assert.equal(r.status, 0, r.stdout + r.stderr)
      assert.match(r.stdout, /ok {2}palmeira {2}public\/games\/x\/palmeira\.glb/)
      const saida = readFileSync(join(jogo, 'public/games/x/palmeira.glb'))
      const ledger = readFileSync(join(jogo, 'ASSETS.md'), 'utf8')
      assert.match(ledger, new RegExp(sha256(saida)))
      const trava = JSON.parse(readFileSync(join(jogo, 'assets/source-lock.json'), 'utf8'))
      assert.ok(trava.files['palmeira/palmeira.glb'].sha256)
      const lido = await new NodeIO().readBinary(saida).catch(() => null)
      // Sem o decoder registrado o meshopt não abre: é a prova de que saiu comprimido.
      assert.equal(lido, null)
      // Mexer no arquivo depois do import: o check reprova pelo SHA.
      writeFileSync(
        join(jogo, 'public/games/x/palmeira.glb'),
        Buffer.concat([saida, Buffer.from('x')]),
      )
      const { conferirAssets } = await import('../src/verificacao.js')
      assert.match(conferirAssets(jogo).join('\n'), /palmeira\.glb mudou desde o import/)
    } finally {
      rmSync(jogo, { recursive: true, force: true })
    }
  })
})

describe('jogo assets importar com texturasFora (o caminho do iPhone)', () => {
  test('sai .gltf, .bin e a textura WebP ao lado, cada um com linha e SHA no ledger', async () => {
    const sharp = (await import('sharp')).default
    mkdirSync(join(SDK, '.tmp-teste'), { recursive: true })
    const jogo = mkdtempSync(join(SDK, '.tmp-teste', 'jogo-'))
    try {
      const doc = new Document()
      const buffer = doc.createBuffer()
      const pos = doc
        .createAccessor()
        .setType('VEC3')
        .setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]))
        .setBuffer(buffer)
      const uv = doc
        .createAccessor()
        .setType('VEC2')
        .setArray(new Float32Array([0, 0, 1, 0, 0, 1]))
        .setBuffer(buffer)
      // Textura de cor única vira cor no material (o prune do gltf-transform faz isso): xadrez.
      const px = Buffer.alloc(8 * 8 * 3)
      for (let i = 0; i < 64; i++) px.fill((i + Math.floor(i / 8)) % 2 ? 230 : 20, i * 3, i * 3 + 3)
      const png = await sharp(px, { raw: { width: 8, height: 8, channels: 3 } })
        .png()
        .toBuffer()
      const tex = doc.createTexture('cor').setImage(png).setMimeType('image/png')
      const mat = doc.createMaterial('lataria').setBaseColorTexture(tex)
      const prim = doc
        .createPrimitive()
        .setAttribute('POSITION', pos)
        .setAttribute('TEXCOORD_0', uv)
        .setMaterial(mat)
      doc
        .createScene()
        .addChild(doc.createNode('Carro').setMesh(doc.createMesh('Carro').addPrimitive(prim)))
      mkdirSync(join(jogo, '.local/asset-source'), { recursive: true })
      writeFileSync(
        join(jogo, '.local/asset-source/carro.glb'),
        await new NodeIO().writeBinary(doc),
      )
      writeFileSync(
        join(jogo, 'package.json'),
        JSON.stringify({ name: 'x', license: 'UNLICENSED' }),
      )
      mkdirSync(join(jogo, 'assets'))
      writeFileSync(
        join(jogo, 'assets/importar.json'),
        JSON.stringify({
          itens: [
            item({
              id: 'carro',
              saida: 'public/games/x/carro.gltf',
              texturasFora: true,
              fonte: { arquivo: '.local/asset-source/carro.glb' },
            }),
          ],
        }),
      )
      const r = spawnSync(process.execPath, [CLI, 'assets', 'importar'], {
        cwd: jogo,
        encoding: 'utf8',
      })
      assert.equal(r.status, 0, r.stdout + r.stderr)
      const gltf = JSON.parse(readFileSync(join(jogo, 'public/games/x/carro.gltf'), 'utf8'))
      assert.deepEqual(
        gltf.images.map((i) => i.uri),
        ['carro_t0.webp'],
      )
      assert.equal(gltf.images[0].bufferView, undefined)
      // O segundo buffer é o de reserva do meshopt: vazio e sem arquivo.
      assert.deepEqual(
        gltf.buffers.filter((b) => b.uri).map((b) => b.uri),
        ['carro.bin'],
      )
      const ledger = readFileSync(join(jogo, 'ASSETS.md'), 'utf8')
      for (const arq of ['carro.gltf', 'carro.bin', 'carro_t0.webp']) {
        const dados = readFileSync(join(jogo, 'public/games/x', arq))
        assert.match(
          ledger,
          new RegExp(
            `public/games/x/${arq.replace('.', '\\.')}\` \\| CC0-1\\.0 \\| [^|]+ \\| ${sha256(dados)}`,
          ),
        )
      }
      const { conferirAssets } = await import('../src/verificacao.js')
      assert.deepEqual(conferirAssets(jogo), [])
    } finally {
      rmSync(jogo, { recursive: true, force: true })
    }
  })

  test('texturasFora com saída .glb reprova antes de baixar', () => {
    const p = validarLista({ itens: [item({ texturasFora: true })] })
    assert.match(p.join('\n'), /saida precisa ser um \.gltf/)
  })
})
