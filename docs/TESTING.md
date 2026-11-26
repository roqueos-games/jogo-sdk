# Testing

_English | [Português](pt-BR/TESTES.md)_

> **Who it is for:** whoever changes the SDK and needs to know what the suite proves, how to run part of it, and what counts as done.
> **What is here:** the gate, what each test file proves, the test helpers, the mutation test, and the acceptance criterion.
> **Where to go for the rest:** when the gate fails, [WHEN-IT-BREAKS.md](WHEN-IT-BREAKS.md#the-gate); the scripts, [REFERENCE.md](REFERENCE.md#repo-scripts).

## Contents

1. [The gate](#1-the-gate)
2. [What each suite proves](#2-what-each-suite-proves)
3. [Helpers and fixtures](#3-helpers-and-fixtures)
4. [The mutation test](#4-the-mutation-test)
5. [The acceptance criterion](#5-the-acceptance-criterion)

## 1. The gate

```bash
yarn verificar                       # lint, format, tests, jogo check --sdk
node --test test/sala.test.js        # one file
yarn mutantes                        # the mutation test, outside the gate
```

`yarn verificar` is the same command on the maintainer's machine and in the `verificar` workflow ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)), which installs with `--frozen-lockfile --ignore-scripts` and runs with read-only permissions and no secret, so a pull request from a fork is judged by a pipeline it does not control. The tests use `node:test`, with no framework. Measured on 18/11/2026: 284 tests in 43 suites, all passing, in about 5 s.

## 2. What each suite proves

| File                                                        | What it proves                                                                                                                                    |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`test/contrato.test.js`](../test/contrato.test.js)         | the contract: every capability has shape and reason, `verificarHost` lists every problem, both SDK hosts comply, and the old `ia` shape now fails |
| [`test/definir-jogo.test.js`](../test/definir-jogo.test.js) | `definirJogo` and `mount`: invalid id, host refused before `montar`, unmount twice                                                                |
| [`test/hosts.test.js`](../test/hosts.test.js)               | the development and fake hosts, including `retomada` on the development host                                                                      |
| [`test/sala.test.js`](../test/sala.test.js)                 | the two-player room on the fake host and between two tabs on the development host                                                                 |
| [`test/sala-ao-vivo.test.js`](../test/sala-ao-vivo.test.js) | the live room: operations, values as the Realtime Database returns them, porting mistakes caught at call time, observers, connection and `aoCair` |
| [`test/progresso.test.js`](../test/progresso.test.js)       | the saved game on both hosts and the document rules Firestore applies                                                                             |
| [`test/presenca.test.js`](../test/presenca.test.js)         | presence: the 10 poses per second ceiling, the map filter, asynchronous first delivery                                                            |
| [`test/manifesto.test.js`](../test/manifesto.test.js)       | `validarManifesto`, field by field                                                                                                                |
| [`test/verificacao.test.js`](../test/verificacao.test.js)   | every `jogo check` rule, failing and passing                                                                                                      |
| [`test/cli.test.js`](../test/cli.test.js)                   | the parse, and the CLI run on a real fake catalog, checking by SHA-256 and mtime that `--usage` and an unknown option write nothing               |
| [`test/importador.test.js`](../test/importador.test.js)     | the import list, the lock and the ledger, the olho helpers, and the importer end to end, including `texturasFora`                                 |
| [`test/modelos.test.js`](../test/modelos.test.js)           | profile, renderer and environment, the path per profile, the loader, `liberar`                                                                    |
| [`test/cenario.test.js`](../test/cenario.test.js)           | `criarCenario`: repetition, the model on the floor, the sky per profile                                                                           |
| [`test/grafico.test.js`](../test/grafico.test.js)           | qualities, the saved choice, blur strength, renderer, post-processing chain, the panel in ten languages                                           |
| [`test/som.test.js`](../test/som.test.js)                   | the sound kit                                                                                                                                     |
| [`test/carga.test.js`](../test/carga.test.js)               | the loading progress                                                                                                                              |
| [`test/pacote.test.js`](../test/pacote.test.js)             | the `.pak`: round trip, nothing in clear, wrong key and tampered pack refused                                                                     |

## 3. Helpers and fixtures

[`test/fixtures/jogo-ok/`](../test/fixtures/jogo-ok/) is a valid game: `jogo.json`, the ten `i18n/` files, `public/` with a cover and an icon, and its `ASSETS.md`. A rule test copies it and breaks one thing.

[`test/janela-falsa.js`](../test/janela-falsa.js) is a minimal browser window for the development host. Two tabs share `localStorage` and each has its own `sessionStorage`; the `storage` event is not delivered by itself, on purpose: the test delivers it by hand, so it proves the event carries the change and controls when it arrives. `storageQuebrado` imitates Safari in private mode, which throws on `getItem`.

## 4. The mutation test

[`test/mutantes.mjs`](../test/mutantes.mjs) replaces a piece of the code that enforces a rule, runs the suite of that file, and restores the original. A mutant must die: the suite fails. `SOBREVIVEU` means the rule has no test; `NÃO APLICOU` means the mutant no longer matches the code. Measured on 18/11/2026: `ok, os 34 mutantes morreram.`, in about 24 s. It is not part of `yarn verificar`.

## 5. The acceptance criterion

A change is done when `yarn verificar` is green, every fix and every new rule has a test that fails without it ([CONTRIBUTING.md](../CONTRIBUTING.md)), and a new rule has a mutant that dies. A test is never weakened to make the gate pass. Changes to the hosts or the kits that a game sees are also proven in a game's `yarn dev`, with the game open ([`.claude/loop.md`](../.claude/loop.md)).
