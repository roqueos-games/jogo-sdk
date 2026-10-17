// `jogo olho`: o jogo fotografado e medido do mesmo jeito em todo goal (desde 0.4.0, Goal 80).
//
// Abre o jogo no navegador de verdade (Playwright do jogo), chega na partida pelo roteiro
// do próprio jogo, tira as fotos no mesmo enquadramento em três cenários (desktop no perfil
// alto, celular e TV no perfil baixo) e mede o quadro por alguns segundos. O antes e o depois
// de um goal são duas rodadas com rótulos diferentes; o enquadramento é do roteiro, então
// é o mesmo nas duas.
//
// O roteiro (`olho/roteiro.mjs` no jogo):
//   export default async function ({ page, cenario, foto, esperar }) {
//     await page.getByRole('button', { name: /jogar/i }).click()
//     await esperar(2000)
//     await foto('partida')
//   }
//
// O número de quadro é do navegador sem janela desta máquina: o resultado grava o
// renderizador que o WebGL reportou, para ninguém ler SwiftShader como se fosse GPU.
// Celular de verdade continua sendo o iPhone, não este cenário.

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const CENARIOS = Object.freeze([
  Object.freeze({
    nome: 'desktop',
    perfil: 'alto',
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  }),
  Object.freeze({
    nome: 'celular',
    perfil: 'baixo',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  }),
  Object.freeze({
    nome: 'tv',
    perfil: 'baixo',
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  }),
])

/** p50, p99, pior quadro e quantos passaram de 100 ms, a partir dos intervalos entre quadros. */
export function resumirQuadros(intervalos) {
  if (!intervalos.length) return { quadros: 0, p50: null, p99: null, pior: null, acimaDe100: 0 }
  const ord = [...intervalos].sort((a, b) => a - b)
  const pct = (p) => ord[Math.min(ord.length - 1, Math.floor((p / 100) * ord.length))]
  const r = (v) => Math.round(v * 10) / 10
  return {
    quadros: ord.length,
    p50: r(pct(50)),
    p99: r(pct(99)),
    pior: r(ord.at(-1)),
    acimaDe100: ord.filter((v) => v > 100).length,
  }
}

/** URL do cenário: o perfil vai pela busca, que o `perfilDoJogo` do kit de modelos lê. */
export function urlDoCenario(base, cenario) {
  const u = new URL(base)
  u.searchParams.set('perfil', cenario.perfil)
  return u.href
}

async function playwrightDoJogo(raiz) {
  const require = createRequire(join(raiz, 'package.json'))
  for (const nome of ['playwright', '@playwright/test']) {
    try {
      const modulo = await import(pathToFileURL(require.resolve(nome)).href)
      // O playwright é CJS: pelo import, o chromium vem dentro do `default`.
      return modulo.chromium ? modulo : modulo.default
    } catch {
      // tenta o próximo
    }
  }
  throw new Error(
    'falta o Playwright no jogo: yarn add -D playwright@1.60.0 && yarn playwright install chromium',
  )
}

async function esperarServidor(url, ms = 60000) {
  const fim = Date.now() + ms
  while (Date.now() < fim) {
    try {
      const r = await fetch(url)
      if (r.ok) return
    } catch {
      // ainda subindo
    }
    await new Promise((ok) => setTimeout(ok, 300))
  }
  throw new Error(`o servidor de desenvolvimento não respondeu em ${url}`)
}

/**
 * Roda o olho. `url` usa um servidor já de pé; sem ela, sobe o `yarn dev` do jogo numa
 * porta fixa e derruba no fim.
 */
export async function olhar(
  raiz,
  { rotulo, url, roteiro = 'olho/roteiro.mjs', segundos = 5, cenarios = CENARIOS } = {},
) {
  if (!rotulo || !/^[\w.-]+$/.test(rotulo))
    throw new Error('jogo olho precisa de um rótulo simples: antes, depois, g81…')
  const arquivoRoteiro = resolve(raiz, roteiro)
  if (!existsSync(arquivoRoteiro))
    throw new Error(`roteiro ausente: ${roteiro} (o caminho até a partida é do jogo)`)
  const roteirizar = (await import(pathToFileURL(arquivoRoteiro).href)).default
  const { chromium } = await playwrightDoJogo(raiz)

  let servidor
  let base = url
  if (!base) {
    const porta = 5199
    base = `http://localhost:${porta}/`
    // Grupo de processo próprio: o `yarn` sobe o `vite` como filho, e matar só o yarn
    // deixava o vite preso na porta (aconteceu na primeira prova, 16/10/2026).
    servidor = spawn('yarn', ['-s', 'dev', '--port', String(porta), '--strictPort'], {
      cwd: raiz,
      stdio: 'ignore',
      detached: true,
    })
    await esperarServidor(base)
  }

  const saida = join(raiz, '.olho', rotulo)
  mkdirSync(saida, { recursive: true })
  const navegador = await chromium.launch({
    args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=metal'],
  })
  const resultado = { rotulo, quando: new Date().toISOString(), base, cenarios: [] }
  try {
    for (const cenario of cenarios) {
      const { nome, perfil, ...opcoes } = cenario
      // pt-BR fixo: o idioma canônico, e a mesma tela no antes e no depois.
      const contexto = await navegador.newContext({ locale: 'pt-BR', ...opcoes })
      const page = await contexto.newPage()
      const erros = []
      page.on('pageerror', (e) => erros.push(String(e.message ?? e)))
      page.on('console', (m) => m.type() === 'error' && erros.push(m.text()))
      const pasta = join(saida, nome)
      mkdirSync(pasta, { recursive: true })
      const fotos = []
      const foto = async (nomeFoto) => {
        const arquivo = join(pasta, `${nomeFoto}.png`)
        await page.screenshot({ path: arquivo })
        fotos.push(`${nome}/${nomeFoto}.png`)
      }
      await page.goto(urlDoCenario(base, cenario), { waitUntil: 'load' })
      await roteirizar({ page, cenario, foto, esperar: (ms) => page.waitForTimeout(ms) })
      const intervalos = await page.evaluate(
        (ms) =>
          new Promise((ok) => {
            const lista = []
            let antes = performance.now()
            const fim = antes + ms
            const passo = (agora) => {
              lista.push(agora - antes)
              antes = agora
              if (agora < fim) requestAnimationFrame(passo)
              else ok(lista.slice(1))
            }
            requestAnimationFrame(passo)
          }),
        segundos * 1000,
      )
      const renderizador = await page.evaluate(() => {
        const gl = document.createElement('canvas').getContext('webgl2')
        const ext = gl?.getExtension('WEBGL_debug_renderer_info')
        return ext
          ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
          : (gl?.getParameter(gl.RENDERER) ?? 'sem webgl2')
      })
      resultado.cenarios.push({
        nome,
        perfil,
        fotos,
        quadro: resumirQuadros(intervalos),
        renderizador,
        erros,
      })
      await contexto.close()
    }
  } finally {
    await navegador.close()
    if (servidor) {
      try {
        process.kill(-servidor.pid)
      } catch {
        // já saiu
      }
    }
  }
  writeFileSync(join(saida, 'resultado.json'), `${JSON.stringify(resultado, null, 2)}\n`)
  return resultado
}
