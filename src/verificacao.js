// O QUE O `jogo check` CONFERE NUM REPO.
//
// Cada verificação existe por um motivo que já custou caro em algum lugar da
// família. Ficam aqui, e não no CI de cada jogo, porque vinte cópias de um
// check divergem em três meses; uma chamada não.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { IDIOMAS, IDIOMA_CANONICO } from './idiomas.js'
import { validarManifesto } from './manifesto.js'

/**
 * Scripts que o npm e o yarn rodam sozinhos no `install`. O RoqueOS instala o
 * jogo como dependência; um desses scripts num jogo aberto rodaria na máquina
 * do founder a cada `yarn install`. `prepare` entra porque o yarn roda ele em
 * dependência git.
 */
export const SCRIPTS_DE_INSTALACAO = Object.freeze([
  'preinstall',
  'install',
  'postinstall',
  'prepare',
  'prepack',
  'postpack',
])

/** Licenças que um asset pode ter para entrar num jogo aberto. */
export const LICENCAS_DE_ASSET = Object.freeze([
  'CC0-1.0',
  'CC-BY-4.0',
  'MIT',
  'BSD-3-Clause',
  'autoral',
])

const lerJson = (arquivo) => JSON.parse(readFileSync(arquivo, 'utf8'))

export function conferirScriptsDeInstalacao(raiz) {
  const arquivo = join(raiz, 'package.json')
  if (!existsSync(arquivo)) return ['package.json ausente']
  const scripts = lerJson(arquivo).scripts ?? {}
  return SCRIPTS_DE_INSTALACAO.filter((s) => s in scripts).map(
    (s) => `package.json declara "${s}", que roda sozinho no install de quem depende deste pacote`,
  )
}

/** As chaves-folha de um objeto de textos, como caminhos: `menu.jogar`. */
export function chavesFolha(obj, prefixo = '') {
  const saida = []
  for (const [k, v] of Object.entries(obj ?? {})) {
    const caminho = prefixo ? `${prefixo}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) saida.push(...chavesFolha(v, caminho))
    else saida.push(caminho)
  }
  return saida
}

export function conferirTextos(raiz) {
  const pasta = join(raiz, 'i18n')
  if (!existsSync(pasta)) return ['i18n/ ausente: o texto do jogo mora no jogo, um JSON por idioma']
  const problemas = []
  const base = join(pasta, `${IDIOMA_CANONICO}.json`)
  if (!existsSync(base)) return [`i18n/${IDIOMA_CANONICO}.json ausente: pt-BR é o idioma canônico`]
  const canonicas = new Set(chavesFolha(lerJson(base)))
  for (const idioma of IDIOMAS) {
    const arquivo = join(pasta, `${idioma}.json`)
    if (!existsSync(arquivo)) {
      problemas.push(`i18n/${idioma}.json ausente`)
      continue
    }
    const conteudo = lerJson(arquivo)
    const chaves = new Set(chavesFolha(conteudo))
    const faltando = [...canonicas].filter((c) => !chaves.has(c))
    const sobrando = [...chaves].filter((c) => !canonicas.has(c))
    if (faltando.length)
      problemas.push(
        `i18n/${idioma}.json sem: ${faltando.slice(0, 5).join(', ')}${faltando.length > 5 ? ` (+${faltando.length - 5})` : ''}`,
      )
    if (sobrando.length)
      problemas.push(
        `i18n/${idioma}.json com chave que o pt-BR não tem: ${sobrando.slice(0, 5).join(', ')}`,
      )
    const vazias = chavesFolha(conteudo).filter((c) => {
      const v = c.split('.').reduce((o, k) => o?.[k], conteudo)
      return typeof v !== 'string' || v.trim() === ''
    })
    if (vazias.length)
      problemas.push(`i18n/${idioma}.json com texto vazio em: ${vazias.slice(0, 5).join(', ')}`)
  }
  return problemas
}

function arquivosDe(pasta) {
  if (!existsSync(pasta)) return []
  const saida = []
  for (const nome of readdirSync(pasta)) {
    if (nome.startsWith('.')) continue
    const p = join(pasta, nome)
    if (statSync(p).isDirectory()) saida.push(...arquivosDe(p))
    else saida.push(p)
  }
  return saida
}

function licencaDoPacote(raiz) {
  try {
    return lerJson(join(raiz, 'package.json')).license ?? null
  } catch {
    return null
  }
}

/**
 * Cada arquivo em `public/` precisa de uma linha no ASSETS.md com a licença e
 * a origem. Custou: um modelo 3D de pacote comercial e animações de terceiro
 * foram parar num jogo sem ninguém saber de onde vinham, e um jogo aberto
 * publica o arquivo para o mundo.
 */
export function conferirAssets(raiz) {
  const arquivos = arquivosDe(join(raiz, 'public')).map((p) =>
    relative(raiz, p).split(sep).join('/'),
  )
  if (arquivos.length === 0) return []
  const ledger = join(raiz, 'ASSETS.md')
  if (!existsSync(ledger)) return [`ASSETS.md ausente, e public/ tem ${arquivos.length} arquivo(s)`]
  const linhas = readFileSync(ledger, 'utf8')
    .split('\n')
    .filter((l) => /^\|/.test(l) && !/^\|\s*-/.test(l))
    .map((l) =>
      l
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim().replace(/`/g, '')),
    )
  const declarados = new Map(linhas.filter((c) => c.length >= 3).map((c) => [c[0], c]))
  // Jogo fechado (`license: UNLICENSED`) não publica o arquivo para o mundo, então pode
  // levar asset de terceiro com licença de uso fora da lista (ex.: personagem do Mixamo).
  // Continua obrigado a dizer qual licença e de onde veio: o que não pode é não saber.
  const fechado = licencaDoPacote(raiz) === 'UNLICENSED'
  const problemas = []
  for (const a of arquivos) {
    const linha = declarados.get(a)
    if (!linha) {
      problemas.push(`${a} sem linha no ASSETS.md (caminho | licença | origem)`)
      continue
    }
    if (fechado) {
      if (!linha[1] || /^(\?|desconhecida)$/i.test(linha[1])) {
        problemas.push(
          `${a} sem licença: jogo fechado aceita licença de terceiro, mas não "não sei"`,
        )
      }
    } else if (!LICENCAS_DE_ASSET.includes(linha[1])) {
      problemas.push(`${a} com licença "${linha[1]}", fora de ${LICENCAS_DE_ASSET.join(', ')}`)
    }
    if (!linha[2]) problemas.push(`${a} sem origem`)
  }
  return problemas
}

/** As extensões de código que o `jogo check` lê no `src/` de um jogo. */
const CODIGO = /\.(m?js|cjs|jsx|mts|cts|tsx?|vue|svelte)$/

/**
 * O código sem os comentários, com as quebras de linha preservadas para o
 * número da linha continuar certo. Respeita texto entre aspas e crases: um
 * 'https://…' não é comentário. Um import comentado não é import.
 */
export function semComentarios(codigo) {
  let saida = ''
  let i = 0
  while (i < codigo.length) {
    const c = codigo[i]
    const d = codigo[i + 1]
    if (c === '/' && d === '/') {
      while (i < codigo.length && codigo[i] !== '\n') i++
    } else if (c === '/' && d === '*') {
      i += 2
      while (i < codigo.length && !(codigo[i] === '*' && codigo[i + 1] === '/')) {
        if (codigo[i] === '\n') saida += '\n'
        i++
      }
      i += 2
    } else if (c === "'" || c === '"' || c === '`') {
      saida += c
      i++
      while (i < codigo.length && codigo[i] !== c) {
        if (codigo[i] === '\\') {
          saida += codigo[i]
          i++
        }
        if (i < codigo.length) saida += codigo[i]
        i++
      }
      if (i < codigo.length) saida += codigo[i]
      i++
    } else {
      saida += c
      i++
    }
  }
  return saida
}

// Os jeitos de um módulo entrar: import/export … from, import 'x',
// import('x') e require('x').
const FORMAS_DE_IMPORTAR = [
  /\bfrom\s*(['"])([^'"\n]+)\1/g,
  /\bimport\s*(['"])([^'"\n]+)\1/g,
  /\bimport\s*\(\s*(['"`])([^'"`\n]+)\1/g,
  /\brequire\s*\(\s*(['"`])([^'"`\n]+)\1/g,
]

/** `firebase`, `firebase/<qualquer coisa>` e os pacotes `@firebase/*` que ele reexporta. */
export const ehFirebase = (especificador) =>
  especificador === 'firebase' ||
  especificador.startsWith('firebase/') ||
  especificador.startsWith('@firebase/')

/**
 * O jogo não fala com banco: quem fala é o host (`salaAoVivo`, `progresso`,
 * `placar`, `sala`). Estava escrito no motivo da `sala` desde a 0.2.0 e nada
 * impedia um jogo de pôr o `firebase` no package.json e importar; a régua do
 * front só conferia se o import estava declarado. Jogo que importa o Firebase
 * leva a configuração do projeto e as regras do banco para dentro dele, e
 * quebra no dia em que o host muda de banco.
 */
export function conferirBanco(raiz) {
  const problemas = []
  for (const arquivo of arquivosDe(join(raiz, 'src'))) {
    if (!CODIGO.test(arquivo)) continue
    const codigo = semComentarios(readFileSync(arquivo, 'utf8'))
    const achados = new Map()
    for (const forma of FORMAS_DE_IMPORTAR) {
      for (const achado of codigo.matchAll(forma)) {
        if (ehFirebase(achado[2]) && !achados.has(achado.index)) {
          achados.set(achado.index, achado[2])
        }
      }
    }
    const onde = relative(raiz, arquivo).split(sep).join('/')
    for (const [posicao, especificador] of [...achados].sort((a, b) => a[0] - b[0])) {
      const linha = codigo.slice(0, posicao).split('\n').length
      problemas.push(
        `${onde}:${linha} importa "${especificador}": o jogo não fala com banco, quem fala é o host (salaAoVivo, progresso, placar, sala)`,
      )
    }
  }
  return problemas
}

export function conferirManifesto(raiz) {
  const arquivo = join(raiz, 'jogo.json')
  if (!existsSync(arquivo)) return ['jogo.json ausente']
  let m
  try {
    m = lerJson(arquivo)
  } catch (e) {
    return [`jogo.json não é JSON válido: ${e.message}`]
  }
  const problemas = validarManifesto(m).map((p) => `jogo.json: ${p}`)
  for (const campo of ['capa', 'icone']) {
    if (typeof m[campo] === 'string' && !existsSync(join(raiz, m[campo]))) {
      problemas.push(`jogo.json: ${campo} aponta para ${m[campo]}, que não existe`)
    }
  }
  return problemas
}

/**
 * Tudo o que se confere num repo. `sdk` é o próprio SDK, que não é jogo:
 * nele só vale a regra dos scripts de instalação.
 * @returns {{ secao: string, problemas: string[] }[]}
 */
export function verificarRepo(raiz, { sdk = false } = {}) {
  const secoes = [{ secao: 'scripts de instalação', problemas: conferirScriptsDeInstalacao(raiz) }]
  if (!sdk) {
    secoes.push(
      { secao: 'manifesto', problemas: conferirManifesto(raiz) },
      { secao: 'textos nos dez idiomas', problemas: conferirTextos(raiz) },
      { secao: 'origem dos assets', problemas: conferirAssets(raiz) },
      { secao: 'o jogo não fala com banco', problemas: conferirBanco(raiz) },
    )
  }
  return secoes
}
