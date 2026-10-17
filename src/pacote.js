// O pacote cifrado (.pak) dos assets de licença restrita: Fab e Sonniss.
//
// O EULA do Fab (§4c) manda impedir o usuário final de extrair o conteúdo, e a licença do
// Sonniss GDC proíbe redistribuir as gravações como efeito sonoro. Um .wav ou .glb numa URL
// previsível é exatamente a extração. Aqui os arquivos vão juntos num pacote só, cifrado com
// AES-GCM, e saem decifrados em memória, direto para o decodificador: nenhuma URL do arquivo
// solto existe.
//
// A Agentolândia tem servidor e cifra o pacote de novo para cada sessão. Os jogos do front são
// estáticos (Firebase Hosting): a chave vai no código do jogo, que mora em repositório privado.
// Isso impede o download direto e a coleta por URL; não é DRM, e quem lê o JavaScript do jogo
// chega à chave. É o mesmo nível do que o Fab exige dos jogos web publicados.
//
// Formato: ASSINATURA, 12 bytes de IV, e o texto cifrado de
//   [u32 LE: tamanho do índice][índice JSON: {arquivos:[{nome,inicio,tamanho}]}][dados]
// O mesmo código roda no Node (para selar no build) e no navegador (para abrir): os dois têm
// `crypto.subtle`.

export const ASSINATURA = 'JOGOPAK1\n'
const IV = 12

const sutil = (cripto) => {
  const s = (cripto ?? globalThis.crypto)?.subtle
  if (!s) throw new Error('sem WebCrypto: o pacote só abre em contexto seguro (https ou localhost)')
  return s
}

const bytesDaChave = (chave) => {
  if (typeof chave === 'string') {
    if (!/^[0-9a-f]{64}$/i.test(chave)) throw new Error('a chave do pacote é hex de 32 bytes')
    return Uint8Array.from(chave.match(/../g), (h) => parseInt(h, 16))
  }
  if (!(chave instanceof Uint8Array) || chave.length !== 32)
    throw new Error('a chave do pacote tem 32 bytes')
  return chave
}

const importar = (cripto, chave, uso) =>
  sutil(cripto).importKey('raw', bytesDaChave(chave), 'AES-GCM', false, [uso])

/**
 * Sela os arquivos num pacote.
 * @param {{nome: string, dados: Uint8Array}[]} arquivos
 * @param {string | Uint8Array} chave hex de 32 bytes ou os 32 bytes
 * @returns {Promise<Uint8Array>}
 */
export async function selarPacote(arquivos, chave, { cripto, iv } = {}) {
  const nomes = new Set()
  let inicio = 0
  const indice = { arquivos: [] }
  for (const a of arquivos) {
    if (!a?.nome || nomes.has(a.nome))
      throw new Error(`nome repetido ou vazio no pacote: ${a?.nome}`)
    nomes.add(a.nome)
    indice.arquivos.push({ nome: a.nome, inicio, tamanho: a.dados.length })
    inicio += a.dados.length
  }
  const json = new TextEncoder().encode(JSON.stringify(indice))
  const claro = new Uint8Array(4 + json.length + inicio)
  new DataView(claro.buffer).setUint32(0, json.length, true)
  claro.set(json, 4)
  let p = 4 + json.length
  for (const a of arquivos) {
    claro.set(a.dados, p)
    p += a.dados.length
  }
  const vetor = iv ?? (cripto ?? globalThis.crypto).getRandomValues(new Uint8Array(IV))
  const chaveCripto = await importar(cripto, chave, 'encrypt')
  const cifrado = new Uint8Array(
    await sutil(cripto).encrypt({ name: 'AES-GCM', iv: vetor }, chaveCripto, claro),
  )
  const assinatura = new TextEncoder().encode(ASSINATURA)
  const saida = new Uint8Array(assinatura.length + IV + cifrado.length)
  saida.set(assinatura, 0)
  saida.set(vetor, assinatura.length)
  saida.set(cifrado, assinatura.length + IV)
  return saida
}

/**
 * Abre um pacote. Devolve nome → ArrayBuffer (pronto para `decodeAudioData` ou `GLTFLoader.parse`).
 * @param {ArrayBuffer | Uint8Array} pacote
 * @param {string | Uint8Array} chave
 * @returns {Promise<Map<string, ArrayBuffer>>}
 */
export async function abrirPacote(pacote, chave, { cripto } = {}) {
  const bytes = pacote instanceof Uint8Array ? pacote : new Uint8Array(pacote)
  const assinatura = new TextEncoder().encode(ASSINATURA)
  const cabeca = new TextDecoder().decode(bytes.subarray(0, assinatura.length))
  if (cabeca !== ASSINATURA) throw new Error('não é um pacote de jogo (assinatura errada)')
  const vetor = bytes.subarray(assinatura.length, assinatura.length + IV)
  const chaveCripto = await importar(cripto, chave, 'decrypt')
  const claro = new Uint8Array(
    await sutil(cripto).decrypt(
      { name: 'AES-GCM', iv: vetor },
      chaveCripto,
      bytes.subarray(assinatura.length + IV),
    ),
  )
  const tamanho = new DataView(claro.buffer, claro.byteOffset).getUint32(0, true)
  const indice = JSON.parse(new TextDecoder().decode(claro.subarray(4, 4 + tamanho)))
  const base = 4 + tamanho
  const saida = new Map()
  for (const a of indice.arquivos) {
    saida.set(a.nome, claro.slice(base + a.inicio, base + a.inicio + a.tamanho).buffer)
  }
  return saida
}

/**
 * Baixa e abre um pacote do jogo. `url` é o caminho servido (o host resolve a base do jogo).
 */
export async function carregarPacote(url, chave, { buscar = globalThis.fetch, cripto } = {}) {
  const r = await buscar(url)
  if (!r.ok) throw new Error(`pacote ${url} recusado (${r.status})`)
  return abrirPacote(await r.arrayBuffer(), chave, { cripto })
}
