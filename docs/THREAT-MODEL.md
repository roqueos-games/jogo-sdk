# Threat model

_English | [Português](pt-BR/MODELO-DE-AMEACAS.md)_

> **Who it is for:** whoever reviews a game for RoqueOS, a change to the SDK, or wants to know what the SDK promises in security and what it does not.
> **What is here:** what is protected, from whom, by which mechanism, and what is explicitly not protected.
> **Where to go for the rest:** how to report a vulnerability, in [SECURITY.md](../SECURITY.md); the decisions behind each mechanism, in [ARCHITECTURE.md](ARCHITECTURE.md#8-design-decisions).

## Contents

1. [The premise](#1-the-premise)
2. [What is protected](#2-what-is-protected)
3. [Threats and mechanisms](#3-threats-and-mechanisms)
4. [What is not protected](#4-what-is-not-protected)

## 1. The premise

A game runs on the same origin as RoqueOS. The SDK hands it capabilities instead of the system's stores, and that organizes the code, but it **is not a security boundary**: code on the same origin can read what the page reads ([SECURITY.md](../SECURITY.md)). Every mechanism below exists because of that premise, and none of them pretends to isolate.

## 2. What is protected

| Asset                               | Where it lives                                 | Why it matters                                                                             |
| ----------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------ |
| The RoqueOS user's session and data | the RoqueOS page, same origin as the game      | a malicious game would reach it                                                            |
| The maintainer's machine            | wherever `yarn install` runs a game or the SDK | an install script runs there automatically                                                 |
| AI provider keys                    | the RoqueOS host                               | each call can cost money on the player's account ([`src/contrato.js`](../src/contrato.js)) |
| Fab and Sonniss assets              | `.pak` files in closed games                   | the licenses forbid letting the file out ([`src/verificacao.js`](../src/verificacao.js))   |
| A guest's resume code               | the `retomada` link                            | whoever has the link takes the hero ([`src/contrato.js`](../src/contrato.js))              |
| The player's saved world            | the `progresso` document                       | a wrong write erases months of building                                                    |

## 3. Threats and mechanisms

| Threat                                                          | Mechanism                                                                                                                        | Where                                                     |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Malicious code merged into an open game or into the SDK         | every merge passes the maintainer's review                                                                                       | [`.github/CODEOWNERS`](../.github/CODEOWNERS)             |
| A game version swapped after review                             | RoqueOS installs each game at an exact version with the SHA locked in the lockfile, and every version change is reviewed         | [SECURITY.md](../SECURITY.md)                             |
| A script that runs by itself on `yarn install`                  | `jogo check` fails on `preinstall`, `install`, `postinstall`, `prepare`, `prepack` and `postpack`, and the SDK runs it on itself | [`src/verificacao.js`](../src/verificacao.js)             |
| A pull request from a fork stealing a token                     | the CI runs on `pull_request`, never `pull_request_target`, reads no secret, and has only read permissions                       | [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) |
| A game reaching the database directly                           | `firebase`, `firebase/*` and `@firebase/*` are forbidden in the game's `src/`; the host talks to the database                    | [`src/verificacao.js`](../src/verificacao.js)             |
| A game reading an AI key                                        | `ia` never hands the key to the game; the host decides limit and consent                                                         | [`src/contrato.js`](../src/contrato.js)                   |
| A licensed asset collected by URL                               | Fab and Sonniss only inside an AES-GCM `.pak`, opened in memory, only in a closed game                                           | [`src/pacote.js`](../src/pacote.js)                       |
| A resume code leaking into server logs                          | the code travels in the URL fragment (`#`), which reaches no server and no log                                                   | [`src/contrato.js`](../src/contrato.js)                   |
| An importer path escaping the repo                              | `dentro()` refuses any output path outside the base, since names come from a third-party API or a JSON                           | [`src/importador.js`](../src/importador.js)               |
| A save that the database would refuse, discovered by the player | the test hosts refuse what Firestore refuses, so the game's test fails first                                                     | [`src/host/progresso.js`](../src/host/progresso.js)       |

## 4. What is not protected

- **Isolation.** A game on the same origin reads what RoqueOS reads. Review and pinning are the protection, not the capability boundary.
- **The `.pak` key.** It lives in the game's code, in a private repository. Whoever reads the game's JavaScript reaches the key; it blocks direct download and collection by URL and is not DRM ([`src/pacote.js`](../src/pacote.js)).
- **Database rules.** Who may write where is decided by the RoqueOS database rules, not the SDK. The development host does not emulate them; the fake host's `recusar` only plays their role in tests ([`src/host/salaAoVivo.js`](../src/host/salaAoVivo.js)).
- **The real host.** The RoqueOS host lives outside this repo; nothing here proves how it applies these rules.
- **Dependency confusion in a game.** The SDK has no runtime dependency, but a game's own dependencies are reviewed in the game's repo, not here.
