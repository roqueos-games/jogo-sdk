// `jogo assets importar`: de um modelo de mercado para o GLB que o jogo serve, com a
// origem fixada (desde 0.4.0, Goal 80). É o caminho do tools/kit-import do Call of Roque e
// da Agentolandia, sem TypeScript e para qualquer jogo da organização.
//
// Lista em `assets/importar.json`:
//   { "itens": [ { "id": "palmeira", "saida": "public/games/farol/modelos/palmeira.glb",
//       "licenca": "CC0-1.0", "origem": "https://polyhaven.com/a/...",
//       "fonte": { "polyhaven": "...", "resolucao": "1k" }          // baixa pela API
//            ou { "arquivo": ".local/asset-source/x.fbx" }          // baixado à mão (Sketchfab, Fab, Mixamo)
//       "texturaMax": 1024, "simplificar": 0.5, "manter": "^Tronco|^Folha",
//       "texturasFora": true } ] }     // .gltf + .bin + .webp ao lado, para o iPhone (ver abaixo)
//
// Saídas:
// - o GLB comprimido (EXT_meshopt_compression, texturas WebP) em `saida`;
// - `assets/source-lock.json`: URL, bytes e SHA-256 de cada original. Original trocado na
//   origem para o import, em vez de entrar calado;
// - a linha do arquivo no ASSETS.md, com a quarta coluna de SHA-256 que o `jogo check` confere.
//
// As dependências pesadas (gltf-transform, meshoptimizer, sharp) são do jogo, em
// devDependencies: o SDK é instalado pelo RoqueOS e não pode arrastar o sharp para lá.

import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path'

export const sha256 = (dados) => createHash('sha256').update(dados).digest('hex')

/** Caminho dentro de `base`, nunca fora: o nome vem de uma API de terceiros ou de um JSON. */
export function dentro(base, caminho) {
  const alvo = resolve(base, caminho)
  const rel = relative(base, alvo)
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel))
    throw new Error(`caminho inseguro: ${caminho}`)
  return alvo
}

/** O que o importador sabe trazer: modelo (GLB/glTF), textura PBR e céu HDR da Poly Haven. */
export const TIPOS = Object.freeze(['modelo', 'textura', 'hdri'])

/** Valida a lista antes de baixar qualquer coisa: erro de digitação não gasta download. */
export function validarLista(lista) {
  const problemas = []
  const ids = new Set()
  for (const [i, item] of (lista?.itens ?? []).entries()) {
    const onde = item?.id ? `item "${item.id}"` : `item ${i}`
    if (!item?.id) problemas.push(`${onde}: sem id`)
    else if (ids.has(item.id)) problemas.push(`${onde}: id repetido`)
    ids.add(item?.id)
    const tipo = item?.tipo ?? 'modelo'
    if (!TIPOS.includes(tipo)) problemas.push(`${onde}: tipo "${tipo}" fora de ${TIPOS.join(', ')}`)
    if (tipo === 'modelo') {
      const extensao = item?.texturasFora ? '.gltf' : '.glb'
      if (!item?.saida?.startsWith('public/') || !item.saida.endsWith(extensao))
        problemas.push(
          `${onde}: saida precisa ser um ${extensao} dentro de public/${item?.texturasFora ? ' (texturasFora escreve .gltf, .bin e as texturas ao lado)' : ''}`,
        )
    } else if (tipo === 'hdri') {
      if (!item?.saida?.startsWith('public/') || !item.saida.endsWith('.hdr'))
        problemas.push(`${onde}: saida de hdri precisa ser um .hdr dentro de public/`)
    } else if (!item?.saida?.startsWith('public/') || /\.\w+$/.test(item.saida)) {
      problemas.push(
        `${onde}: saida de textura é uma pasta dentro de public/ (cor, normal e arm vão nela)`,
      )
    }
    if (tipo !== 'modelo' && !item?.fonte?.polyhaven)
      problemas.push(`${onde}: ${tipo} vem da Poly Haven (fonte.polyhaven)`)
    if (!item?.licenca) problemas.push(`${onde}: sem licença`)
    if (!item?.origem) problemas.push(`${onde}: sem origem (a página de onde veio)`)
    const f = item?.fonte ?? {}
    if (!f.polyhaven === !f.arquivo)
      problemas.push(`${onde}: fonte precisa de polyhaven OU arquivo`)
    if (/\bfab\b/i.test(item?.licenca ?? ''))
      problemas.push(`${onde}: asset do Fab não sai cru, vai num .pak cifrado`)
  }
  if (!lista?.itens?.length) problemas.push('assets/importar.json sem itens')
  return problemas
}

/** Troca ou acrescenta a linha do arquivo na tabela do ASSETS.md, com o SHA na quarta coluna. */
export function registrarNoLedger(texto, { caminho, licenca, origem, sha }) {
  const linha = `| \`${caminho}\` | ${licenca} | ${origem} | ${sha} |`
  const linhas = texto.split('\n')
  const i = linhas.findIndex(
    (l) => l.startsWith(`| \`${caminho}\` |`) || l.startsWith(`| ${caminho} |`),
  )
  if (i >= 0) {
    linhas[i] = linha
    return linhas.join('\n')
  }
  // Depois da última linha de tabela, para cair na tabela que já existe.
  let ultima = -1
  linhas.forEach((l, j) => {
    if (l.startsWith('|')) ultima = j
  })
  if (ultima < 0)
    return `${texto.trimEnd()}\n\n| Caminho | Licença | Origem | SHA-256 |\n| --- | --- | --- | --- |\n${linha}\n`
  linhas.splice(ultima + 1, 0, linha)
  return linhas.join('\n')
}

/** Importa do `node_modules` do jogo, não do SDK. */
async function doJogo(raiz, nome) {
  // Tudo pelo `require` do jogo: o gltf-transform guarda o Document num registro por
  // instância, e misturar a cópia ESM com a CJS deixa o `weld` sem documento.
  const require = createRequire(join(raiz, 'package.json'))
  try {
    require.resolve(nome)
  } catch {
    throw new Error(
      `falta ${nome} no jogo: yarn add -D @gltf-transform/core@4.5.1 @gltf-transform/extensions@4.5.1 @gltf-transform/functions@4.5.1 meshoptimizer@1.1.1 sharp@0.35.4`,
    )
  }
  return require(nome)
}

async function baixarFixado(trava, chave, url, destino) {
  let dados = existsSync(destino) ? readFileSync(destino) : null
  for (let tentativa = 0; !dados && tentativa < 3; tentativa++) {
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': 'roqueos-jogo-sdk/0.4' },
        signal: AbortSignal.timeout(300000),
      })
      if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`)
      dados = Buffer.from(await r.arrayBuffer())
      mkdirSync(dirname(destino), { recursive: true })
      writeFileSync(destino, dados)
    } catch (e) {
      if (tentativa === 2) throw e
    }
  }
  conferirTrava(trava, chave, { url, bytes: dados.length, sha256: sha256(dados) })
  return destino
}

/** Original que mudou na origem para o import: troca calada de arte é o que perde a licença. */
export function conferirTrava(trava, chave, registro) {
  const antes = trava[chave]
  if (
    antes &&
    (antes.sha256 !== registro.sha256 || (antes.url && registro.url && antes.url !== registro.url))
  ) {
    throw new Error(
      `a fonte fixada mudou: ${chave} (era ${antes.sha256.slice(0, 12)}…, veio ${registro.sha256.slice(0, 12)}…)`,
    )
  }
  trava[chave] = registro
}

/** FBX, OBJ e .blend passam pelo Blender sem janela; GLB e glTF entram direto. */
export function blender() {
  const candidatos = [
    process.env.BLENDER,
    '/Applications/Blender.app/Contents/MacOS/Blender',
    'blender',
  ]
  for (const c of candidatos.filter(Boolean)) {
    const r = spawnSync(c, ['--version'], { encoding: 'utf8' })
    if (r.status === 0) return c
  }
  throw new Error('modelo FBX/OBJ/.blend precisa do Blender: instale ou aponte BLENDER=')
}

const SCRIPT_BLENDER = `
import bpy, sys
entrada, saida = sys.argv[sys.argv.index('--') + 1:][:2]
bpy.ops.wm.read_factory_settings(use_empty=True)
ext = entrada.lower().rsplit('.', 1)[-1]
if ext == 'fbx': bpy.ops.import_scene.fbx(filepath=entrada)
elif ext == 'obj': bpy.ops.wm.obj_import(filepath=entrada)
elif ext == 'blend': bpy.ops.wm.open_mainfile(filepath=entrada)
else: raise SystemExit('formato sem import: ' + ext)
bpy.ops.export_scene.gltf(filepath=saida, export_format='GLB', export_apply=True, export_animations=True)
`

function converterNoBlender(entrada) {
  const pasta = join(tmpdir(), `jogo-import-${process.pid}`)
  mkdirSync(pasta, { recursive: true })
  const script = join(pasta, 'converter.py')
  const saida = join(pasta, `${Date.now()}.glb`)
  writeFileSync(script, SCRIPT_BLENDER)
  const r = spawnSync(
    blender(),
    ['--background', '--factory-startup', '--python', script, '--', entrada, saida],
    {
      encoding: 'utf8',
    },
  )
  if (r.status !== 0 || !existsSync(saida))
    throw new Error(`o Blender não converteu ${entrada}:\n${(r.stderr || r.stdout).slice(-800)}`)
  return saida
}

async function fonteDoItem(raiz, item, trava) {
  const pastaFontes = join(raiz, '.local/asset-source')
  if (item.fonte.arquivo) {
    const arquivo = dentro(raiz, item.fonte.arquivo)
    if (!existsSync(arquivo))
      throw new Error(`${item.id}: ${item.fonte.arquivo} não existe (baixado à mão, fora do git)`)
    const dados = readFileSync(arquivo)
    conferirTrava(trava, `${item.id}/${item.fonte.arquivo.split('/').pop()}`, {
      url: item.origem,
      bytes: dados.length,
      sha256: sha256(dados),
    })
    return arquivo
  }
  const res = item.fonte.resolucao ?? '1k'
  const arquivos = await arquivosDaPolyHaven(item.fonte.polyhaven)
  const gltf = arquivos.gltf?.[res]?.gltf
  if (!gltf) throw new Error(`Poly Haven ${item.fonte.polyhaven}: sem glTF em ${res}`)
  const principal = await baixarFixado(
    trava,
    `${item.id}/${gltf.url.split('/').pop()}`,
    gltf.url,
    dentro(pastaFontes, `${item.id}/${gltf.url.split('/').pop()}`),
  )
  for (const [caminho, entrada] of Object.entries(gltf.include ?? {})) {
    await baixarFixado(
      trava,
      `${item.id}/${caminho}`,
      entrada.url,
      dentro(pastaFontes, `${item.id}/${caminho}`),
    )
  }
  return principal
}

async function arquivosDaPolyHaven(id) {
  const r = await fetch(`https://api.polyhaven.com/files/${encodeURIComponent(id)}`, {
    signal: AbortSignal.timeout(60000),
  })
  if (!r.ok) throw new Error(`Poly Haven ${id}: HTTP ${r.status}`)
  return r.json()
}

/**
 * Textura PBR da Poly Haven em três WebP: cor, normal (convenção OpenGL, a do three) e ARM
 * (oclusão, rugosidade e metal nos canais R, G e B, que o three lê do mesmo arquivo).
 */
async function importarTextura(raiz, item, trava, sharp) {
  const res = item.fonte.resolucao ?? '1k'
  const max = item.texturaMax ?? 1024
  const arquivos = await arquivosDaPolyHaven(item.fonte.polyhaven)
  const escritos = []
  for (const [canal, chave] of Object.entries({ cor: 'Diffuse', normal: 'nor_gl', arm: 'arm' })) {
    const entrada = arquivos[chave]?.[res]?.png ?? arquivos[chave]?.[res]?.jpg
    if (!entrada) throw new Error(`${item.id}: Poly Haven sem ${chave} em ${res}`)
    const ext = entrada.url.split('.').pop()
    const fonte = await baixarFixado(
      trava,
      `${item.id}/${canal}.${ext}`,
      entrada.url,
      dentro(join(raiz, '.local/asset-source'), `${item.id}/${canal}.${ext}`),
    )
    const caminho = `${item.saida.replace(/\/$/, '')}/${canal}.webp`
    const destino = dentro(raiz, caminho)
    mkdirSync(dirname(destino), { recursive: true })
    const reduzida = await sharp(fonte)
      .resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer()
    const dados = await sharp(reduzida)
      .webp(
        canal === 'normal'
          ? { quality: 60, nearLossless: true, effort: 6 }
          : { quality: 90, effort: 6 },
      )
      .toBuffer()
    writeFileSync(destino, dados)
    escritos.push({ caminho, dados })
  }
  return escritos
}

/** Céu HDR da Poly Haven, como veio: o three lê o .hdr pelo RGBELoader e o kit faz o PMREM. */
async function importarHdri(raiz, item, trava) {
  const res = item.fonte.resolucao ?? '1k'
  const arquivos = await arquivosDaPolyHaven(item.fonte.polyhaven)
  const entrada = arquivos.hdri?.[res]?.hdr
  if (!entrada) throw new Error(`${item.id}: Poly Haven sem hdri .hdr em ${res}`)
  const fonte = await baixarFixado(
    trava,
    `${item.id}/${res}.hdr`,
    entrada.url,
    dentro(join(raiz, '.local/asset-source'), `${item.id}/${res}.hdr`),
  )
  const dados = readFileSync(fonte)
  const destino = dentro(raiz, item.saida)
  mkdirSync(dirname(destino), { recursive: true })
  writeFileSync(destino, dados)
  return [{ caminho: item.saida, dados }]
}

function registrarEscritos(ledger, item, escritos) {
  let texto = existsSync(ledger) ? readFileSync(ledger, 'utf8') : '# Origem dos assets\n'
  for (const e of escritos) {
    texto = registrarNoLedger(texto, {
      caminho: e.caminho,
      licenca: item.licenca,
      origem: item.origem,
      sha: sha256(e.dados),
    })
  }
  writeFileSync(ledger, texto)
}

/** Importa a lista inteira (ou só `apenas`). Devolve um resumo por item. */
export async function importar(raiz, { apenas } = {}) {
  const lista = JSON.parse(readFileSync(join(raiz, 'assets/importar.json'), 'utf8'))
  const problemas = validarLista(lista)
  // Id que não está na lista é erro de digitação: recusa antes de escrever qualquer coisa,
  // em vez de importar zero itens e dizer "ok" (0.5.1).
  for (const id of apenas ?? [])
    if (!(lista?.itens ?? []).some((item) => item?.id === id))
      problemas.push(`--apenas: o id "${id}" não está em assets/importar.json`)
  if (problemas.length) throw new Error(problemas.join('\n'))
  const { NodeIO } = await doJogo(raiz, '@gltf-transform/core')
  const { ALL_EXTENSIONS } = await doJogo(raiz, '@gltf-transform/extensions')
  const fn = await doJogo(raiz, '@gltf-transform/functions')
  const { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } = await doJogo(raiz, 'meshoptimizer')
  // Fonte que já vem comprimida (um GLB que passou por outro importador) precisa do decoder.
  await MeshoptDecoder.ready
  const sharpDoJogo = await doJogo(raiz, 'sharp')
  const sharp = sharpDoJogo.default ?? sharpDoJogo
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder })

  const caminhoTrava = join(raiz, 'assets/source-lock.json')
  const trava = existsSync(caminhoTrava)
    ? (JSON.parse(readFileSync(caminhoTrava, 'utf8')).files ?? {})
    : {}
  const ledger = join(raiz, 'ASSETS.md')
  const resumo = []

  for (const item of lista.itens) {
    if (apenas && !apenas.includes(item.id)) continue
    if ((item.tipo ?? 'modelo') !== 'modelo') {
      const escritos =
        item.tipo === 'hdri'
          ? await importarHdri(raiz, item, trava)
          : await importarTextura(raiz, item, trava, sharp)
      registrarEscritos(ledger, item, escritos)
      mkdirSync(dirname(caminhoTrava), { recursive: true })
      writeFileSync(caminhoTrava, `${JSON.stringify({ files: trava }, null, 2)}\n`)
      resumo.push({
        id: item.id,
        saida: item.saida,
        bytes: escritos.reduce((n, e) => n + e.dados.length, 0),
        arquivos: escritos.length,
        triangulos: 0,
        sha: sha256(escritos[0].dados),
      })
      continue
    }
    let entrada = await fonteDoItem(raiz, item, trava)
    if (!['.glb', '.gltf'].includes(extname(entrada).toLowerCase()))
      entrada = converterNoBlender(entrada)
    const doc = await io.read(entrada)
    if (item.manter) {
      const manter = new RegExp(item.manter)
      for (const no of doc.getRoot().listNodes())
        if (no.getMesh() && !manter.test(no.getName())) no.dispose()
    }
    await doc.transform(fn.dedup(), fn.prune(), fn.weld())
    if (item.simplificar) {
      await MeshoptSimplifier.ready
      await doc.transform(
        fn.simplify({
          simplifier: MeshoptSimplifier,
          ratio: item.simplificar,
          error: item.erroSimplificar ?? 0.01,
          lockBorder: true,
        }),
        fn.prune(),
      )
    }
    const max = item.texturaMax ?? 1024
    await doc.transform(
      fn.textureCompress({
        encoder: sharp,
        targetFormat: 'webp',
        resize: [max, max],
        slots: /^(?!normalTexture$)/,
        quality: 90,
      }),
      fn.textureCompress({
        encoder: sharp,
        targetFormat: 'webp',
        resize: [max, max],
        slots: /^normalTexture$/,
        quality: 60,
        nearLossless: true,
      }),
    )
    doc.getRoot().getAsset().extras = {
      roqueos: { licenca: item.licenca, origem: item.origem, id: item.id },
    }
    await MeshoptEncoder.ready
    await doc.transform(fn.meshopt({ encoder: MeshoptEncoder, level: 'medium' }))
    const triangulos = doc
      .getRoot()
      .listMeshes()
      .flatMap((m) => m.listPrimitives())
      .reduce((n, p) => n + (p.getIndices()?.getCount() ?? 0) / 3, 0)
    const saida = dentro(raiz, item.saida)
    mkdirSync(dirname(saida), { recursive: true })
    // Os arquivos que este item escreve, cada um com o próprio SHA no ledger.
    const escritos = []
    if (item.texturasFora) {
      // .gltf com a geometria num .bin e cada textura num .webp ao lado: o WKWebView do
      // iPhone não mostra textura embutida no GLB (regra do Farol, medida no aparelho).
      const nome = item.saida
        .split('/')
        .pop()
        .replace(/\.gltf$/, '')
      doc
        .getRoot()
        .listBuffers()
        .forEach((b, i) => b.setURI(i ? `${nome}_${i}.bin` : `${nome}.bin`))
      doc
        .getRoot()
        .listTextures()
        .forEach((tx, i) =>
          tx.setURI(`${nome}_t${i}.${(tx.getMimeType() || 'image/webp').split('/')[1]}`),
        )
      const { json, resources } = await io.writeJSON(doc)
      const texto = Buffer.from(JSON.stringify(json, null, 2))
      writeFileSync(saida, texto)
      escritos.push({ caminho: item.saida, dados: texto })
      for (const [uri, dados] of Object.entries(resources)) {
        const caminho = `${dirname(item.saida)}/${uri}`
        writeFileSync(dentro(raiz, caminho), dados)
        escritos.push({ caminho, dados })
      }
    } else {
      const binario = await io.writeBinary(doc)
      writeFileSync(saida, binario)
      escritos.push({ caminho: item.saida, dados: binario })
    }
    registrarEscritos(ledger, item, escritos)
    const bytes = escritos.reduce((n, e) => n + e.dados.length, 0)
    const sha = sha256(escritos[0].dados)
    // Grava a cada item: download que cai no meio não perde o que já entrou.
    mkdirSync(dirname(caminhoTrava), { recursive: true })
    writeFileSync(caminhoTrava, `${JSON.stringify({ files: trava }, null, 2)}\n`)
    resumo.push({
      id: item.id,
      saida: item.saida,
      bytes,
      arquivos: escritos.length,
      triangulos: Math.round(triangulos),
      sha,
    })
  }
  return resumo
}
