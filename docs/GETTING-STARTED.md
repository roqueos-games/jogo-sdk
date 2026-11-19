# Getting started

_English | [Português](pt-BR/COMECAR.md)_

> **Who it is for:** whoever arrives with nothing installed, to contribute to the SDK or to use it in a game.
> **What is here:** the prerequisites with the command that checks each one, the install, the first visible result, the gate, and how a game repo starts depending on the SDK.
> **Where to go for the rest:** the capabilities and the kits, in [INTEGRATIONS.md](INTEGRATIONS.md); every command, in [REFERENCE.md](REFERENCE.md); what fails the first time, in [WHEN-IT-BREAKS.md](WHEN-IT-BREAKS.md).

## Contents

1. [What you need](#1-what-you-need)
2. [Download and install](#2-download-and-install)
3. [The first result](#3-the-first-result)
4. [Check that everything is right](#4-check-that-everything-is-right)
5. [Using the SDK in a game](#5-using-the-sdk-in-a-game)
6. [Next steps](#6-next-steps)
7. [When something does not work](#7-when-something-does-not-work)

## 1. What you need

| Tool | Version                                                                                       | How to check     | Where it comes from                       |
| ---- | --------------------------------------------------------------------------------------------- | ---------------- | ----------------------------------------- |
| Node | 24 (from [`.nvmrc`](../.nvmrc)), 22 at least (`engines` in [`package.json`](../package.json)) | `node --version` | nodejs.org or `nvm use`                   |
| Yarn | 1.22 (`packageManager: yarn@1.22.22`)                                                         | `yarn --version` | `corepack enable` or the Yarn 1 installer |
| Git  | any recent                                                                                    | `git --version`  | your system                               |

There is no runtime dependency. The devDependencies are ESLint, Prettier, three (only for the model kit test) and the importer's tools, for its end-to-end test.

## 2. Download and install

```bash
git clone https://github.com/roqueos-games/jogo-sdk.git
cd jogo-sdk
yarn install --frozen-lockfile --ignore-scripts
```

`--ignore-scripts` is the house rule: nothing runs by itself on install, the same rule `jogo check` enforces in every game ([CONTRIBUTING.md](../CONTRIBUTING.md)). The install ends with `warning Ignored scripts due to flag.` and `Done`.

## 3. The first result

Check the sample game that ships with the tests:

```bash
node bin/jogo.mjs check test/fixtures/jogo-ok
```

What appears when it works (measured on 18/11/2026):

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

Then mount a game on the fake host, without a browser:

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

It prints `[ { capacidade: 'metricas', metodo: 'evento', args: [ 'abriu', {} ] } ]`: the fake host recorded what the game asked of the system.

## 4. Check that everything is right

```bash
yarn verificar
```

It runs lint, format, the tests and `jogo check --sdk`, the same as CI ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)). Measured on 18/11/2026: 284 tests in 43 suites, 0 failing, ending in `ok, o repo cumpre o contrato.` Optionally, `yarn mutantes` breaks each rule on purpose and ends in `ok, os 34 mutantes morreram.`

## 5. Using the SDK in a game

In the game repo, the SDK enters as a git dependency pinned by tag:

```json
{ "dependencies": { "@roqueos-games/jogo-sdk": "github:roqueos-games/jogo-sdk#v0.7.0" } }
```

The smallest game:

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

To run it alone, mount it on `criarHostDeDesenvolvimento({ jogoId: 'exemplo' })` from `@roqueos-games/jogo-sdk/host-de-desenvolvimento`; to test it, on `criarHostFalso()` from `@roqueos-games/jogo-sdk/host-falso`. The game's CI runs `jogo check`, which needs `jogo.json`, `i18n/` in the ten languages and `ASSETS.md` for whatever is in `public/` ([REFERENCE.md](REFERENCE.md#files-and-folders)).

## 6. Next steps

- How each capability is used, with code: [INTEGRATIONS.md](INTEGRATIONS.md).
- How the SDK is built inside: [ARCHITECTURE.md](ARCHITECTURE.md).
- Adding a capability, a rule or a command: [EXTENDING.md](EXTENDING.md).
- What each test proves: [TESTING.md](TESTING.md).

## 7. When something does not work

The most common first-time failures: `yarn` refusing because the lockfile changed (use `--frozen-lockfile` and do not commit a new lock by accident), `yarn format:check` failing on a Markdown file you edited (run `yarn format`), and Node older than 22. Each one, with the literal message, is in [WHEN-IT-BREAKS.md](WHEN-IT-BREAKS.md#installing).
