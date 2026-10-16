// Teste de mutação das réguas do `jogo check`: quebra cada regra de propósito e confere
// que a suíte reprova. Check que nunca reprovou não é check.
//   node test/mutantes.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ALVO = fileURLToPath(new URL('../src/verificacao.js', import.meta.url))
const MUTANTES = [
  ['teto do baixo desligado', (t) => t.replace('if (baixo > teto.baixo * MB)', 'if (false)')],
  ['teto do alto desligado', (t) => t.replace('if (total > teto.alto * MB)', 'if (false)')],
  ['alto/ conta no baixo', (t) => t.replace(".split('/').includes('alto')", '.length < 0')],
  ['Fab cru aceito', (t) => t.replace("!caminho.endsWith('.pak')", 'false')],
  [
    'Fab em jogo aberto aceito',
    (t) => t.replace("temFab && licencaDoPacote(raiz) !== 'UNLICENSED'", 'false'),
  ],
  ['licença do Fab não reconhecida', (t) => t.replace('/\\bfab\\b/i', '/\\bnunca\\b/')],
  ['SHA ignorado', (t) => t.replace('if (atual !== linha[3].toLowerCase())', 'if (false)')],
  [
    'seção do peso fora do check',
    (t) => t.replace('problemas: conferirPeso(raiz)', 'problemas: []'),
  ],
  ['seção do Fab fora do check', (t) => t.replace('problemas: conferirFab(raiz)', 'problemas: []')],
]

const original = readFileSync(ALVO, 'utf8')
let vivos = 0
try {
  for (const [nome, mutar] of MUTANTES) {
    const mutado = mutar(original)
    if (mutado === original) {
      console.log(`NÃO APLICOU  ${nome}`)
      vivos++
      continue
    }
    writeFileSync(ALVO, mutado)
    const r = spawnSync(process.execPath, ['--test', 'test/verificacao.test.js'], {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      encoding: 'utf8',
    })
    const morto = r.status !== 0
    if (!morto) vivos++
    console.log(`${morto ? 'morto       ' : 'SOBREVIVEU  '} ${nome}`)
  }
} finally {
  writeFileSync(ALVO, original)
}
console.log(
  vivos ? `\n${vivos} mutante(s) vivo(s).` : `\nok, os ${MUTANTES.length} mutantes morreram.`,
)
process.exit(vivos ? 1 : 0)
