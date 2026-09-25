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
  const problemas = []
  for (const a of arquivos) {
    const linha = declarados.get(a)
    if (!linha) {
      problemas.push(`${a} sem linha no ASSETS.md (caminho | licença | origem)`)
      continue
    }
    if (!LICENCAS_DE_ASSET.includes(linha[1])) {
      problemas.push(`${a} com licença "${linha[1]}", fora de ${LICENCAS_DE_ASSET.join(', ')}`)
    }
    if (!linha[2]) problemas.push(`${a} sem origem`)
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
    )
  }
  return secoes
}
