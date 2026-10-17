// Teste de mutação das réguas do `jogo check`: quebra cada regra de propósito e confere
// que a suíte reprova. Check que nunca reprovou não é check.
//   node test/mutantes.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ALVO = fileURLToPath(new URL('../src/verificacao.js', import.meta.url))
const MODELOS = fileURLToPath(new URL('../src/modelos.js', import.meta.url))
const GRAFICO = fileURLToPath(new URL('../src/grafico.js', import.meta.url))
const SOM = fileURLToPath(new URL('../src/som.js', import.meta.url))
const CARGA = fileURLToPath(new URL('../src/carga.js', import.meta.url))
const MUTANTES = [
  [
    'som: o golpe não sai do grafo',
    (t) => t.replace('fonte.onended = () => soltar(fonte, g, panner)', ''),
    SOM,
  ],
  [
    'som: o laço pedido não liga',
    (t) => t.replace('if (!l.vivo) l.vivo = ligarLaco(nome, l)', ''),
    SOM,
  ],
  [
    'som: preparar não decodifica',
    (t) =>
      t.replace(
        'carregando = decodificarCom(new Offline(2, 44100, 44100))',
        'carregando = Promise.resolve()',
      ),
    SOM,
  ],
  [
    'carga: falha segura a tela',
    (t) =>
      t.replace(
        '.catch(() => null)\n        .then(() => {\n          etapas.set(nome, true)',
        '.then(() => {\n          etapas.set(nome, true)',
      ),
    CARGA,
  ],
  [
    'carga: o número desce',
    (t) =>
      t.replace('visto = Math.max(visto, lista.length ? p : 0)', 'visto = lista.length ? p : 0'),
    CARGA,
  ],
  [
    'celular volta para o médio',
    (t) => t.replace('if (modoLeve || toque) return', 'if (modoLeve) return'),
    GRAFICO,
  ],
  [
    'desfoque: a força do painel ignorada',
    (t) => t.replace('const k = escalaDoDesfoque(novo)', 'const k = 1'),
    GRAFICO,
  ],
  [
    'desfoque: o do jogo ignorado',
    (t) => t.replace('focoDoJogo.aperture * k', 'FOCO.aperture * k'),
    GRAFICO,
  ],
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
  [
    'cenário: repetição ignorada',
    (t) => t.replace('c.repeat.set(rx, ry)', 'c.repeat.set(1, 1)'),
    MODELOS,
  ],
  [
    'cenário: modelo fora do chão',
    (t) => t.replace('-caixa.min.y, -centro.z', '0, -centro.z'),
    MODELOS,
  ],
  [
    'cenário: céu ignora o perfil',
    (t) => t.replace('caminhoDoPerfil(hdr, perfil)', 'caminhoDoPerfil(hdr, PERFIS.alto)'),
    MODELOS,
  ],
]

const originais = new Map(
  [ALVO, MODELOS, GRAFICO, SOM, CARGA].map((a) => [a, readFileSync(a, 'utf8')]),
)
const SUITE = new Map([
  [ALVO, 'test/verificacao.test.js'],
  [MODELOS, 'test/cenario.test.js'],
  [GRAFICO, 'test/grafico.test.js'],
  [SOM, 'test/som.test.js'],
  [CARGA, 'test/carga.test.js'],
])
let vivos = 0
try {
  for (const [nome, mutar, alvo = ALVO] of MUTANTES) {
    const original = originais.get(alvo)
    const mutado = mutar(original)
    if (mutado === original) {
      console.log(`NÃO APLICOU  ${nome}`)
      vivos++
      continue
    }
    writeFileSync(alvo, mutado)
    const r = spawnSync(process.execPath, ['--test', SUITE.get(alvo)], {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      encoding: 'utf8',
    })
    writeFileSync(alvo, original)
    const morto = r.status !== 0
    if (!morto) vivos++
    console.log(`${morto ? 'morto       ' : 'SOBREVIVEU  '} ${nome}`)
  }
} finally {
  for (const [a, o] of originais) writeFileSync(a, o)
}
console.log(
  vivos ? `\n${vivos} mutante(s) vivo(s).` : `\nok, os ${MUTANTES.length} mutantes morreram.`,
)
process.exit(vivos ? 1 : 0)
