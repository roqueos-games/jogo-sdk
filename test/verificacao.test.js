// O `jogo check` de ponta a ponta: o CLI de verdade, num repo de verdade copiado
// para uma pasta temporária e quebrado de um jeito por teste. Cada caso é um
// defeito que precisa reprovar; um check que nunca reprovou não é check.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  appendFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const CLI = fileURLToPath(new URL('../bin/jogo.mjs', import.meta.url))
const OK = fileURLToPath(new URL('./fixtures/jogo-ok', import.meta.url))
const SDK = fileURLToPath(new URL('..', import.meta.url))

function check(pasta, ...flags) {
  const r = spawnSync(process.execPath, [CLI, 'check', pasta, ...flags], { encoding: 'utf8' })
  return { codigo: r.status, saida: r.stdout + r.stderr }
}

/** Copia o jogo de exemplo, aplica o defeito e roda o check. */
function comDefeito(defeito, ...flags) {
  const pasta = mkdtempSync(join(tmpdir(), 'jogo-'))
  try {
    cpSync(OK, pasta, { recursive: true })
    defeito(pasta)
    return check(pasta, ...flags)
  } finally {
    rmSync(pasta, { recursive: true, force: true })
  }
}

const editarJson = (arquivo, fn) => {
  const v = JSON.parse(readFileSync(arquivo, 'utf8'))
  fn(v)
  writeFileSync(arquivo, JSON.stringify(v))
}

describe('jogo check', () => {
  test('o jogo de exemplo passa', () => {
    const r = check(OK)
    assert.equal(r.codigo, 0, r.saida)
    assert.match(r.saida, /ok, o repo cumpre o contrato/)
  })

  test('o próprio SDK passa no modo --sdk', () => {
    const r = check(SDK, '--sdk')
    assert.equal(r.codigo, 0, r.saida)
  })

  test('chave faltando num idioma reprova e nomeia o idioma', () => {
    const r = comDefeito((p) => editarJson(join(p, 'i18n/ar-AR.json'), (v) => delete v.menu.sair))
    assert.equal(r.codigo, 1)
    assert.match(r.saida, /i18n\/ar-AR\.json sem: menu\.sair/)
  })

  test('idioma inteiro faltando reprova', () => {
    const r = comDefeito((p) => rmSync(join(p, 'i18n/hi-IN.json')))
    assert.match(r.saida, /i18n\/hi-IN\.json ausente/)
  })

  test('texto vazio reprova', () => {
    const r = comDefeito((p) => editarJson(join(p, 'i18n/ja-JP.json'), (v) => (v.titulo = ' ')))
    assert.match(r.saida, /ja-JP\.json com texto vazio em: titulo/)
  })

  test('asset sem linha no ASSETS.md reprova', () => {
    const r = comDefeito((p) => writeFileSync(join(p, 'public/modelo.glb'), 'x'))
    assert.equal(r.codigo, 1)
    assert.match(r.saida, /public\/modelo\.glb sem linha no ASSETS\.md/)
  })

  test('asset com licença fora da lista reprova', () => {
    const r = comDefeito((p) => {
      writeFileSync(join(p, 'public/carro.glb'), 'x')
      appendFileSync(
        join(p, 'ASSETS.md'),
        '| `public/carro.glb` | Sketchfab Standard | sketchfab.com |\n',
      )
    })
    assert.match(r.saida, /licença "Sketchfab Standard"/)
  })

  test('jogo fechado aceita asset com licença de terceiro, mas não sem licença', () => {
    const fechar = (p, licenca) => {
      editarJson(join(p, 'package.json'), (v) => (v.license = 'UNLICENSED'))
      writeFileSync(join(p, 'public/corredor.glb'), 'x')
      appendFileSync(
        join(p, 'ASSETS.md'),
        `| \`public/corredor.glb\` | ${licenca} | Mixamo, personagem Vanguard |\n`,
      )
    }
    const comTerceiro = comDefeito((p) => fechar(p, 'Mixamo (termos de uso da Adobe)'))
    assert.equal(comTerceiro.codigo, 0, comTerceiro.saida)
    assert.match(comDefeito((p) => fechar(p, 'desconhecida')).saida, /corredor\.glb sem licença/)
    assert.match(comDefeito((p) => fechar(p, '?')).saida, /corredor\.glb sem licença/)
    // O mesmo asset num jogo aberto continua reprovando.
    const aberto = comDefeito((p) => {
      writeFileSync(join(p, 'public/corredor.glb'), 'x')
      appendFileSync(join(p, 'ASSETS.md'), '| `public/corredor.glb` | Mixamo | Mixamo |\n')
    })
    assert.match(aberto.saida, /licença "Mixamo"/)
  })

  test('script que roda sozinho no install reprova, no jogo e no SDK', () => {
    const quebrar = (p) => editarJson(join(p, 'package.json'), (v) => (v.scripts.prepare = 'husky'))
    assert.match(comDefeito(quebrar).saida, /"prepare"/)
    assert.equal(comDefeito(quebrar, '--sdk').codigo, 1)
  })

  test('capa apontando para arquivo que não existe reprova', () => {
    const r = comDefeito((p) =>
      editarJson(join(p, 'jogo.json'), (v) => (v.capa = 'public/nao-existe.jpg')),
    )
    assert.match(r.saida, /capa aponta para public\/nao-existe\.jpg/)
  })

  test('manifesto ausente reprova', () => {
    const r = comDefeito((p) => rmSync(join(p, 'jogo.json')))
    assert.match(r.saida, /jogo\.json ausente/)
  })

  test('--json devolve as seções para encadear', () => {
    const r = spawnSync(process.execPath, [CLI, 'check', OK, '--json'], { encoding: 'utf8' })
    const saida = JSON.parse(r.stdout)
    assert.equal(saida.ok, true)
    assert.deepEqual(
      saida.secoes.map((s) => s.secao),
      [
        'scripts de instalação',
        'manifesto',
        'textos nos dez idiomas',
        'origem dos assets',
        'o jogo não fala com banco',
      ],
    )
  })

  // O jogo não fala com banco; quem fala é o host. Estava escrito no motivo
  // da sala desde a 0.2.0, e nada impedia.
  test("import 'firebase/database' no src/ reprova, com o arquivo, a linha e o porquê", () => {
    const r = comDefeito((p) =>
      writeFileSync(
        join(p, 'src/sala.js'),
        "// a sala do jogo\n\nimport { ref, set } from 'firebase/database'\nexport const x = 1\n",
      ),
    )
    assert.equal(r.codigo, 1, r.saida)
    assert.match(r.saida, /REPROVOU {2}o jogo não fala com banco/)
    assert.match(
      r.saida,
      /src\/sala\.js:3 importa "firebase\/database": o jogo não fala com banco, quem fala é o host/,
    )
  })

  test('todo jeito de trazer o Firebase reprova, em qualquer arquivo de código do src/', () => {
    const jeitos = {
      'a.js': "import 'firebase/database'",
      'b.mjs': "export { getDoc } from 'firebase/firestore'",
      'c.ts': "const db = await import('firebase/database')",
      'd.cjs': "const fb = require('firebase')",
      'fundo/e.vue': "<script setup>\nimport { getApp } from 'firebase/app'\n</script>",
      'f.js': 'import { ref } from "@firebase/database"',
      'g.jsx': 'const m = import(`firebase/storage`)',
    }
    const r = comDefeito((p) => {
      mkdirSync(join(p, 'src/fundo'), { recursive: true })
      for (const [arquivo, codigo] of Object.entries(jeitos)) {
        writeFileSync(join(p, 'src', arquivo), `${codigo}\n`)
      }
    })
    assert.equal(r.codigo, 1)
    for (const arquivo of Object.keys(jeitos)) {
      assert.match(r.saida, new RegExp(`src/${arquivo.replace('.', '\\.')}:\\d+ importa`), arquivo)
    }
  })

  test('o que não é o Firebase passa: comentário, texto, nome parecido, arquivo fora do src', () => {
    const r = comDefeito((p) => {
      writeFileSync(
        join(p, 'src/limpo.js'),
        [
          "// import { ref } from 'firebase/database'  (era assim antes da extração)",
          "/* import 'firebase/firestore' */",
          "const doc = 'veja https://firebase.google.com // não é import'",
          "import { algo } from './firebase.js'",
          "import admin from 'firebase-admin-mock'",
          'export { doc, algo, admin }',
        ].join('\n'),
      )
      writeFileSync(join(p, 'vite.config.js'), "import 'firebase/database'\n")
      writeFileSync(join(p, 'src/notas.md'), "import 'firebase/database'\n")
    })
    assert.equal(r.codigo, 0, r.saida)
  })

  test('comando desconhecido explica o uso', () => {
    const r = spawnSync(process.execPath, [CLI, 'publicar'], { encoding: 'utf8' })
    assert.equal(r.status, 2)
    assert.match(r.stderr, /uso: jogo check/)
  })
})
