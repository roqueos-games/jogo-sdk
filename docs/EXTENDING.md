# Extending

_English | [Português](pt-BR/ESTENDER.md)_

> **Who it is for:** whoever is adding a piece the SDK was made to receive: a capability, a `jogo check` rule, a CLI command or option, a tag, a kit.
> **What is here:** for each extension point, the files that change, what else changes with them, and the check that fails when a step is missing.
> **Where to go for the rest:** what kind of version each change is, in [OPERATIONS.md](OPERATIONS.md#3-updating-without-breaking); how to prove a rule, in [TESTING.md](TESTING.md).

## Contents

1. [Before anything](#1-before-anything)
2. [A new optional capability](#2-a-new-optional-capability)
3. [Changing the shape of a capability](#3-changing-the-shape-of-a-capability)
4. [A new `jogo check` rule](#4-a-new-jogo-check-rule)
5. [A new CLI command or option](#5-a-new-cli-command-or-option)
6. [A new gallery tag](#6-a-new-gallery-tag)
7. [A new kit entry point](#7-a-new-kit-entry-point)

## 1. Before anything

A change to the contract reaches the closed `roqueos-front` and every game in the organization ([`CLAUDE.md`](../CLAUDE.md)). Open an issue before changing [`src/contrato.js`](../src/contrato.js): the conversation comes before the code ([CONTRIBUTING.md](../CONTRIBUTING.md)). Every new rule comes with a test that fails without it, and the SDK never gains a runtime dependency or an install script.

## 2. A new optional capability

1. Add it to `CAPACIDADES` in [`src/contrato.js`](../src/contrato.js) with `obrigatoria: false`, the `forma`, and the `porque`. The reason is part of the contract: a capability without one becomes a shortcut for the game to reach what it should not. Document each function in a comment above it, as `sala`, `salaAoVivo`, `progresso`, `presenca` and `retomada` do.
2. Implement it in both test hosts, [`src/host/desenvolvimento.js`](../src/host/desenvolvimento.js) and [`src/host/falso.js`](../src/host/falso.js). Shared rules go in their own file under [`src/host/`](../src/host/), because two copies of a rule diverge at the first fix. Give the fake host an option to remove it (`<nome>: false`) and a `disparar` case for what comes from outside.
3. Export the rules the RoqueOS host must apply, through a new entry in `exports` of [`package.json`](../package.json), as `./sala-ao-vivo` and `./presenca` do.
4. Tests in a new `test/<nome>.test.js`, and at least one mutant in [`test/mutantes.mjs`](../test/mutantes.mjs) for each rule that protects the player.
5. A minor version in [`CHANGELOG.md`](../CHANGELOG.md), saying the contract stays on version 1, and the capability in [INTEGRATIONS.md](INTEGRATIONS.md).

What catches a missing step: `verificarHost` only looks at an optional capability that is present or required, so a host that forgot it passes silently. [`test/contrato.test.js`](../test/contrato.test.js) closes that gap per capability, calling `verificarHost(host, { exigidas: ['<nome>'] })` on both SDK hosts, as it does for `sala` and `retomada`; write that test for the new one.

## 3. Changing the shape of a capability

It is a new `VERSAO_DO_CONTRATO`. The host refuses a game on another version instead of breaking at runtime ([`src/contrato.js`](../src/contrato.js)), so the RoqueOS host and every game move together. The only exception so far is `ia` in 0.3.0, kept on version 1 because nobody used it, measured and recorded in the [`CHANGELOG.md`](../CHANGELOG.md); it is not a precedent.

## 4. A new `jogo check` rule

1. A `conferir<Algo>(raiz)` function in [`src/verificacao.js`](../src/verificacao.js) that returns a list of problems, each saying the file and the reason. The comment above it says what already cost dear without it.
2. A section in `verificarRepo`, with a name that says what it checks.
3. The tests in [`test/verificacao.test.js`](../test/verificacao.test.js): one that fails, one that passes, using [`test/fixtures/jogo-ok/`](../test/fixtures/jogo-ok/) as the valid base.
4. A mutant in [`test/mutantes.mjs`](../test/mutantes.mjs) that removes the rule; `yarn mutantes` must end with all mutants dead.
5. A changelog entry that says which games may start failing.

There is no warning level: a problem that does not fail is a problem nobody fixes ([`bin/jogo.mjs`](../bin/jogo.mjs)).

## 5. A new CLI command or option

1. Declare it in `COMANDOS` in [`src/cli.js`](../src/cli.js): `uso`, `resumo`, `posicionais`, and each option with `tipo` (`bandeira` or `valor`), `ajuda` and, when the value can be wrong, `validar`.
2. Add the branch in [`bin/jogo.mjs`](../bin/jogo.mjs). A command declared without a branch exits 2 with `jogo: <comando> está declarado mas não tem implementação`.
3. Tests in [`test/cli.test.js`](../test/cli.test.js), including that `--usage` and an unknown option write nothing.

The parse runs whole before any command touches the disk, and an undeclared option exits 2. That is the 0.5.1 rule and it does not reopen ([ARCHITECTURE.md](ARCHITECTURE.md#8-design-decisions)).

## 6. A new gallery tag

`ETIQUETAS` in [`src/manifesto.js`](../src/manifesto.js) is a closed list because the translated label lives in RoqueOS under `games.tag<Etiqueta>`. A new tag is a change on both sides: here, and the key in the ten languages in the front. [`test/manifesto.test.js`](../test/manifesto.test.js) covers the list.

## 7. A new kit entry point

A kit is a file in [`src/`](../src/) with its own entry in `exports` of [`package.json`](../package.json) (as `./som` and `./carga`). It never imports three or any runtime package: the game hands over the modules of its own version, because two copies of three on one page break `instanceof` ([`src/modelos.js`](../src/modelos.js)). Heavy tools are the game's devDependencies, and the error when they are missing prints the exact `yarn add -D` line ([`src/importador.js`](../src/importador.js)). The kit gets its test file, its mutants for the rules that matter, and a section in [INTEGRATIONS.md](INTEGRATIONS.md).
