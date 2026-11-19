# Começar

_[English](../GETTING-STARTED.md) | Português_

> **Para quem:** quem chega sem nada instalado, para contribuir com o SDK ou para usá-lo num jogo.
> **O que tem aqui:** os pré-requisitos com o comando que confere cada um, a instalação, o primeiro resultado visível, o gate, e como um repo de jogo passa a depender do SDK.
> **Onde ir para o resto:** as capacidades e os kits, em [INTEGRACOES.md](INTEGRACOES.md); cada comando, na [REFERENCIA.md](REFERENCIA.md); o que falha na primeira vez, em [QUANDO-QUEBRA.md](QUANDO-QUEBRA.md).

## Sumário

1. [O que você precisa](#1-o-que-você-precisa)
2. [Baixar e instalar](#2-baixar-e-instalar)
3. [O primeiro resultado](#3-o-primeiro-resultado)
4. [Conferir que está tudo certo](#4-conferir-que-está-tudo-certo)
5. [Usar o SDK num jogo](#5-usar-o-sdk-num-jogo)
6. [Próximos passos](#6-próximos-passos)
7. [Quando algo não funciona](#7-quando-algo-não-funciona)

## 1. O que você precisa

| Ferramenta | Versão                                                                                             | Como conferir    | De onde vem                                 |
| ---------- | -------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------- |
| Node       | 24 (do [`.nvmrc`](../../.nvmrc)), 22 no mínimo (`engines` no [`package.json`](../../package.json)) | `node --version` | nodejs.org ou `nvm use`                     |
| Yarn       | 1.22 (`packageManager: yarn@1.22.22`)                                                              | `yarn --version` | `corepack enable` ou o instalador do Yarn 1 |
| Git        | qualquer recente                                                                                   | `git --version`  | o seu sistema                               |

Não há dependência de runtime. As de desenvolvimento são ESLint, Prettier, o three (só para o teste do kit de modelos) e as ferramentas do importador, para o teste de ponta a ponta dele.

## 2. Baixar e instalar

```bash
git clone https://github.com/roqueos-games/jogo-sdk.git
cd jogo-sdk
yarn install --frozen-lockfile --ignore-scripts
```

O `--ignore-scripts` é a regra da casa: nada roda sozinho no install, a mesma regra que o `jogo check` cobra de todo jogo ([CONTRIBUTING.md](CONTRIBUTING.md)). A instalação termina com `warning Ignored scripts due to flag.` e `Done`.

## 3. O primeiro resultado

Confira o jogo de exemplo que vem com os testes:

```bash
node bin/jogo.mjs check test/fixtures/jogo-ok
```

O que aparece quando dá certo (medido em 18/11/2026):

```text
ok        scripts de instalação
ok        manifesto
ok        textos nos dez idiomas
ok        origem dos assets
ok        peso por perfil (30 MB baixo, 120 MB alto)
ok        asset do Fab e do Sonniss só cifrado e em jogo fechado
ok        o jogo não fala com banco

ok, o repo cumpre o contrato.
```

Depois, monte um jogo no host falso, sem navegador:

```bash
node --input-type=module -e "
import { definirJogo } from './src/index.js'
import { criarHostFalso } from './src/host/falso.js'
const jogo = definirJogo({ id: 'oi', montar(el, host) { host.metricas.evento('abriu'); return { desmontar() {} } } })
const host = criarHostFalso()
jogo.mount({}, host).desmontar()
console.log(host.chamadas)
"
```

Ele imprime `[ { capacidade: 'metricas', metodo: 'evento', args: [ 'abriu', {} ] } ]`: o host falso anotou o que o jogo pediu ao sistema.

## 4. Conferir que está tudo certo

```bash
yarn verificar
```

Ele roda lint, formato, os testes e o `jogo check --sdk`, o mesmo do CI ([`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)). Medido em 18/11/2026: 284 testes em 43 suítes, nenhum falhando, terminando em `ok, o repo cumpre o contrato.` Se quiser, o `yarn mutantes` quebra cada régua de propósito e termina em `ok, os 34 mutantes morreram.`

## 5. Usar o SDK num jogo

No repo do jogo, o SDK entra como dependência git pinada por tag:

```json
{ "dependencies": { "@roqueos-games/jogo-sdk": "github:roqueos-games/jogo-sdk#v0.7.0" } }
```

O menor jogo:

```js
import { definirJogo } from '@roqueos-games/jogo-sdk'

export default definirJogo({
  id: 'exemplo',
  montar(el, host, { ativo }) {
    const canvas = el.appendChild(document.createElement('canvas'))
    host.metricas.evento('abriu')
    return {
      ativar(sim) {},
      desmontar() {
        canvas.remove()
      },
    }
  },
})
```

Para rodar sozinho, monte no `criarHostDeDesenvolvimento({ jogoId: 'exemplo' })` de `@roqueos-games/jogo-sdk/host-de-desenvolvimento`; para testar, no `criarHostFalso()` de `@roqueos-games/jogo-sdk/host-falso`. O CI do jogo roda o `jogo check`, que pede `jogo.json`, `i18n/` nos dez idiomas e `ASSETS.md` para o que estiver em `public/` ([REFERENCIA.md](REFERENCIA.md#arquivos-e-pastas)).

## 6. Próximos passos

- Como cada capacidade é usada, com código: [INTEGRACOES.md](INTEGRACOES.md).
- Como o SDK é por dentro: [ARQUITETURA.md](ARQUITETURA.md).
- Acrescentar uma capacidade, uma régua ou um comando: [ESTENDER.md](ESTENDER.md).
- O que cada teste prova: [TESTES.md](TESTES.md).

## 7. Quando algo não funciona

As falhas mais comuns da primeira vez: o `yarn` recusando porque o lockfile mudou (use `--frozen-lockfile` e não comite um lock novo sem querer), o `yarn format:check` reprovando um Markdown que você editou (rode `yarn format`), e Node mais velho que o 22. Cada uma, com a mensagem literal, está em [QUANDO-QUEBRA.md](QUANDO-QUEBRA.md#instalação).
