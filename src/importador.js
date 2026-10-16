// `jogo assets importar`: de um modelo de mercado para o GLB que o jogo serve, com a
// origem fixada (desde 0.4.0, Goal 80). É o caminho do tools/kit-import do Call of Roque e
// da Agentolandia, sem TypeScript e para qualquer jogo da organização.
//
// Lista em `assets/importar.json`:
//   { "itens": [ { "id": "palmeira", "saida": "public/games/farol/modelos/palmeira.glb",
//       "licenca": "CC0-1.0", "origem": "https://polyhaven.com/a/...",
//       "fonte": { "polyhaven": "...", "resolucao": "1k" }          // baixa pela API
//            ou { "arquivo": ".local/asset-source/x.fbx" }          // baixado à mão (Sketchfab, Fab, Mixamo)
//       "texturaMax": 1024, "simplificar": 0.5, "manter": "^Tronco|^Folha" } ] }
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

/** Valida a lista antes de baixar qualquer coisa: erro de digitação não gasta download. */
export function validarLista(lista) {
  const problemas = []
  const ids = new Set()
  for (const [i, item] of (lista?.itens ?? []).entries()) {
    const onde = item?.id ? `item "${item.id}"` : `item ${i}`
    if (!item?.id) problemas.push(`${onde}: sem id`)
    else if (ids.has(item.id)) problemas.push(`${onde}: id repetido`)
    ids.add(item?.id)
    if (!item?.saida?.startsWith('public/') || !item.saida.endsWith('.glb'))
      problemas.push(`${onde}: saida precisa ser um .glb dentro de public/`)
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
  const r = await fetch(
    `https://api.polyhaven.com/files/${encodeURIComponent(item.fonte.polyhaven)}`,
    {
      signal: AbortSignal.timeout(60000),
    },
  )
  if (!r.ok) throw new Error(`Poly Haven ${item.fonte.polyhaven}: HTTP ${r.status}`)
  const arquivos = await r.json()
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

/** Importa a lista inteira (ou só `apenas`). Devolve um resumo por item. */
export async function importar(raiz, { apenas } = {}) {
  const lista = JSON.parse(readFileSync(join(raiz, 'assets/importar.json'), 'utf8'))
  const problemas = validarLista(lista)
  if (problemas.length) throw new Error(problemas.join('\n'))
  const { NodeIO } = await doJogo(raiz, '@gltf-transform/core')
  const { ALL_EXTENSIONS } = await doJogo(raiz, '@gltf-transform/extensions')
  const fn = await doJogo(raiz, '@gltf-transform/functions')
  const { MeshoptEncoder, MeshoptSimplifier } = await doJogo(raiz, 'meshoptimizer')
  const sharpDoJogo = await doJogo(raiz, 'sharp')
  const sharp = sharpDoJogo.default ?? sharpDoJogo
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder })

  const caminhoTrava = join(raiz, 'assets/source-lock.json')
  const trava = existsSync(caminhoTrava)
    ? (JSON.parse(readFileSync(caminhoTrava, 'utf8')).files ?? {})
    : {}
  const ledger = join(raiz, 'ASSETS.md')
  const resumo = []

  for (const item of lista.itens) {
    if (apenas && !apenas.includes(item.id)) continue
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
    const binario = await io.writeBinary(doc)
    writeFileSync(saida, binario)
    const sha = sha256(binario)
    writeFileSync(
      ledger,
      registrarNoLedger(
        existsSync(ledger) ? readFileSync(ledger, 'utf8') : '# Origem dos assets\n',
        {
          caminho: item.saida,
          licenca: item.licenca,
          origem: item.origem,
          sha,
        },
      ),
    )
    // Grava a cada item: download que cai no meio não perde o que já entrou.
    mkdirSync(dirname(caminhoTrava), { recursive: true })
    writeFileSync(caminhoTrava, `${JSON.stringify({ files: trava }, null, 2)}\n`)
    resumo.push({
      id: item.id,
      saida: item.saida,
      bytes: binario.length,
      triangulos: Math.round(triangulos),
      sha,
    })
  }
  return resumo
}
