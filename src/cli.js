// O parse dos argumentos do CLI `jogo` (desde 0.5.1, Goal 102).
//
// Cada comando declara as opções que aceita. O parse roda inteiro antes de qualquer comando
// tocar no disco, e devolve uma de três coisas:
//   { ajuda }                         `--usage`, `--help` ou `-h` em qualquer nível: a ajuda
//                                     daquele nível, saída 0, nada roda;
//   { erro }                          opção desconhecida, valor faltando, comando que não
//                                     existe: a mensagem diz qual e mostra o uso, saída 2;
//   { comando, opcoes, posicionais }  só então o comando roda.
//
// Por que existe: duas vezes um agente rodou `jogo assets importar --usage` achando que veria a
// ajuda, e o importador ignorou a flag e reimportou o catálogo inteiro por cima dos arquivos.
// Flag que ninguém conhece não pode virar "rode tudo".

export const PEDIDOS_DE_AJUDA = Object.freeze(['--usage', '--help', '-h'])

/**
 * Os comandos, com as opções de cada um. `bandeira` não leva valor (`--json`); `valor` exige
 * `--nome=valor` não vazio. `validar` recusa o valor antes de rodar.
 */
export const COMANDOS = Object.freeze({
  check: {
    uso: 'jogo check [pasta] [--sdk] [--json]',
    resumo: 'confere um repo de jogo contra o contrato; sai 1 se alguma seção reprovar',
    posicionais: { max: 1, nomes: '[pasta]' },
    opcoes: {
      sdk: { tipo: 'bandeira', ajuda: 'confere o próprio SDK (só os scripts de instalação)' },
      json: { tipo: 'bandeira', ajuda: 'resultado em JSON no stdout' },
    },
  },
  'assets importar': {
    uso: 'jogo assets importar [--apenas=id,id]',
    resumo:
      'lê assets/importar.json da pasta atual e gera os GLB e as texturas; sem --apenas importa a lista inteira e sobrescreve as saídas',
    posicionais: { max: 0 },
    opcoes: {
      apenas: {
        tipo: 'valor',
        ajuda: 'só os ids listados, separados por vírgula; id fora da lista é recusado',
        validar: (v) =>
          v.split(',').some((id) => !id.trim()) ? 'lista de ids com item vazio' : null,
      },
    },
  },
  olho: {
    uso: 'jogo olho <rótulo> [--url=http://…] [--roteiro=olho/roteiro.mjs] [--segundos=5]',
    resumo: 'fotos e quadro em desktop, celular e TV, gravados em .olho/<rótulo>/',
    posicionais: { max: 1, nomes: '<rótulo>' },
    opcoes: {
      url: {
        tipo: 'valor',
        ajuda: 'o jogo já servido; sem ela o olho sobe o `yarn dev` do jogo na porta 5199',
      },
      roteiro: { tipo: 'valor', ajuda: 'o roteiro até a partida (padrão olho/roteiro.mjs)' },
      segundos: {
        tipo: 'valor',
        ajuda: 'quanto tempo mede o quadro (padrão 5)',
        validar: (v) => (Number(v) > 0 ? null : 'precisa ser um número maior que zero'),
      },
    },
  },
})

/** Os grupos que só existem para agrupar subcomandos. */
const GRUPOS = Object.freeze({ assets: ['importar'] })

export const USO_GERAL = `uso: ${Object.values(COMANDOS)
  .map((c) => c.uso)
  .join('\n     ')}

Ajuda de cada comando: jogo <comando> --usage (também --help ou -h).`

function ajudaDoComando(nome) {
  const c = COMANDOS[nome]
  const largura = Math.max(23, ...Object.keys(c.opcoes).map((o) => o.length + 10))
  const linhas = Object.entries(c.opcoes).map(
    ([o, d]) => `  --${o}${d.tipo === 'valor' ? '=…' : ''}`.padEnd(largura) + d.ajuda,
  )
  linhas.push('  --usage, --help, -h'.padEnd(largura) + 'esta ajuda, sem rodar nada')
  return `uso: ${c.uso}\n\n${c.resumo}\n\nopções:\n${linhas.join('\n')}`
}

function ajudaDoGrupo(grupo) {
  return `uso: ${GRUPOS[grupo].map((s) => COMANDOS[`${grupo} ${s}`].uso).join('\n     ')}`
}

const erro = (onde, motivo, uso) => ({ erro: `${onde}: ${motivo}\n\n${uso}` })

/** Lê argv (sem o node e o script). Não toca no disco, não importa nada. */
export function lerArgumentos(argv) {
  const pedeAjuda = argv.some((a) => PEDIDOS_DE_AJUDA.includes(a))
  const [primeiro, segundo] = argv

  if (primeiro === undefined || PEDIDOS_DE_AJUDA.includes(primeiro)) {
    return pedeAjuda ? { ajuda: USO_GERAL } : { erro: USO_GERAL }
  }

  let nome
  let resto
  if (GRUPOS[primeiro]) {
    if (
      segundo === undefined ||
      PEDIDOS_DE_AJUDA.includes(segundo) ||
      !GRUPOS[primeiro].includes(segundo)
    ) {
      if (pedeAjuda) return { ajuda: ajudaDoGrupo(primeiro) }
      const motivo =
        segundo === undefined ? 'falta o subcomando' : `subcomando desconhecido ${segundo}`
      return erro(`jogo ${primeiro}`, motivo, ajudaDoGrupo(primeiro))
    }
    nome = `${primeiro} ${segundo}`
    resto = argv.slice(2)
  } else if (COMANDOS[primeiro]) {
    nome = primeiro
    resto = argv.slice(1)
  } else {
    if (pedeAjuda) return { ajuda: USO_GERAL }
    return erro('jogo', `comando desconhecido ${primeiro}`, USO_GERAL)
  }

  const comando = COMANDOS[nome]
  if (pedeAjuda) return { ajuda: ajudaDoComando(nome) }

  const onde = `jogo ${nome}`
  const uso = `uso: ${comando.uso}`
  const opcoes = {}
  const posicionais = []
  for (const arg of resto) {
    if (!arg.startsWith('-') || arg === '-') {
      posicionais.push(arg)
      continue
    }
    const igual = arg.indexOf('=')
    const chave = (igual === -1 ? arg : arg.slice(0, igual)).replace(/^--?/, '')
    const def = arg.startsWith('--') ? comando.opcoes[chave] : undefined
    if (!def) return erro(onde, `opção desconhecida ${arg}`, uso)
    if (Object.hasOwn(opcoes, chave)) return erro(onde, `--${chave} repetida`, uso)
    if (def.tipo === 'bandeira') {
      if (igual !== -1) return erro(onde, `--${chave} não leva valor`, uso)
      opcoes[chave] = true
      continue
    }
    const valor = igual === -1 ? '' : arg.slice(igual + 1)
    if (!valor) return erro(onde, `--${chave} precisa de valor: --${chave}=…`, uso)
    const problema = def.validar?.(valor)
    if (problema) return erro(onde, `--${chave}=${valor}: ${problema}`, uso)
    opcoes[chave] = valor
  }
  if (posicionais.length > comando.posicionais.max) {
    const sobra = posicionais.slice(comando.posicionais.max).join(' ')
    return erro(onde, `argumento a mais: ${sobra}`, uso)
  }
  return { comando: nome, opcoes, posicionais }
}
