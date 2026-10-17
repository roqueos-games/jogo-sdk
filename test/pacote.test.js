// O pacote cifrado dos assets de licença restrita (Fab, Sonniss): sela no build, abre no
// navegador, e nada sai legível do arquivo.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { selarPacote, abrirPacote, carregarPacote, ASSINATURA } from '../src/pacote.js'

const CHAVE = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff'
const OUTRA = 'ff112233445566778899aabbccddeeff00112233445566778899aabbccddeeff'
const texto = (s) => new TextEncoder().encode(s)
const ler = (buf) => new TextDecoder().decode(new Uint8Array(buf))

test('sela e abre: cada arquivo volta igual, pelo nome', async () => {
  const pak = await selarPacote(
    [
      { nome: 'bola-1.mp3', dados: texto('TOC TOC bola contra bola') },
      { nome: 'tabela.mp3', dados: texto('TUM') },
      { nome: 'vazio.bin', dados: new Uint8Array(0) },
    ],
    CHAVE,
  )
  const abertos = await abrirPacote(pak, CHAVE)
  assert.deepEqual([...abertos.keys()], ['bola-1.mp3', 'tabela.mp3', 'vazio.bin'])
  assert.equal(ler(abertos.get('bola-1.mp3')), 'TOC TOC bola contra bola')
  assert.equal(ler(abertos.get('tabela.mp3')), 'TUM')
  assert.equal(abertos.get('vazio.bin').byteLength, 0)
})

test('o arquivo selado não carrega o conteúdo nem os nomes em claro', async () => {
  const pak = await selarPacote(
    [{ nome: 'segredo-do-bar.wav', dados: texto('RIFF....WAVEfmt ') }],
    CHAVE,
  )
  const bruto = Buffer.from(pak).toString('latin1')
  assert.ok(bruto.startsWith(ASSINATURA))
  assert.ok(!bruto.includes('RIFF'), 'o cabeçalho do wav vazou')
  assert.ok(!bruto.includes('segredo-do-bar'), 'o nome do arquivo vazou')
})

test('chave errada não abre, e pacote mexido não abre', async () => {
  const pak = await selarPacote([{ nome: 'a', dados: texto('abc') }], CHAVE)
  await assert.rejects(abrirPacote(pak, OUTRA))
  const mexido = pak.slice()
  mexido[mexido.length - 1] ^= 1
  await assert.rejects(abrirPacote(mexido, CHAVE))
  await assert.rejects(abrirPacote(texto('nao sou pacote'), CHAVE), /assinatura/)
})

test('nome repetido e chave fora do formato são recusados ao selar', async () => {
  await assert.rejects(
    selarPacote(
      [
        { nome: 'a', dados: texto('1') },
        { nome: 'a', dados: texto('2') },
      ],
      CHAVE,
    ),
    /repetido/,
  )
  await assert.rejects(selarPacote([{ nome: 'a', dados: texto('1') }], 'curta'), /hex de 32 bytes/)
})

test('carregarPacote baixa pela URL e abre; resposta de erro vira erro com a URL', async () => {
  const pak = await selarPacote([{ nome: 'x', dados: texto('ok') }], CHAVE)
  const buscar = async (url) =>
    url === '/games/sinuca/sons.pak'
      ? {
          ok: true,
          arrayBuffer: async () => pak.buffer.slice(pak.byteOffset, pak.byteOffset + pak.length),
        }
      : { ok: false, status: 404 }
  const m = await carregarPacote('/games/sinuca/sons.pak', CHAVE, { buscar })
  assert.equal(ler(m.get('x')), 'ok')
  await assert.rejects(
    carregarPacote('/nada.pak', CHAVE, { buscar }),
    /\/nada\.pak recusado \(404\)/,
  )
})
