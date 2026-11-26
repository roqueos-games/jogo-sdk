# When it breaks

_English | [Português](pt-BR/QUANDO-QUEBRA.md)_

> **Who it is for:** whoever saw the gate, `jogo check`, a host or the CLI fail and wants the cause and the fix.
> **What is here:** the first diagnostic command, then one table per area with what appears, the cause and what to do; failures that already happened carry the date.
> **Where to go for the rest:** the formats each check reads, in [REFERENCE.md](REFERENCE.md); why each rule exists, in [ARCHITECTURE.md](ARCHITECTURE.md#8-design-decisions).

## Contents

1. [First, the diagnostic](#first-the-diagnostic)
2. [Installing](#installing)
3. [The gate](#the-gate)
4. [Mounting a game](#mounting-a-game)
5. [`jogo check` in a game](#jogo-check-in-a-game)
6. [The CLI and the importer](#the-cli-and-the-importer)
7. [Hosts, rooms and saves](#hosts-rooms-and-saves)

The programs print in Portuguese; the messages below are quoted exactly as they appear.

## First, the diagnostic

```bash
yarn verificar                                  # in the SDK: where the gate stops
node bin/jogo.mjs check ../caminho-do-jogo --json   # a game: every section, as data
```

`jogo check` prints every problem of every section at once, never only the first, and exits 1 if there is any ([`bin/jogo.mjs`](../bin/jogo.mjs)).

## Installing

| What appears                                                                             | Cause                                                                                      | What to do                                                                                                             |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| ``error Your lockfile needs to be updated, but yarn was run with `--frozen-lockfile`.``  | `package.json` and `yarn.lock` disagree, usually a dependency changed without the lock     | install without the flag only if the dependency change is intended, and commit `package.json` and `yarn.lock` together |
| `The engine "node" is incompatible with this module. Expected version ">=22". Got "..."` | Node older than 22 (`engines` in [`package.json`](../package.json))                        | `nvm use` (the [`.nvmrc`](../.nvmrc) says 24); reproduced on 18/11/2026 with a fake `engines`, the message is Yarn's   |
| a game's `yarn install` runs a script of the SDK                                         | it cannot: the SDK declares no install script, and `jogo check --sdk` fails if one appears | if it happens, the `package.json` changed; `yarn jogo:check` points to the script                                      |

## The gate

| What appears                                                                          | Cause                                                                                              | What to do                                                                                                 |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `[warn] Code style issues found in the above file. Run Prettier with --write to fix.` | a file, Markdown included, is not in Prettier format ([`.prettierrc`](../.prettierrc))             | `yarn format`, review the diff, commit                                                                     |
| `# fail 1` in the `yarn test` summary                                                 | a test failed: the code is wrong, not the test                                                     | read the failing `not ok` above the summary; never weaken the test ([CONTRIBUTING.md](../CONTRIBUTING.md)) |
| `REPROVOU  scripts de instalação` in `yarn jogo:check`                                | `package.json` declares `preinstall`, `install`, `postinstall`, `prepare`, `prepack` or `postpack` | remove the script; the reason is in [`src/verificacao.js`](../src/verificacao.js)                          |
| `SOBREVIVEU` in `yarn mutantes`                                                       | a rule was broken on purpose and the suite still passed: the rule has no test                      | write the test that fails without the rule ([TESTING.md](TESTING.md))                                      |
| `NÃO APLICOU` in `yarn mutantes`                                                      | the code the mutant replaces changed, so the mutant no longer matches                              | update the mutant in [`test/mutantes.mjs`](../test/mutantes.mjs) to the new code                           |

## Mounting a game

| What appears                                                                  | Cause                                                                          | What to do                                                                                               |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `[oi] host não cumpre o contrato: falta a capacidade "identidade"; ...`       | the host lacks a mandatory capability, or one the game listed in `capacidades` | implement what the list says; all problems come in one message ([`src/contrato.js`](../src/contrato.js)) |
| `host fala o contrato 2, o jogo fala o 1`                                     | host and game are on different contract versions                               | pin the game to an SDK tag on the host's version                                                         |
| `id de jogo inválido: "Meu-Jogo" (minúsculas e dígitos, começando por letra)` | `definirJogo` received an id outside `^[a-z][a-z0-9]*$`                        | use lowercase letters and digits ([`src/index.js`](../src/index.js))                                     |
| `montar precisa devolver { ativar, desmontar }`                               | `montar` returned nothing or no `desmontar`                                    | return the object; `ativar` is optional, `desmontar` is not                                              |

## `jogo check` in a game

| What appears                                                                                                             | Cause                                               | What to do                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `jogo.json ausente`                                                                                                      | the game has no manifest                            | create it from [`test/fixtures/jogo-ok/jogo.json`](../test/fixtures/jogo-ok/jogo.json)      |
| `i18n/ ausente: o texto do jogo mora no jogo, um JSON por idioma`                                                        | no `i18n/` folder                                   | one JSON per language, `pt-BR.json` as the base                                             |
| `public/... sem linha no ASSETS.md (caminho \| licença \| origem)`                                                       | a file in `public/` without provenance              | add the row with license and source                                                         |
| `public/... mudou desde o import: SHA-256 ...`                                                                           | a file changed by hand after the importer pinned it | run `jogo assets importar --apenas=<id>` again, or fix the row if the change was deliberate |
| `perfil baixo soma ... MB fora de alto/, teto 30 MB; os maiores: ...`                                                    | what the phone downloads is over 30 MB              | move desktop-only files into an `alto/` folder, or shrink them                              |
| `... é do Fab e está cru em public/: a licença manda impedir a extração, só entra num .pak cifrado`                      | a Fab or Sonniss asset outside a `.pak`             | seal it with `selarPacote` ([`src/pacote.js`](../src/pacote.js))                            |
| `src/a.js:1 importa "firebase/app": o jogo não fala com banco, quem fala é o host (salaAoVivo, progresso, placar, sala)` | the game imports Firebase                           | use the capability; a commented import does not count                                       |
| `capacidades tem sala e aceitaConvite é false: o link do convite abriria o RoqueOS sem abrir o jogo`                     | a game with a room that refuses invites             | set `"aceitaConvite": true`                                                                 |

## The CLI and the importer

| What appears                                                                                         | Cause                                                                             | What to do                                                                                                                    |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `jogo assets importar: --apenas precisa de valor: --apenas=…` (exit 2)                               | `--apenas palmeira` with a space                                                  | `--apenas=palmeira`                                                                                                           |
| `opção desconhecida --x` (exit 2)                                                                    | an option the command does not declare                                            | `jogo <comando> --usage` lists the ones that exist                                                                            |
| the whole catalog reimported over the files, when the intent was to see the help (18/10/2026, twice) | before 0.5.1 the CLI ignored flags it did not read, and `--usage` was one of them | fixed in 0.5.1: help wins over everything and unknown options exit 2 before touching the disk ([`src/cli.js`](../src/cli.js)) |
| `--apenas: o id "x" não está em assets/importar.json`                                                | a typo in the id                                                                  | fix the id; nothing was written                                                                                               |
| `ENOENT: no such file or directory, open '.../assets/importar.json'`                                 | the command ran outside the game root                                             | `cd` to the game repo                                                                                                         |
| `falta @gltf-transform/core no jogo: yarn add -D ...`                                                | the game lacks the importer's tools                                               | run the `yarn add -D` line the message prints                                                                                 |
| `modelo FBX/OBJ/.blend precisa do Blender: instale ou aponte BLENDER=`                               | no Blender found                                                                  | install Blender or set `BLENDER` to its binary                                                                                |
| `a fonte fixada mudou: ... (era ..., veio ...)`                                                      | the original at the source is not the one pinned in `assets/source-lock.json`     | check the new original; if it is right, remove its entry from the lock and import again                                       |
| `jogo olho precisa de um rótulo simples: antes, depois, g81…`                                        | `jogo olho` without a label                                                       | `jogo olho antes`                                                                                                             |
| `roteiro ausente: olho/roteiro.mjs (o caminho até a partida é do jogo)`                              | the game has no script for the olho                                               | write `olho/roteiro.mjs` ([`src/olho.js`](../src/olho.js))                                                                    |
| `falta o Playwright no jogo: yarn add -D playwright@1.60.0 && yarn playwright install chromium`      | the game lacks Playwright                                                         | run the line                                                                                                                  |
| `vite` left holding port 5199 after `jogo olho` (16/10/2026, first run)                              | killing only `yarn` left its child `vite` alive                                   | fixed: the server runs in its own process group and the whole group is killed                                                 |

## Hosts, rooms and saves

| What appears                                                                                                                                                         | Cause                                                                                       | What to do                                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `TypeError: caminho "a.b" tem ".", que o banco não aceita em chave ...`                                                                                              | a live-room path with `.`, `#`, `$`, `[`, `]` or a control character                        | the error comes at call time on purpose; change the path                                                                                        |
| `progresso.salvar` returns `false` and the fake host's `avisosDoHost` says `... é array dentro de array, que o Firestore recusa ("Nested arrays are not supported")` | the save has something Firestore refuses; it is what catches RoqueCraft's `outrasDimensoes` | change the shape of the save (an object of arrays instead of an array of arrays)                                                                |
| `progresso.carregar()` rejects with `codigo === 'indisponivel'`                                                                                                      | the save could not be read                                                                  | do not write over it; warn with `avisar(..., { fixo: true })` and let the player retry                                                          |
| the invite tab on WebKit never sees the other tab's writes (26/09/2026, WebKit 26.4)                                                                                 | WebKit only delivers the `storage` event to a tab that already read `localStorage`          | fixed in the development host, which reads `localStorage` once when it starts ([`src/host/desenvolvimento.js`](../src/host/desenvolvimento.js)) |
| both tabs act as the same player                                                                                                                                     | the second tab was duplicated, which copies `sessionStorage`                                | open the link in a new tab instead of duplicating                                                                                               |
