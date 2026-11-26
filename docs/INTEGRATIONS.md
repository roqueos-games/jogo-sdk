# Integrations

_English | [Português](pt-BR/INTEGRACOES.md)_

> **Who it is for:** whoever writes a game against the SDK, implements a host, or wires `jogo check` into a CI.
> **What is here:** the surface the SDK exposes to the outside: how a game uses each capability and each kit, with code, what a host implementer must match, and the machine-readable output of `jogo check`.
> **Where to go for the rest:** the list of entry points and constants, in [REFERENCE.md](REFERENCE.md); why each capability exists, in [`src/contrato.js`](../src/contrato.js) itself, where the reason is part of the contract.

## Contents

1. [The game side: capabilities](#1-the-game-side-capabilities)
2. [Online match: `sala`](#2-online-match-sala)
3. [Live room: `salaAoVivo`](#3-live-room-salaaovivo)
4. [The saved game: `progresso`](#4-the-saved-game-progresso)
5. [Presence and resume: `presenca` and `retomada`](#5-presence-and-resume-presenca-and-retomada)
6. [The 3D model kit](#6-the-3d-model-kit)
7. [Graphics and the settings panel](#7-graphics-and-the-settings-panel)
8. [Sound and the entry screen](#8-sound-and-the-entry-screen)
9. [The host side](#9-the-host-side)
10. [CI: `jogo check --json`](#10-ci-jogo-check---json)

The code and its comments are in Portuguese, the project's canonical language; the code blocks below are the same in both languages.

## 1. The game side: capabilities

Mandatory, provided by every host: `identidade`, `avisar`, `audio`, `desempenho`, `metricas`, `placar`, `armazenamento` and `idioma`. Optional, which a game lists in `capacidades` when it cannot live without them: `tela`, `teclado`, `ia`, `sala`, `salaAoVivo`, `progresso`, `retomada` and `presenca` ([`src/contrato.js`](../src/contrato.js)).

`avisar(mensagem, { tipo, fixo })`: `fixo: true` stays on screen until the player closes it, for the notice that must not vanish by itself ("não consegui ler o seu mundo; nada foi gravado por cima").

`ia` is `{ completar, disponivel }` since 0.3.0: `disponivel()` says before the question whether there is a model, and `completar({ sistema, mensagens: [{ papel: 'jogador' | 'modelo', texto }] })` returns text or `null`. The development host has no `ia`, on purpose; in tests:

```js
const host = criarHostFalso({ ia: async (pedido) => 'resposta', iaDisponivel: true })
```

## 2. Online match: `sala`

Since 0.2.0. Two players, one board: one creates the room and gets a five-letter code and a link (the QR), the other joins by code or link, and both exchange state in real time. The game talks to no database; the host keeps the room, and the board state is opaque to it. No account, no room.

```js
const { codigo, link } = await host.sala.criar({ estadoInicial, vez: 'brancas' })
const parar = host.sala.observar(codigo, (sala) => desenhar(sala)) // sala ou null
await host.sala.jogar(codigo, { estado, vez: 'pretas' })

const convite = host.sala.conviteRecebido() // aberto pelo link? o código, ou null
const r = await host.sala.entrar(convite) // { ok } ou { erro: 'nao-encontrada' | 'propria' | 'cheia' | 'sem-conta' }
```

The room arrives with `anfitriao`, `nomeDoAnfitriao`, `convidado`, `nomeDoConvidado`, `situacao` (`esperando`, `jogando`, `encerrada`), `vez`, `estado`, `vencedor` and `anfitriaoSaiu`. A game with a room declares `"capacidades": ["sala"]` and `"aceitaConvite": true` in `jogo.json`.

On the game's `yarn dev`, the development host plays online between two tabs of the same browser: create the room in one tab and open the link (the page itself with `?sala=<código>`) in another new tab. Do not duplicate the tab, which copies `sessionStorage` and becomes the same player. In tests, the fake host plays the other player with `host.disparar('sala', { acao: 'entrar', codigo, uid: 'bia' })`, and `criarHostFalso({ convite: 'ABC23' })` opens the game as if it came from the link.

## 3. Live room: `salaAoVivo`

Since 0.3.0. Many players in the same world in real time: each one's presence, what only the host simulates, the guests' intent queue, the pieces of the world that changed. The host gives the code, the invite link and who the player is, and keeps the room under the node that belongs to that game; the game reads and writes paths **inside the room** (`''` is the whole room) with Realtime Database operations. What each node means belongs to the game; who writes where is decided by the database rules, not the SDK.

```js
const s = host.salaAoVivo
const { codigo, link, eu } = await s.criar({ meta: { region: 'greenwood' } }) // o host põe host, hostName e createdAt
const r = await s.entrar(s.conviteRecebido()) // { ok, meta, eu } ou { erro: 'nao-encontrada' | 'sem-conta' }

await s.gravar(codigo, `players/${eu.uid}`, { x, y, t: s.horaDoServidor() })
await s.aoCair(codigo, `players/${eu.uid}`, 'apagar') // some quando esta janela cair ou fechar
await s.atualizar(codigo, 'blocks', { '3_-7/1234': 5 }) // a chave pode ser um caminho
const chave = await s.empurrar(codigo, 'hits', { m, d, by: eu.uid })

const parar = s.observar(codigo, 'players', (jogadores) => desenhar(jogadores)) // valor ou null
s.observarFilhos(codigo, 'chat', { adicionado: (k, msg) => mostrar(msg) }, { ultimos: 60 })
s.conectado((online) => aviso(online))
s.sair(codigo) // para os ouvintes desta sala; não escreve nada
```

The guarantees, on all three hosts: a path with `.`, `#`, `$`, `[`, `]`, a control character, `..` or an empty segment, and `undefined`, a function, `NaN` or a `Date` anywhere in the value, throw `TypeError` at call time. A refused write (database rule, network, a room this window neither created nor joined) resolves `false`, or `null` for `empurrar`, and never throws. The first delivery of `observar`, `observarFilhos` and `conectado` never happens inside the call. The value comes back the way the database returns it: an empty object disappears, and an array is stored by index and comes back an array when the keys are integers and more than half the indexes are filled.

In tests, the fake host plays the other players and the database rules:

```js
const host = criarHostFalso({
  uid: 'ana',
  // o papel da regra do banco: true recusa (recebe { operacao, codigo, caminho, uid, valor })
  recusar: ({ caminho, uid }) => caminho === 'relogio' && uid !== 'ana',
})
host.disparar('salaAoVivo', { acao: 'criar', codigo: 'ABC23', uid: 'bia', meta: { seed: 1 } })
host.disparar('salaAoVivo', {
  acao: 'gravar',
  codigo: 'ABC23',
  uid: 'bia',
  caminho: 'players/bia',
  valor: { x: 1 },
})
host.disparar('salaAoVivo', { acao: 'aoCair', codigo: 'ABC23', uid: 'bia', caminho: 'players/bia' })
host.disparar('salaAoVivo', { acao: 'cair', uid: 'bia' }) // o que a Bia armou some
host.disparar('conexao', false) // esta janela caiu: roda o que o jogo armou com aoCair
host.arvoreDaSala('ABC23') // a sala inteira, sem passar pelo jogo
```

A game with a live room declares `"capacidades": ["salaAoVivo"]` and `"aceitaConvite": true`.

## 4. The saved game: `progresso`

Since 0.3.0. One document per game, on the player's account. "There is no save" and "I could not read it" are different answers, because confusing them writes an empty world over months of building.

```js
if (host.progresso.disponivel()) {
  try {
    const save = await host.progresso.carregar() // objeto, ou null se não há save
  } catch (erro) {
    // erro.codigo === 'indisponivel': não grave por cima; avise e deixe tentar de novo
    host.avisar('Não consegui ler o seu mundo; nada foi gravado por cima.', {
      tipo: 'erro',
      fixo: true,
    })
  }
}
await host.progresso.salvar({ heroi, updatedAt: Date.now() }, { mesclar: true }) // true ou false
```

`salvar` replaces the document; with `mesclar`, it merges map into map, like Firestore's `merge`. The test hosts refuse with `false` what Firestore refuses: `undefined`, an array inside an array, an object that is not a plain map (and `Date`), an empty field name or one like `__assim__`, and a document over 1 MiB. The development host keeps it in `roqueos:<jogo>:progresso`; the fake host takes `progresso: { salvo, falharLeitura, falharEscrita }`.

## 5. Presence and resume: `presenca` and `retomada`

`presenca` (0.7.0): `entrar({ mapa, pose, aparencia })`, `pose(p)` (the host lets out at most 10 per second and drops the rest), `observar(fn)` (only who is on the same map, without the player), `trocarDeMapa`, `sair` and `conectado`. A map outside `a-z`, `0-9` and hyphen, or a pose without numeric `x` and `y`, is a `TypeError` on the spot. The development host carries presence between tabs over a `BroadcastChannel`; the fake host takes `disparar('presenca', { t: 'entrou' | 'pose' | 'mapa' | 'saiu' | 'conexao', ... })` ([`src/host/presenca.js`](../src/host/presenca.js)).

`retomada` (0.6.0): `estado()` (`'conta'`, `'convidado'` or `'sem-onde'`), `link()` (a single-use link with an expiry to continue on another device, or `null`), `revogar()` and `levarParaConta()`. The game never sees a secret or a code; the code travels in the URL fragment ([`src/contrato.js`](../src/contrato.js)).

## 6. The 3D model kit

Since 0.4.0. `assets/importar.json` lists each model with output, license, source and origin; `jogo assets importar` writes the compressed GLB, pins the original in `assets/source-lock.json` and writes the `ASSETS.md` row with the SHA-256. The game installs the tools as devDependencies: `@gltf-transform/core`, `extensions` and `functions` 4.5.1, `meshoptimizer` 1.1.1 and `sharp` 0.35.4. In the game, `@roqueos-games/jogo-sdk/modelos` loads and lights:

```js
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import {
  perfilDoJogo,
  prepararRenderizador,
  acenderAmbiente,
  criarCarregador,
} from '@roqueos-games/jogo-sdk/modelos'

const perfil = perfilDoJogo(host)
prepararRenderizador({ THREE, renderer, perfil })
acenderAmbiente({ THREE, renderer, scene, RoomEnvironment })
const modelos = criarCarregador({ GLTFLoader, MeshoptDecoder, base: '/games/farol/', perfil })
const { cena } = await modelos.modelo({
  baixo: 'modelos/carro.glb',
  alto: 'modelos/alto/carro.glb',
})
```

For the whole scenery at once, `criarCenario` gathers models, PBR textures (`cor`, `normal` and `arm` in `texturas/<id>/`, as the importer writes them) and the HDR sky. Whatever does not arrive stays in `faltaram` and the game keeps its previous drawing:

```js
const cenario = criarCenario({ THREE, GLTFLoader, MeshoptDecoder, RGBELoader, base, perfil })
await cenario.carregar({ modelos: { banco: 'modelos/banco.gltf' }, texturas: ['piso'], ceu })
cenario.vestir(chao.material, 'piso', 6, 4) // repetição própria, sem vazar para outro material
cena.add(cenario.modelo('banco', 0.75)) // 75 cm de altura, pé no chão, centrado
cenario.aplicarCeu(renderer, cena, { fundo: true })
```

What only the desktop loads lives in an `alto/` folder, outside the 30 MB of the low profile. `jogo olho antes` and `jogo olho depois` photograph the same script on desktop, phone and TV and measure the frame; the game installs `playwright` 1.60.0.

## 7. Graphics and the settings panel

Since 0.4.0: qualities Baixo, Médio, Alto and Ultra, each effect switchable on its own (GTAO, bloom, camera motion blur, antialiasing, vignette), FOV, the choice kept in the host's `armazenamento`, and the post-processing chain over the game's own three ([`src/grafico.js`](../src/grafico.js), [`src/painel.js`](../src/painel.js)).

```js
import {
  configuracaoPadrao,
  carregarConfiguracao,
  salvarConfiguracao,
  criarPosProcesso,
} from '@roqueos-games/jogo-sdk/grafico'
import { abrirPainel } from '@roqueos-games/jogo-sdk/painel'

let cfg = carregarConfiguracao(
  host.armazenamento,
  configuracaoPadrao({ modoLeve, toque }, { fov: 50 }),
)
const pos = criarPosProcesso({ THREE, renderer, scene, camera, cfg, modulos }) // passes do three do jogo
abrirPainel({
  raiz,
  idioma,
  cfg,
  aoMudarGrafico: (c) => {
    pos.aplicar(c)
    salvarConfiguracao(host.armazenamento, c)
  },
})
```

## 8. Sound and the entry screen

Since 0.5.0, the bar the Sinuca set for every game: recorded sound in high definition from the first play, in space, and an entry screen that measures the real load ([`src/som.js`](../src/som.js), [`src/carga.js`](../src/carga.js), [`src/pacote.js`](../src/pacote.js)).

```js
import { criarAudio } from '@roqueos-games/jogo-sdk/som'
import { criarCarga } from '@roqueos-games/jogo-sdk/carga'
import { carregarPacote } from '@roqueos-games/jogo-sdk/pacote'

const audio = criarAudio(host.audio, {
  pacote: () => carregarPacote(`${BASE}sons.pak`, CHAVE), // gravações cifradas
  espaco: { refDistance: 1.2, rolloffFactor: 1.1, maxDistance: 40 }, // na unidade da cena
})
const carga = criarCarga({ manager: THREE.DefaultLoadingManager })
carga.etapa('mesa', mesaPronta)
carga.etapa('sons', audio.preparar()) // a primeira jogada já sai gravada
carga.aoMudar(({ progresso, etapa }) => desenharEntrada(progresso, etapa))

audio.tocar(audio.variacao('peca', 6), { pos: { x, y, z }, taxa: audio.tom() }) || audio.blip(360)
audio.laco('fogo.mp3', true, { lugares: [{ x: 0, y: 8, z: -40 }] }) // ambiente em laço, no espaço
audio.ouvir({ pos, frente, cima }) // a câmera, a cada quadro

const motor = audio.voz('motor.wav') // voz contínua que o jogo dirige a cada quadro
motor.definir({ taxa: 0.7 + rotacao * 0.9, ganho: 0.8 }) // desliza, sem estalo
motor.parar() // fade e solta os nós
```

Each hit leaves the audio graph when it ends (the HRTF panner is the most expensive node). Without a pack or without a context, `tocar` returns `false` and the game plays the synthesis fallback (`blip`).

## 9. The host side

A host is an object with `versaoDoContrato: 1` and the capabilities in the shapes of `CAPACIDADES`. Before shipping, check it the way `mount` will:

```js
import { verificarHost } from '@roqueos-games/jogo-sdk'

const { ok, problemas } = verificarHost(host, { exigidas: ['sala'] })
```

So that the RoqueOS host refuses exactly what the test hosts refuse, the rules are exported: `@roqueos-games/jogo-sdk/sala-ao-vivo` (`segmentosDoCaminho`, `conferirValor`, `conferirAtualizacao`, `normalizarCodigoDaSala`, `MARCADOR_DA_HORA`) and `@roqueos-games/jogo-sdk/presenca` (`conferirMapa`, `conferirPose`, `conferirAparencia`, `POSES_POR_SEGUNDO`). The names in the room (`anfitriao`, `situacao`) are the SDK's; translating them to the database fields is the RoqueOS host's work ([`src/contrato.js`](../src/contrato.js)).

## 10. CI: `jogo check --json`

```bash
node node_modules/@roqueos-games/jogo-sdk/bin/jogo.mjs check --json
```

It prints one line of JSON, `{ "ok": boolean, "pasta": "<absolute path>", "secoes": [{ "secao": "<name>", "problemas": ["..."] }] }`, and exits 1 when `ok` is `false` ([`bin/jogo.mjs`](../bin/jogo.mjs)). The `bin` entry in [`package.json`](../package.json) also exposes it as `jogo` inside the game, so `yarn jogo check` works there.
