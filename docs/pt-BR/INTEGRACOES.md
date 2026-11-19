# Integrações

_[English](../INTEGRATIONS.md) | Português_

> **Para quem:** quem escreve um jogo contra o SDK, implementa um host, ou liga o `jogo check` num CI.
> **O que tem aqui:** a superfície que o SDK expõe para fora: como um jogo usa cada capacidade e cada kit, com código, o que quem implementa um host precisa acompanhar, e a saída do `jogo check` para máquina.
> **Onde ir para o resto:** a lista de pontos de entrada e constantes, na [REFERENCIA.md](REFERENCIA.md); por que cada capacidade existe, no próprio [`src/contrato.js`](../../src/contrato.js), onde o motivo é parte do contrato.

## Sumário

1. [O lado do jogo: capacidades](#1-o-lado-do-jogo-capacidades)
2. [Partida online: `sala`](#2-partida-online-sala)
3. [Sala ao vivo: `salaAoVivo`](#3-sala-ao-vivo-salaaovivo)
4. [O jogo salvo: `progresso`](#4-o-jogo-salvo-progresso)
5. [Presença e retomada: `presenca` e `retomada`](#5-presença-e-retomada-presenca-e-retomada)
6. [O kit de modelos 3D](#6-o-kit-de-modelos-3d)
7. [Gráfico e o painel de configurações](#7-gráfico-e-o-painel-de-configurações)
8. [Som e a tela de entrada](#8-som-e-a-tela-de-entrada)
9. [O lado do host](#9-o-lado-do-host)
10. [CI: `jogo check --json`](#10-ci-jogo-check---json)

O código e os comentários dele são em português, o idioma canônico do projeto; os blocos de código abaixo são os mesmos nos dois idiomas.

## 1. O lado do jogo: capacidades

Obrigatórias, que todo host entrega: `identidade`, `avisar`, `audio`, `desempenho`, `metricas`, `placar`, `armazenamento` e `idioma`. Opcionais, que o jogo lista em `capacidades` quando não vive sem elas: `tela`, `teclado`, `ia`, `sala`, `salaAoVivo`, `progresso`, `retomada` e `presenca` ([`src/contrato.js`](../../src/contrato.js)).

`avisar(mensagem, { tipo, fixo })`: `fixo: true` fica na tela até o jogador fechar, para o aviso que não pode sumir sozinho ("não consegui ler o seu mundo; nada foi gravado por cima").

`ia` é `{ completar, disponivel }` desde a 0.3.0: `disponivel()` diz antes da pergunta se há modelo, e `completar({ sistema, mensagens: [{ papel: 'jogador' | 'modelo', texto }] })` devolve texto ou `null`. O host de desenvolvimento não tem `ia`, de propósito; no teste:

```js
const host = criarHostFalso({ ia: async (pedido) => 'resposta', iaDisponivel: true })
```

## 2. Partida online: `sala`

Desde a 0.2.0. Dois jogadores, um tabuleiro: um cria a sala e recebe um código de cinco letras e um link (o QR), o outro entra pelo código ou pelo link, e os dois trocam o estado em tempo real. O jogo não fala com banco nenhum; quem guarda a sala é o host, e o estado do tabuleiro é opaco para ele. Sem conta não há sala.

```js
const { codigo, link } = await host.sala.criar({ estadoInicial, vez: 'brancas' })
const parar = host.sala.observar(codigo, (sala) => desenhar(sala)) // sala ou null
await host.sala.jogar(codigo, { estado, vez: 'pretas' })

const convite = host.sala.conviteRecebido() // aberto pelo link? o código, ou null
const r = await host.sala.entrar(convite) // { ok } ou { erro: 'nao-encontrada' | 'propria' | 'cheia' | 'sem-conta' }
```

A sala chega com `anfitriao`, `nomeDoAnfitriao`, `convidado`, `nomeDoConvidado`, `situacao` (`esperando`, `jogando`, `encerrada`), `vez`, `estado`, `vencedor` e `anfitriaoSaiu`. O jogo que usa sala declara `"capacidades": ["sala"]` e `"aceitaConvite": true` no `jogo.json`.

No `yarn dev` do jogo, o host de desenvolvimento joga online entre duas abas do mesmo navegador: crie a sala numa aba e abra o link (a própria página com `?sala=<código>`) em outra aba nova. Não duplique a aba, que copia o `sessionStorage` e vira o mesmo jogador. No teste, o host falso faz o outro jogador com `host.disparar('sala', { acao: 'entrar', codigo, uid: 'bia' })`, e `criarHostFalso({ convite: 'ABC23' })` abre o jogo como se viesse do link.

## 3. Sala ao vivo: `salaAoVivo`

Desde a 0.3.0. Vários jogadores no mesmo mundo, em tempo real: a presença de cada um, o que só o anfitrião simula, a fila de intenções dos convidados, os pedaços do mundo que mudaram. O host dá o código, o link do convite e quem é o jogador, e guarda a sala no nó que é daquele jogo; o jogo lê e escreve caminhos **dentro da sala** (`''` é a sala inteira), com as operações do Realtime Database. O que cada nó significa é do jogo; quem decide quem escreve onde é a regra do banco, não o SDK.

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

As garantias, nos três hosts: caminho com `.`, `#`, `$`, `[`, `]`, caractere de controle, `..` ou segmento vazio, e `undefined`, função, `NaN` ou `Date` em qualquer ponto do valor, lançam `TypeError` na hora da chamada. Escrita recusada (regra do banco, rede, sala que esta janela não criou nem entrou) resolve `false`, ou `null` no `empurrar`, e nunca lança. A primeira entrega de `observar`, `observarFilhos` e `conectado` nunca sai dentro da chamada. O valor volta como o banco devolve: objeto vazio some, e array é guardado por índice e volta array quando as chaves são inteiras e mais da metade dos índices está preenchida.

No teste, o host falso faz os outros jogadores e a regra do banco:

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

O jogo que usa sala ao vivo declara `"capacidades": ["salaAoVivo"]` e `"aceitaConvite": true`.

## 4. O jogo salvo: `progresso`

Desde a 0.3.0. Um documento por jogo, na conta do jogador. "Não tem save" e "não consegui ler" são respostas diferentes, porque confundir as duas grava um mundo vazio por cima de meses de construção.

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

`salvar` substitui o documento; com `mesclar`, funde mapa com mapa, como o `merge` do Firestore. Os hosts de teste recusam com `false` o que o Firestore recusa: `undefined`, array dentro de array, objeto que não é mapa simples (e `Date`), campo de nome vazio ou como `__assim__`, e documento acima de 1 MiB. O host de desenvolvimento guarda em `roqueos:<jogo>:progresso`; o host falso recebe `progresso: { salvo, falharLeitura, falharEscrita }`.

## 5. Presença e retomada: `presenca` e `retomada`

`presenca` (0.7.0): `entrar({ mapa, pose, aparencia })`, `pose(p)` (o host deixa sair até 10 por segundo e descarta o resto), `observar(fn)` (só quem está no mesmo mapa, sem o próprio jogador), `trocarDeMapa`, `sair` e `conectado`. Mapa fora de `a-z`, `0-9` e hífen, ou pose sem `x` e `y` numéricos, é `TypeError` na hora. O host de desenvolvimento leva a presença entre abas por um `BroadcastChannel`; o host falso recebe `disparar('presenca', { t: 'entrou' | 'pose' | 'mapa' | 'saiu' | 'conexao', ... })` ([`src/host/presenca.js`](../../src/host/presenca.js)).

`retomada` (0.6.0): `estado()` (`'conta'`, `'convidado'` ou `'sem-onde'`), `link()` (um link de uso único, com prazo, para continuar em outro aparelho, ou `null`), `revogar()` e `levarParaConta()`. O jogo nunca vê segredo nem código; o código vai no fragmento da URL ([`src/contrato.js`](../../src/contrato.js)).

## 6. O kit de modelos 3D

Desde a 0.4.0. O `assets/importar.json` lista cada modelo com saída, licença, fonte e origem; o `jogo assets importar` escreve o GLB comprimido, fixa o original em `assets/source-lock.json` e escreve a linha do `ASSETS.md` com o SHA-256. O jogo instala as ferramentas em devDependencies: `@gltf-transform/core`, `extensions` e `functions` 4.5.1, `meshoptimizer` 1.1.1 e `sharp` 0.35.4. No jogo, `@roqueos-games/jogo-sdk/modelos` carrega e acende:

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

Para o cenário inteiro de uma vez, `criarCenario` junta modelos, texturas PBR (`cor`, `normal` e `arm` em `texturas/<id>/`, como o importador escreve) e o céu HDR. O que não chegar fica em `faltaram` e o jogo segue com o desenho de antes:

```js
const cenario = criarCenario({ THREE, GLTFLoader, MeshoptDecoder, RGBELoader, base, perfil })
await cenario.carregar({ modelos: { banco: 'modelos/banco.gltf' }, texturas: ['piso'], ceu })
cenario.vestir(chao.material, 'piso', 6, 4) // repetição própria, sem vazar para outro material
cena.add(cenario.modelo('banco', 0.75)) // 75 cm de altura, pé no chão, centrado
cenario.aplicarCeu(renderer, cena, { fundo: true })
```

O que só o desktop carrega mora numa pasta `alto/`, fora dos 30 MB do perfil baixo. `jogo olho antes` e `jogo olho depois` fotografam o mesmo roteiro em desktop, celular e TV e medem o quadro; o jogo instala o `playwright` 1.60.0.

## 7. Gráfico e o painel de configurações

Desde a 0.4.0: qualidades Baixo, Médio, Alto e Ultra, cada efeito ligável à parte (GTAO, bloom, borrão de movimento da câmera, antisserrilhado, vinheta), FOV, a escolha guardada no `armazenamento` do host, e a cadeia de pós-processamento sobre o three do próprio jogo ([`src/grafico.js`](../../src/grafico.js), [`src/painel.js`](../../src/painel.js)).

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

## 8. Som e a tela de entrada

Desde a 0.5.0, a régua que a Sinuca firmou para todos os jogos: som gravado em alta definição desde a primeira jogada, no espaço, e uma tela de entrada que mede a carga de verdade ([`src/som.js`](../../src/som.js), [`src/carga.js`](../../src/carga.js), [`src/pacote.js`](../../src/pacote.js)).

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

Cada golpe sai do grafo de áudio quando acaba (o panner HRTF é o nó mais caro). Sem pacote ou sem contexto, `tocar` devolve `false` e o jogo toca a síntese de reserva (`blip`).

## 9. O lado do host

Um host é um objeto com `versaoDoContrato: 1` e as capacidades nas formas de `CAPACIDADES`. Antes de entregar, confira do jeito que o `mount` vai conferir:

```js
import { verificarHost } from '@roqueos-games/jogo-sdk'

const { ok, problemas } = verificarHost(host, { exigidas: ['sala'] })
```

Para o host do RoqueOS recusar exatamente o que os hosts de teste recusam, as regras são exportadas: `@roqueos-games/jogo-sdk/sala-ao-vivo` (`segmentosDoCaminho`, `conferirValor`, `conferirAtualizacao`, `normalizarCodigoDaSala`, `MARCADOR_DA_HORA`) e `@roqueos-games/jogo-sdk/presenca` (`conferirMapa`, `conferirPose`, `conferirAparencia`, `POSES_POR_SEGUNDO`). Os nomes da sala (`anfitriao`, `situacao`) são do SDK; traduzir para os campos do banco é trabalho do host do RoqueOS ([`src/contrato.js`](../../src/contrato.js)).

## 10. CI: `jogo check --json`

```bash
node node_modules/@roqueos-games/jogo-sdk/bin/jogo.mjs check --json
```

Ele imprime uma linha de JSON, `{ "ok": boolean, "pasta": "<caminho absoluto>", "secoes": [{ "secao": "<nome>", "problemas": ["..."] }] }`, e sai 1 quando `ok` é `false` ([`bin/jogo.mjs`](../../bin/jogo.mjs)). A entrada `bin` do [`package.json`](../../package.json) também o expõe como `jogo` dentro do jogo, então `yarn jogo check` funciona lá.
