// O PROGRESSO DOS HOSTS DE TESTE E DE DESENVOLVIMENTO.
//
// O host do RoqueOS guarda o progresso num documento do Firestore
// (users/{uid}/roqueos/<doc>). Estes hosts guardam em memória (o falso) ou no
// localStorage (o de desenvolvimento), e por isso têm de RECUSAR o que o
// Firestore recusa: um host de teste mais frouxo que a produção deixa o bug
// atravessar a extração verde. Foi medido com o firebase 12.7.0 do front, em
// 26/09/2026, que o setDoc recusa no cliente: undefined em qualquer ponto,
// array dentro de array ("Nested arrays are not supported"), objeto que não é
// mapa simples (classe, Map), função, campo de nome vazio ou "__assim__", e
// raiz que não é objeto. O teto de 1 MiB por documento é do servidor.
//
// O save do RoqueCraft grava `outrasDimensoes` como array dentro de array; é
// este host que faz o teste do jogo reprovar antes de o jogador perder o mundo.

/** O teto de um documento do Firestore: 1 MiB. */
export const LIMITE_DO_DOCUMENTO = 1024 * 1024

// O nome do documento (users/<uid>/roqueos/<doc>) entra na conta do tamanho.
// Os hosts de teste não sabem o uid; 96 bytes cobre um uid do Firebase Auth
// e o nome de qualquer jogo, e é nada perto de 1 MiB.
const NOME_DO_DOCUMENTO = 96
const SOBRA_DO_DOCUMENTO = 32

export function erroIndisponivel(causa) {
  const erro = new Error('não consegui ler o progresso', causa ? { cause: causa } : undefined)
  erro.codigo = 'indisponivel'
  return erro
}

function mapaSimples(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false
  const proto = Object.getPrototypeOf(v)
  return proto === Object.prototype || proto === null
}

const bytes = (texto) => new TextEncoder().encode(texto).length

function problemaDoValor(valor, onde, dentroDeArray) {
  if (valor === undefined) return `${onde} é undefined, que o Firestore recusa`
  if (valor === null) return null
  const tipo = typeof valor
  if (tipo === 'string' || tipo === 'number' || tipo === 'boolean') return null
  if (tipo !== 'object') return `${onde} é ${tipo}, que o Firestore recusa`
  if (Array.isArray(valor)) {
    if (dentroDeArray) {
      return `${onde} é array dentro de array, que o Firestore recusa ("Nested arrays are not supported")`
    }
    for (let i = 0; i < valor.length; i++) {
      const p = problemaDoValor(valor[i], `${onde}[${i}]`, true)
      if (p) return p
    }
    return null
  }
  if (valor instanceof Date) {
    return `${onde} é Date, que volta do Firestore como Timestamp e não como Date: guarde o número (Date.now())`
  }
  if (!mapaSimples(valor)) {
    const nome = valor.constructor?.name ?? 'sem protótipo'
    return `${onde} é um objeto ${nome}, e o Firestore só guarda mapa simples`
  }
  for (const [campo, filho] of Object.entries(valor)) {
    const aqui = onde ? `${onde}.${campo}` : campo
    if (campo === '') return `${onde || 'o documento'} tem campo de nome vazio`
    if (/^__.*__$/.test(campo)) return `${aqui}: nome que começa e termina com "__" é do Firestore`
    const p = problemaDoValor(filho, aqui, false)
    if (p) return p
  }
  return null
}

/**
 * O tamanho do documento pela conta que o Firestore publica: texto é UTF-8
 * mais 1; número 8; booleano e null 1; array é a soma; mapa é a soma de
 * (nome do campo + valor); o documento soma o nome dele e mais 32.
 */
export function tamanhoDoDocumento(dados) {
  const medir = (v) => {
    if (v === null || typeof v === 'boolean') return 1
    if (typeof v === 'number') return 8
    if (typeof v === 'string') return bytes(v) + 1
    if (Array.isArray(v)) return v.reduce((soma, x) => soma + medir(x), 0)
    // O que não é valor do Firestore não entra na conta: quem recusa é
    // problemaDoValor, com o motivo certo, e não a conta quebrando no meio.
    if (!v || typeof v !== 'object') return 0
    let soma = 0
    for (const [campo, filho] of Object.entries(v)) soma += bytes(campo) + 1 + medir(filho)
    return soma
  }
  return NOME_DO_DOCUMENTO + medir(dados) + SOBRA_DO_DOCUMENTO
}

/**
 * O primeiro motivo que o Firestore teria para recusar o documento, ou null.
 * É a regra única dos dois hosts de teste.
 */
export function problemaDoDocumento(dados) {
  if (!mapaSimples(dados)) {
    return `o documento precisa ser um mapa simples, veio ${Array.isArray(dados) ? 'array' : dados === null ? 'null' : typeof dados}`
  }
  const problema = problemaDoValor(dados, '', false)
  if (problema) return problema
  const tamanho = tamanhoDoDocumento(dados)
  if (tamanho > LIMITE_DO_DOCUMENTO) {
    return `o documento tem ${tamanho} bytes, e o Firestore aceita até ${LIMITE_DO_DOCUMENTO} (1 MiB)`
  }
  return null
}

/**
 * O `{ merge: true }` do Firestore: mapa com mapa se funde campo a campo, o
 * resto (array, número, null) substitui. Mapa vazio substitui, porque o
 * Firestore o trata como um campo só.
 */
export function mesclarDocumento(antes, novo) {
  const saida = { ...(mapaSimples(antes) ? antes : {}) }
  for (const [campo, valor] of Object.entries(novo)) {
    const velho = saida[campo]
    saida[campo] =
      mapaSimples(valor) && Object.keys(valor).length > 0 && mapaSimples(velho)
        ? mesclarDocumento(velho, valor)
        : valor
  }
  return saida
}

const copia = (v) => structuredClone(v)

/**
 * A capacidade `progresso` sobre qualquer lugar onde o documento more.
 *
 * @param {{
 *   guardado: { ler: () => object | null, gravar: (doc: object) => boolean },
 *   disponivel: () => boolean,
 *   registro?: { warn?: Function },
 * }} opcoes  `ler` LANÇA quando não consegue ler; `gravar` pode lançar ou
 *   devolver false.
 */
export function capacidadeProgresso({ guardado, disponivel, registro = console }) {
  const avisar = (mensagem) => registro?.warn?.(`progresso: ${mensagem}`)
  return {
    disponivel: () => Boolean(disponivel()),
    async carregar() {
      if (!disponivel()) return null
      let doc
      try {
        doc = guardado.ler()
      } catch (erro) {
        // "Não tem save" e "não consegui ler" são respostas diferentes: quem
        // confunde as duas grava um mundo vazio por cima do de verdade.
        throw erro?.codigo === 'indisponivel' ? erro : erroIndisponivel(erro)
      }
      return doc === null || doc === undefined ? null : copia(doc)
    },
    async salvar(dados, opcoes) {
      try {
        if (!disponivel()) return false
        const problema = problemaDoDocumento(dados)
        if (problema) {
          avisar(`salvar recusado: ${problema}`)
          return false
        }
        let doc = copia(dados)
        if (opcoes?.mesclar) {
          doc = mesclarDocumento(guardado.ler() ?? {}, doc)
          const depois = problemaDoDocumento(doc)
          if (depois) {
            avisar(`salvar recusado depois de mesclar: ${depois}`)
            return false
          }
        }
        return guardado.gravar(doc) !== false
      } catch (erro) {
        avisar(`salvar falhou: ${erro?.message ?? erro}`)
        return false
      }
    },
  }
}
