#!/usr/bin/env node
// O CLI do jogo-sdk.
//
//   jogo check [pasta] [--sdk] [--json]   confere um repo de jogo contra o contrato
//   jogo assets importar [--apenas=a,b]   modelo de mercado -> GLB servido, com a origem fixada (0.4.0)
//   jogo olho <rótulo> [--url=…] [--roteiro=…] [--segundos=5]
//                                         fotos e quadro em desktop, celular e TV (0.4.0)
//
// Sai 1 se qualquer seção do check tiver problema. Sem "aviso": problema que não
// reprova é problema que ninguém conserta.

import { resolve } from 'node:path'
import { verificarRepo } from '../src/verificacao.js'

const USO = `uso: jogo check [pasta] [--sdk] [--json]
     jogo assets importar [--apenas=id,id]
     jogo olho <rótulo> [--url=http://…] [--roteiro=olho/roteiro.mjs] [--segundos=5]`

const args = process.argv.slice(2)
const [comando, ...resto] = args
const flags = new Set(resto.filter((a) => a.startsWith('--')))
const valor = (nome) => resto.find((a) => a.startsWith(`--${nome}=`))?.slice(nome.length + 3)
const posicionais = resto.filter((a) => !a.startsWith('--'))

async function main() {
  if (comando === 'check') {
    const pasta = resolve(posicionais[0] ?? '.')
    const secoes = verificarRepo(pasta, { sdk: flags.has('--sdk') })
    const total = secoes.reduce((n, s) => n + s.problemas.length, 0)
    if (flags.has('--json')) {
      console.log(JSON.stringify({ ok: total === 0, pasta, secoes }))
    } else {
      for (const { secao, problemas } of secoes) {
        console.log(`${problemas.length ? 'REPROVOU' : 'ok      '}  ${secao}`)
        for (const p of problemas) console.log(`          ${p}`)
      }
      console.log(total ? `\n${total} problema(s).` : '\nok, o repo cumpre o contrato.')
    }
    return total ? 1 : 0
  }

  if (comando === 'assets' && posicionais[0] === 'importar') {
    const { importar } = await import('../src/importador.js')
    const apenas = valor('apenas')?.split(',')
    const resumo = await importar(resolve('.'), { apenas })
    for (const r of resumo) {
      console.log(
        `ok  ${r.id}  ${r.saida}  ${(r.bytes / 1024 / 1024).toFixed(2)} MB  ${r.triangulos} triângulos  ${r.sha.slice(0, 12)}…`,
      )
    }
    console.log(
      `\n${resumo.length} modelo(s) importado(s). Rode o jogo check: o teto por perfil soma o que entrou.`,
    )
    return 0
  }

  if (comando === 'olho') {
    const { olhar } = await import('../src/olho.js')
    const r = await olhar(resolve('.'), {
      rotulo: posicionais[0],
      url: valor('url'),
      roteiro: valor('roteiro'),
      segundos: Number(valor('segundos') ?? 5),
    })
    for (const c of r.cenarios) {
      const q = c.quadro
      console.log(
        `${c.erros.length ? 'ERRO    ' : 'ok      '}  ${c.nome.padEnd(8)} perfil ${c.perfil.padEnd(5)} p50 ${q.p50} ms  p99 ${q.p99} ms  pior ${q.pior} ms  >100ms ${q.acimaDe100}  fotos ${c.fotos.length}`,
      )
      for (const e of c.erros.slice(0, 5)) console.log(`          ${e.slice(0, 200)}`)
      console.log(`          renderizador: ${c.renderizador}`)
    }
    console.log(`\n.olho/${r.rotulo}/resultado.json`)
    return r.cenarios.some((c) => c.erros.length) ? 1 : 0
  }

  console.error(USO)
  return 2
}

main().then(
  (codigo) => process.exit(codigo),
  (erro) => {
    console.error(erro?.message ?? erro)
    process.exit(1)
  },
)
