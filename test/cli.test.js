// O CLI `jogo` recusa opção que não conhece e mostra a ajuda com --usage/--help/-h sem rodar
// nada (0.5.1, Goal 102). Duas vezes `jogo assets importar --usage` reimportou o catálogo
// inteiro por cima dos arquivos: aqui o catálogo falso é de verdade (um GLB que o importador
// sabe ler), então um parse que deixa passar a flag escreve no disco e o teste reprova.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Document, NodeIO } from '@gltf-transform/core'
import { COMANDOS, lerArgumentos, PEDIDOS_DE_AJUDA } from '../src/cli.js'

const SDK = fileURLToPath(new URL('..', import.meta.url))
const CLI = join(SDK, 'bin/jogo.mjs')

const rodar = (cwd, args) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8' })

/** Cada arquivo e pasta com o SHA-256 e o mtime: qualquer escrita muda a foto. */
function foto(raiz) {
  const mapa = {}
  const andar = (pasta) => {
    for (const nome of readdirSync(pasta)) {
      const caminho = join(pasta, nome)
      const s = statSync(caminho)
      const chave = relative(raiz, caminho)
      if (s.isDirectory()) {
        mapa[`${chave}/`] = s.mtimeMs
        andar(caminho)
      } else {
        const sha = createHash('sha256').update(readFileSync(caminho)).digest('hex')
        mapa[chave] = `${sha} ${s.mtimeMs}`
      }
    }
  }
  andar(raiz)
  return mapa
}

/**
 * Um jogo falso com `assets/importar.json` de dois itens: `palmeira` (um GLB de verdade em
 * `.local/`, que o importador transforma e escreve) e `pedra` (fonte que não existe). Fica
 * dentro do SDK para o importador achar o gltf-transform do node_modules daqui.
 */
async function jogoFalso() {
  mkdirSync(join(SDK, '.tmp-teste'), { recursive: true })
  const jogo = mkdtempSync(join(SDK, '.tmp-teste', 'cli-'))
  const doc = new Document()
  const buffer = doc.createBuffer()
  const pos = doc
    .createAccessor()
    .setType('VEC3')
    .setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]))
    .setBuffer(buffer)
  const prim = doc.createPrimitive().setAttribute('POSITION', pos)
  doc
    .createScene()
    .addChild(doc.createNode('Tronco').setMesh(doc.createMesh('T').addPrimitive(prim)))
  mkdirSync(join(jogo, '.local/asset-source'), { recursive: true })
  writeFileSync(join(jogo, '.local/asset-source/palmeira.glb'), await new NodeIO().writeBinary(doc))
  writeFileSync(join(jogo, 'package.json'), JSON.stringify({ name: 'x', license: 'UNLICENSED' }))
  writeFileSync(
    join(jogo, 'ASSETS.md'),
    '# Origem\n\n| Caminho | Licença | Origem |\n| --- | --- | --- |\n',
  )
  mkdirSync(join(jogo, 'assets'))
  const item = (id) => ({
    id,
    saida: `public/games/x/${id}.glb`,
    licenca: 'CC0-1.0',
    origem: `https://exemplo.invalid/${id}`,
    fonte: { arquivo: `.local/asset-source/${id}.glb` },
  })
  writeFileSync(
    join(jogo, 'assets/importar.json'),
    JSON.stringify({ itens: [item('palmeira'), item('pedra')] }),
  )
  return jogo
}

describe('lerArgumentos', () => {
  test('cada pedido de ajuda, em cada nível, devolve a ajuda daquele nível', () => {
    for (const h of PEDIDOS_DE_AJUDA) {
      assert.match(lerArgumentos([h]).ajuda, /^uso: jogo check/)
      assert.match(lerArgumentos(['assets', h]).ajuda, /^uso: jogo assets importar/)
      assert.match(lerArgumentos(['assets', 'importar', h]).ajuda, /--apenas=…/)
      assert.match(lerArgumentos(['check', h]).ajuda, /--sdk/)
      assert.match(lerArgumentos(['olho', h]).ajuda, /--segundos=…/)
    }
  })

  test('a ajuda ganha de qualquer outro argumento, até de opção inválida', () => {
    assert.ok(lerArgumentos(['assets', 'importar', '--apenas=a', '--usage']).ajuda)
    assert.ok(lerArgumentos(['assets', 'importar', '--xyz', '-h']).ajuda)
    assert.ok(lerArgumentos(['check', 'pasta', '--json', '--help']).ajuda)
  })

  test('opção desconhecida reprova e diz qual e o uso', () => {
    const r = lerArgumentos(['assets', 'importar', '--usagex'])
    assert.equal(r.ajuda, undefined)
    assert.match(r.erro, /^jogo assets importar: opção desconhecida --usagex/)
    assert.match(r.erro, /uso: jogo assets importar \[--apenas=id,id\]/)
    assert.match(lerArgumentos(['assets', 'importar', '-x']).erro, /opção desconhecida -x/)
    assert.match(lerArgumentos(['check', '--jsno']).erro, /jogo check: opção desconhecida --jsno/)
    assert.match(lerArgumentos(['olho', 'g1', '--porta=1']).erro, /opção desconhecida --porta=1/)
  })

  test('opção de outro comando não vale aqui', () => {
    assert.match(lerArgumentos(['assets', 'importar', '--json']).erro, /desconhecida --json/)
    assert.match(lerArgumentos(['check', '--apenas=a']).erro, /desconhecida --apenas=a/)
  })

  test('valor faltando, sobrando, vazio ou repetido reprova', () => {
    const imp = (...a) => lerArgumentos(['assets', 'importar', ...a]).erro
    assert.match(imp('--apenas'), /--apenas precisa de valor/)
    assert.match(imp('--apenas='), /--apenas precisa de valor/)
    assert.match(imp('--apenas=a,,b'), /item vazio/)
    assert.match(imp('--apenas=a', '--apenas=b'), /--apenas repetida/)
    assert.match(lerArgumentos(['check', '--json=sim']).erro, /--json não leva valor/)
    assert.match(lerArgumentos(['olho', 'g1', '--segundos=x']).erro, /maior que zero/)
  })

  test('argumento solto a mais reprova (o `--apenas palmeira` com espaço)', () => {
    assert.match(
      lerArgumentos(['assets', 'importar', '--apenas', 'palmeira']).erro,
      /precisa de valor/,
    )
    assert.match(
      lerArgumentos(['assets', 'importar', 'palmeira']).erro,
      /argumento a mais: palmeira/,
    )
    assert.match(lerArgumentos(['check', 'a', 'b']).erro, /argumento a mais: b/)
  })

  test('comando e subcomando desconhecidos, ou faltando, reprovam com o uso', () => {
    assert.match(lerArgumentos([]).erro, /^uso: jogo check/)
    assert.match(lerArgumentos(['publicar']).erro, /comando desconhecido publicar/)
    assert.match(lerArgumentos(['assets']).erro, /jogo assets: falta o subcomando/)
    assert.match(lerArgumentos(['assets', 'baixar']).erro, /subcomando desconhecido baixar/)
  })

  test('as opções válidas de hoje continuam passando', () => {
    assert.deepEqual(lerArgumentos(['check']), { comando: 'check', opcoes: {}, posicionais: [] })
    assert.deepEqual(lerArgumentos(['check', 'p', '--sdk', '--json']), {
      comando: 'check',
      opcoes: { sdk: true, json: true },
      posicionais: ['p'],
    })
    assert.deepEqual(lerArgumentos(['assets', 'importar']), {
      comando: 'assets importar',
      opcoes: {},
      posicionais: [],
    })
    assert.deepEqual(lerArgumentos(['assets', 'importar', '--apenas=a,b']).opcoes, {
      apenas: 'a,b',
    })
    assert.deepEqual(
      lerArgumentos(['olho', 'g1', '--url=http://x/?a=1', '--roteiro=r.mjs', '--segundos=3']),
      {
        comando: 'olho',
        opcoes: { url: 'http://x/?a=1', roteiro: 'r.mjs', segundos: '3' },
        posicionais: ['g1'],
      },
    )
  })

  test('todo comando declara uso, resumo e opções com ajuda', () => {
    for (const [nome, c] of Object.entries(COMANDOS)) {
      assert.ok(c.uso.startsWith(`jogo ${nome}`), nome)
      assert.ok(c.resumo, nome)
      for (const [o, d] of Object.entries(c.opcoes)) {
        assert.ok(['bandeira', 'valor'].includes(d.tipo), `${nome} --${o}`)
        assert.ok(d.ajuda, `${nome} --${o}`)
      }
    }
  })
})

describe('jogo assets importar, pelo CLI, num catálogo falso', () => {
  test('opção desconhecida sai 2 e não cria nem altera nenhum arquivo', async () => {
    const jogo = await jogoFalso()
    try {
      const antes = foto(jogo)
      for (const args of [
        ['--usagex'],
        ['--forcar'],
        ['--substituir'],
        ['-x'],
        ['--apenas'],
        ['--apenas', 'palmeira'],
        ['palmeira'],
        ['--apenas=palmeira', '--json'],
      ]) {
        const r = rodar(jogo, ['assets', 'importar', ...args])
        // O disco primeiro: é o que custou caro duas vezes.
        assert.deepEqual(foto(jogo), antes, `escreveu com: ${args.join(' ')}`)
        assert.equal(r.status, 2, `${args.join(' ')}\n${r.stdout}${r.stderr}`)
        assert.match(r.stderr, /^jogo assets importar: /)
        assert.match(r.stderr, /uso: jogo assets importar/)
        assert.equal(r.stdout, '')
      }
      assert.equal(existsSync(join(jogo, 'public')), false)
    } finally {
      rmSync(jogo, { recursive: true, force: true })
    }
  })

  test('--usage, --help e -h mostram a ajuda, saem 0 e não escrevem', async () => {
    const jogo = await jogoFalso()
    try {
      const antes = foto(jogo)
      for (const args of [['--usage'], ['--help'], ['-h'], ['--apenas=palmeira', '--usage']]) {
        const r = rodar(jogo, ['assets', 'importar', ...args])
        assert.deepEqual(foto(jogo), antes, `escreveu com: ${args.join(' ')}`)
        assert.equal(r.status, 0, `${args.join(' ')}\n${r.stdout}${r.stderr}`)
        assert.match(r.stdout, /^uso: jogo assets importar \[--apenas=id,id\]/)
        assert.match(r.stdout, /sem --apenas importa a lista inteira/)
      }
      for (const args of [
        ['--usage'],
        ['assets', '--usage'],
        ['check', '-h'],
        ['olho', '--help'],
      ]) {
        const r = rodar(jogo, args)
        assert.equal(r.status, 0, `${args.join(' ')}\n${r.stderr}`)
        assert.match(r.stdout, /^uso: jogo /)
        assert.deepEqual(foto(jogo), antes, `escreveu com: ${args.join(' ')}`)
      }
    } finally {
      rmSync(jogo, { recursive: true, force: true })
    }
  })

  test('--apenas com id fora da lista sai 1 e não escreve', async () => {
    const jogo = await jogoFalso()
    try {
      const antes = foto(jogo)
      const r = rodar(jogo, ['assets', 'importar', '--apenas=palmeira,palmeria'])
      assert.equal(r.status, 1, r.stdout + r.stderr)
      assert.match(r.stderr, /--apenas: o id "palmeria" não está em assets\/importar\.json/)
      assert.deepEqual(foto(jogo), antes)
    } finally {
      rmSync(jogo, { recursive: true, force: true })
    }
  })

  test('--apenas=palmeira importa só a palmeira (a pedra, sem fonte, nem é tocada)', async () => {
    const jogo = await jogoFalso()
    try {
      const r = rodar(jogo, ['assets', 'importar', '--apenas=palmeira'])
      assert.equal(r.status, 0, r.stdout + r.stderr)
      assert.match(r.stdout, /ok {2}palmeira {2}public\/games\/x\/palmeira\.glb/)
      assert.match(r.stdout, /1 modelo\(s\) importado\(s\)/)
      assert.ok(existsSync(join(jogo, 'public/games/x/palmeira.glb')))
      assert.equal(existsSync(join(jogo, 'public/games/x/pedra.glb')), false)
      assert.match(readFileSync(join(jogo, 'ASSETS.md'), 'utf8'), /palmeira\.glb/)
    } finally {
      rmSync(jogo, { recursive: true, force: true })
    }
  })
})

describe('os outros comandos, pelo CLI', () => {
  test('check e olho recusam opção desconhecida antes de rodar', () => {
    const vazia = mkdtempSync(join(tmpdir(), 'jogo-cli-'))
    try {
      for (const args of [
        ['check', '--jsno'],
        ['check', '--sdk=1'],
        ['olho', 'g1', '--porta=9'],
      ]) {
        const r = rodar(vazia, args)
        assert.equal(r.status, 2, `${args.join(' ')}\n${r.stdout}${r.stderr}`)
        assert.equal(r.stdout, '')
      }
      assert.deepEqual(readdirSync(vazia), [])
    } finally {
      rmSync(vazia, { recursive: true, force: true })
    }
  })
})
