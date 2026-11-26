# Operations

_English | [Português](pt-BR/OPERACAO.md)_

> **Who it is for:** the maintainer who keeps the SDK healthy, cuts a release and moves the games to it.
> **What is here:** the routine, how a version is published, how to update without breaking the games and RoqueOS, how to undo, what there is to back up, and what to watch.
> **Where to go for the rest:** what can change in a minor version and what cannot, in [ARCHITECTURE.md](ARCHITECTURE.md#8-design-decisions); how to add a capability or a rule, in [EXTENDING.md](EXTENDING.md).

## Contents

1. [The routine](#1-the-routine)
2. [Publishing a version](#2-publishing-a-version)
3. [Updating without breaking](#3-updating-without-breaking)
4. [Undoing](#4-undoing)
5. [Backup and restore](#5-backup-and-restore)
6. [Monitoring](#6-monitoring)

## 1. The routine

Nothing runs on a schedule. The SDK has no server and no job; what runs by itself is the `verificar` workflow on GitHub Actions, on every push to `main` and every pull request, forks included ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)).

The maintenance loop in [`.claude/loop.md`](../.claude/loop.md) is the routine, one thing per iteration, stopping at the first one with work: the gate red, GitHub CI red, an outside issue or pull request without an answer, an asset without provenance, the SDK behind (in a game), and documentation drift.

```bash
yarn verificar          # the gate
gh run list --limit 3   # the last CI runs
gh issue list           # outside issues
gh pr list              # outside pull requests
```

Red on GitHub and green locally means the environments diverged, and that is investigated before anything else ([`.claude/loop.md`](../.claude/loop.md)).

## 2. Publishing a version

There is no release script in the repo and no npm publication: games install the SDK from GitHub by tag. A version, as the history shows it, is three things that go together:

1. `version` in [`package.json`](../package.json) (today `0.7.0`).
2. A section at the top of [`CHANGELOG.md`](../CHANGELOG.md) with the version, the date, what changed and why, and whether the contract version moved.
3. A `vX.Y.Z` git tag on that commit, which is what games pin.

```bash
yarn verificar
git tag v0.7.1
git push origin v0.7.1
```

The tag is created after the change is on `main`, through a reviewed pull request ([`.github/CODEOWNERS`](../.github/CODEOWNERS)).

## 3. Updating without breaking

The contract decides what kind of version a change is ([`src/contrato.js`](../src/contrato.js)):

| Change                                               | Version                                      | Who has to act                                                              |
| ---------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------- |
| A new optional capability                            | minor                                        | nobody; a game that does not declare it does not receive it                 |
| A new kit, a new `jogo check` rule, a new CLI option | minor, or patch for a fix                    | games, when they bump: a new rule can fail a game that passed               |
| A different shape for a capability that exists       | new `VERSAO_DO_CONTRATO`                     | the RoqueOS host and every game; the host refuses a game on another version |
| The `ia` change of 0.3.0                             | stayed on contract 1 as a measured exception | not a precedent ([`CHANGELOG.md`](../CHANGELOG.md))                         |

Before a tag that adds a `jogo check` rule, run the new SDK against the games you have locally, so the release note can say which ones fail:

```bash
node bin/jogo.mjs check ../um-jogo
```

In each game, the bump is a change to the pin in its `package.json`, with its own `yarn verificar` green and its changelog saying what changed ([`.claude/loop.md`](../.claude/loop.md)).

## 4. Undoing

| Step                                         | How to go back                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A merged change that should not have shipped | `git revert` in a pull request, and a new patch version                                                                                                                                                                                                                                                                |
| A tag that games already pin                 | the repo has no documented procedure for retracting a tag. What is known: RoqueOS installs each game at an exact version with the SHA locked in the lockfile ([`SECURITY.md`](../SECURITY.md)), so a moved tag would not reach anyone already locked; publishing a new patch version is the path that reaches everyone |
| A game bumped to a version that breaks it    | the game goes back to the previous tag in its `package.json`                                                                                                                                                                                                                                                           |
| `jogo assets importar` overwrote outputs     | `git checkout -- public/ ASSETS.md assets/source-lock.json` in the game, as long as they were committed                                                                                                                                                                                                                |

## 5. Backup and restore

The SDK keeps no data. The repository on GitHub is the backup, and the history of what each version promised is the [`CHANGELOG.md`](../CHANGELOG.md).

What does hold data is the development host, in the browser that runs a game's `yarn dev`: storage, the save and the rooms live in `localStorage` under `roqueos:<jogo>:...` ([REFERENCE.md](REFERENCE.md#keys-url-parameters-and-environment)). It is test data. To start over, clear those keys in the browser's devtools. The player's real data lives in the RoqueOS host, outside this repo.

## 6. Monitoring

| What to look at       | Where                                                                    | Healthy                                                                      |
| --------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| The gate              | `yarn verificar`                                                         | ends in `ok, o repo cumpre o contrato.`; on 18/11/2026: 284 tests, 0 failing |
| The mutants           | `yarn mutantes`                                                          | `ok, os 34 mutantes morreram.` (34 on 18/11/2026, in about 24 s)             |
| GitHub CI             | `gh run list --limit 3`                                                  | the last `verificar` runs green                                              |
| Outside contributions | `gh issue list`, `gh pr list`                                            | none waiting without an answer                                               |
| Security reports      | GitHub private vulnerability reporting ([`SECURITY.md`](../SECURITY.md)) | answered within seven days                                                   |
