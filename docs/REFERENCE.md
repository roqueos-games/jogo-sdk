# Reference

_English | [Português](pt-BR/REFERENCIA.md)_

> **Who it is for:** whoever needs to look up one command, entry point, file, key or field without reading the rest.
> **What is here:** tables of the repo scripts, the `jogo` CLI and its exit codes, the package entry points, the files a game repo carries, the keys and URL parameters the hosts use, and the formats of `jogo.json`, `ASSETS.md` and `assets/importar.json`, field by field.
> **Where to go for the rest:** how the pieces fit, in [ARCHITECTURE.md](ARCHITECTURE.md); how to use each capability, in [INTEGRATIONS.md](INTEGRATIONS.md).

## Contents

1. [Repo scripts](#repo-scripts)
2. [The `jogo` CLI](#the-jogo-cli)
3. [Exit codes](#exit-codes)
4. [Package entry points](#package-entry-points)
5. [Files and folders](#files-and-folders)
6. [Keys, URL parameters and environment](#keys-url-parameters-and-environment)
7. [The `jogo.json` manifest](#the-jogojson-manifest)
8. [The `ASSETS.md` ledger](#the-assetsmd-ledger)
9. [The import list `assets/importar.json`](#the-import-list-assetsimportarjson)
10. [Constants](#constants)

The CLI prints its messages in Portuguese, and this document quotes them exactly as printed.

## Repo scripts

From [`package.json`](../package.json). Run them with Yarn 1.22.

| Script              | What it does                                                                                         | Example             |
| ------------------- | ---------------------------------------------------------------------------------------------------- | ------------------- |
| `yarn verificar`    | the gate: lint, format check, tests and `jogo check --sdk`, in that order; the same as CI            | `yarn verificar`    |
| `yarn test`         | `node --test test/*.test.js`                                                                         | `yarn test`         |
| `yarn lint`         | ESLint over the repo ([`eslint.config.js`](../eslint.config.js))                                     | `yarn lint`         |
| `yarn format:check` | Prettier in check mode, Markdown included ([`.prettierrc`](../.prettierrc))                          | `yarn format:check` |
| `yarn format`       | Prettier writing the files                                                                           | `yarn format`       |
| `yarn jogo:check`   | `node bin/jogo.mjs check --sdk`                                                                      | `yarn jogo:check`   |
| `yarn mutantes`     | breaks each rule on purpose and checks the suite fails ([`test/mutantes.mjs`](../test/mutantes.mjs)) | `yarn mutantes`     |

## The `jogo` CLI

Declared in [`src/cli.js`](../src/cli.js), run by [`bin/jogo.mjs`](../bin/jogo.mjs). `--usage`, `--help` or `-h` at any level print that level's help and exit 0 without running anything.

| Command                | Options                                  | What it does                                                                                                                                               |
| ---------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `jogo check [pasta]`   | `--sdk`, `--json`                        | checks a game repo against the contract; `--sdk` checks only install scripts; `--json` prints `{ ok, pasta, secoes }`                                      |
| `jogo assets importar` | `--apenas=id,id`                         | reads `assets/importar.json` in the current folder and writes models and textures; without `--apenas` it imports the whole list and overwrites the outputs |
| `jogo olho <rótulo>`   | `--url=…`, `--roteiro=…`, `--segundos=…` | screenshots and frame timing on desktop, phone and TV, written to `.olho/<rótulo>/`; without `--url` it starts the game's `yarn dev` on port 5199          |

| Option           | Type  | Default                   | Effect                                                       |
| ---------------- | ----- | ------------------------- | ------------------------------------------------------------ |
| `--sdk`          | flag  | off                       | only the install-scripts section                             |
| `--json`         | flag  | off                       | result as JSON on stdout                                     |
| `--apenas=id,id` | value | the whole list            | only these ids; an id not in the list exits 1 before writing |
| `--url=http://…` | value | starts `yarn dev` on 5199 | the game already served                                      |
| `--roteiro=…`    | value | `olho/roteiro.mjs`        | the script that reaches the match                            |
| `--segundos=…`   | value | `5`                       | how long the frame is measured; must be greater than zero    |

## Exit codes

| Code | When                                                                                                                                                         | Example message                                               |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `0`  | success, or a help request                                                                                                                                   | `ok, o repo cumpre o contrato.`                               |
| `1`  | `jogo check` found problems, `jogo olho` saw page errors, or a command threw                                                                                 | `3 problema(s).`                                              |
| `2`  | the parse refused the line: unknown option, value option without `=value`, repeated option, flag with a value, extra argument, unknown command or subcommand | `jogo assets importar: --apenas precisa de valor: --apenas=…` |

## Package entry points

From `exports` in [`package.json`](../package.json), imported as `@roqueos-games/jogo-sdk/<entry>`.

| Entry                       | File                                                            | Main exports                                                                                                                                                                                                                                                                                                                        |
| --------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.`                         | [`src/index.js`](../src/index.js)                               | `definirJogo`, `verificarHost`, `VERSAO_DO_CONTRATO`, `CAPACIDADES`, `OBRIGATORIAS`, `OPCIONAIS`, `SITUACOES_DA_SALA`, `ERROS_DA_SALA`, `ERROS_DA_SALA_AO_VIVO`, `PAPEIS_DA_IA`, `IDIOMAS`, `IDIOMA_CANONICO`, `IDIOMA_DE_RECUO`, `normalizarIdioma`, `emModoE2E`, `estadoE2E`, `validarManifesto`, `ETIQUETAS`, `LIMITE_DO_RESUMO` |
| `./host-de-desenvolvimento` | [`src/host/desenvolvimento.js`](../src/host/desenvolvimento.js) | `criarHostDeDesenvolvimento({ jogoId, janela, registro })`                                                                                                                                                                                                                                                                          |
| `./host-falso`              | [`src/host/falso.js`](../src/host/falso.js)                     | `criarHostFalso({ jogoId, uid, nome, idioma, modoLeve, ia, iaDisponivel, sala, salaAoVivo, convite, recusar, progresso, retomada, presenca })`                                                                                                                                                                                      |
| `./armazenamento`           | [`src/host/armazenamento.js`](../src/host/armazenamento.js)     | `chaveDoJogo`, `armazenamentoEmMemoria`, `armazenamentoDoJogo`                                                                                                                                                                                                                                                                      |
| `./sala-ao-vivo`            | [`src/host/salaAoVivo.js`](../src/host/salaAoVivo.js)           | `segmentosDoCaminho`, `conferirValor`, `conferirAtualizacao`, `normalizarCodigoDaSala`, `MARCADOR_DA_HORA`, `criarSalaAoVivo`                                                                                                                                                                                                       |
| `./presenca`                | [`src/host/presenca.js`](../src/host/presenca.js)               | `conferirMapa`, `conferirPose`, `conferirAparencia`, `POSES_POR_SEGUNDO`, `criarPresenca`                                                                                                                                                                                                                                           |
| `./modelos`                 | [`src/modelos.js`](../src/modelos.js)                           | `PERFIS`, `perfilDoJogo`, `prepararRenderizador`, `acenderAmbiente`, `caminhoDoPerfil`, `criarCarregador`, `liberar`, `criarCenario`                                                                                                                                                                                                |
| `./grafico`                 | [`src/grafico.js`](../src/grafico.js)                           | `QUALIDADES`, `PRESETS`, `EFEITOS`, `FOV`, `configuracaoPadrao`, `carregarConfiguracao`, `salvarConfiguracao`, `trocarQualidade`, `efeitoLigado`, `criarPosProcesso`                                                                                                                                                                |
| `./painel`                  | [`src/painel.js`](../src/painel.js)                             | `abrirPainel`, `TEXTOS_DO_PAINEL`, `textosDoPainel`, `CSS_DO_PAINEL`                                                                                                                                                                                                                                                                |
| `./pacote`                  | [`src/pacote.js`](../src/pacote.js)                             | `selarPacote`, `abrirPacote`, `carregarPacote`, `ASSINATURA`                                                                                                                                                                                                                                                                        |
| `./som`                     | [`src/som.js`](../src/som.js)                                   | `criarAudio`, `criarPanner`, `soltar`, `ESPACO_PADRAO`                                                                                                                                                                                                                                                                              |
| `./carga`                   | [`src/carga.js`](../src/carga.js)                               | `criarCarga`, `calcularProgresso`                                                                                                                                                                                                                                                                                                   |

## Files and folders

| Path                                                      | What it holds                                                     | Who writes                  | Who reads                                                       |
| --------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------- | --------------------------------------------------------------- |
| `jogo.json` (game)                                        | the manifest                                                      | the game's author           | `jogo check`; RoqueOS, for catalog, windows, invites and Podium |
| `i18n/<idioma>.json` (game)                               | the game's texts, one JSON per language, `pt-BR.json` as the base | the game's author           | `jogo check` (same keys, no empty text)                         |
| `public/` (game)                                          | everything the game serves                                        | the author and the importer | `jogo check` (ledger, weight, Fab)                              |
| `public/**/alto/` (game)                                  | what only the desktop downloads                                   | the author                  | `jogo check` (outside the 30 MB)                                |
| `ASSETS.md` (game)                                        | the asset ledger                                                  | the author and the importer | `jogo check`                                                    |
| `assets/importar.json` (game)                             | the import list                                                   | the author                  | `jogo assets importar`                                          |
| `assets/source-lock.json` (game)                          | URL, bytes and SHA-256 of each original                           | the importer                | the importer (a changed original stops it)                      |
| `.local/asset-source/` (game)                             | originals downloaded by hand, outside git                         | the author                  | the importer (`fonte.arquivo`)                                  |
| `olho/roteiro.mjs` (game)                                 | the path to the match for `jogo olho`                             | the author                  | `jogo olho`                                                     |
| `.olho/<rótulo>/` (game)                                  | screenshots per scenario and `resultado.json`                     | `jogo olho`                 | whoever compares before and after                               |
| [`src/`](../src/)                                         | the SDK                                                           | maintainers                 | games, the CLI                                                  |
| [`test/fixtures/jogo-ok/`](../test/fixtures/jogo-ok/)     | a valid sample game                                               | maintainers                 | the tests                                                       |
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | the `verificar` workflow                                          | maintainers                 | GitHub Actions                                                  |
| [`CHANGELOG.md`](../CHANGELOG.md)                         | what changed per version, with the reasons                        | maintainers                 | games deciding a bump                                           |

## Keys, URL parameters and environment

| Name                                           | Default                                                            | What it changes                                                                                                   |
| ---------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `roqueos:<jogo>:<chave>`                       | n/a                                                                | where `armazenamento` keeps each key, in both hosts ([`src/host/armazenamento.js`](../src/host/armazenamento.js)) |
| `roqueos:<jogo>:grafico`                       | n/a                                                                | the player's graphics choice, as JSON, written by `salvarConfiguracao` ([`src/grafico.js`](../src/grafico.js))    |
| `roqueos:<jogo>:progresso`                     | n/a                                                                | the saved game on the development host                                                                            |
| `roqueos:<jogo>:sala:<CÓDIGO>`                 | n/a                                                                | a two-player room on the development host                                                                         |
| `roqueos:<jogo>:salaAoVivo:<CÓDIGO>/<caminho>` | n/a                                                                | one leaf of a live room on the development host                                                                   |
| `roqueos:<jogo>:presenca`                      | n/a                                                                | the BroadcastChannel name for presence between tabs                                                               |
| `sessionStorage` of the tab                    | n/a                                                                | the development host's player per tab: reload keeps the player, a duplicated tab copies it                        |
| `?sala=<código>`                               | none                                                               | the invite link of both rooms on the development host                                                             |
| `?perfil=baixo` or `?perfil=alto`              | from `desempenho.modoLeve()`                                       | forces the profile in `perfilDoJogo`                                                                              |
| `#retomar=<código>`                            | none                                                               | the resume link of the fake host; the code goes in the fragment                                                   |
| `window.__ROS_E2E__`                           | absent                                                             | test mode for Playwright or Cypress, read by `emModoE2E` and `estadoE2E` ([`src/e2e.js`](../src/e2e.js))          |
| `BLENDER`                                      | `/Applications/Blender.app/Contents/MacOS/Blender`, then `blender` | the Blender binary the importer uses for FBX, OBJ and `.blend`                                                    |
| port `5199`                                    | fixed                                                              | where `jogo olho` starts the game's `yarn dev` when `--url` is absent                                             |

## The `jogo.json` manifest

Checked by `validarManifesto` ([`src/manifesto.js`](../src/manifesto.js)) and by `conferirManifesto` ([`src/verificacao.js`](../src/verificacao.js)).

| Field              | Type             | Rule                                                                                                                |
| ------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| `id`               | text             | lowercase letters and digits, starting with a letter                                                                |
| `slug`             | text             | `a-z0-9` words joined by hyphens; the public address `roqueos.com.br/jogos/<slug>`, permanent (RoqueOS enforces it) |
| `versaoDoContrato` | number           | equal to `VERSAO_DO_CONTRATO`, today `1`                                                                            |
| `nome`             | object           | one non-empty text per language, the ten and only them                                                              |
| `descricao`        | object           | same as `nome`                                                                                                      |
| `seo`              | object           | `pt-BR` and `en-US`, each with `resumo` (at most 160 characters), `sobre` and `comoJogar`                           |
| `etiquetas`        | list             | at least one, all in `ETIQUETAS`                                                                                    |
| `capa`             | text             | path of a `.jpg`, `.jpeg`, `.png` or `.webp` that exists                                                            |
| `icone`            | text             | path of a `.svg` that exists                                                                                        |
| `brilho`           | text, optional   | an `rgba()` or `rgb()` color                                                                                        |
| `janela`           | object           | `largura`, `altura`, `minLargura`, `minAltura`, positive integers in pixels                                         |
| `aceitaConvite`    | boolean          | required; `false` with `sala` or `salaAoVivo` fails                                                                 |
| `entraNoPodio`     | boolean          | required; `true` demands `recorde`                                                                                  |
| `recorde`          | object or `null` | `chave` (the storage key of the best) and `maiorEMelhor` (boolean)                                                  |
| `capacidades`      | list             | only the optional capabilities the game requires                                                                    |

## The `ASSETS.md` ledger

One Markdown table row per file under `public/`, read by `conferirAssets` ([`src/verificacao.js`](../src/verificacao.js)):

```markdown
| Caminho           | Licença | Origem                     | SHA-256 |
| ----------------- | ------- | -------------------------- | ------- |
| `public/capa.jpg` | autoral | gerada para o teste do SDK |         |
```

| Column  | Rule                                                                                                                            |
| ------- | ------------------------------------------------------------------------------------------------------------------------------- |
| path    | the file path from the repo root, with or without backticks                                                                     |
| license | in an open game, one of `LICENCAS_DE_ASSET`; in a closed game (`license: UNLICENSED`), any license except `?` or `desconhecida` |
| source  | not empty                                                                                                                       |
| SHA-256 | optional; when it holds 64 hex characters, the file must match it                                                               |

## The import list `assets/importar.json`

Validated by `validarLista` before any download ([`src/importador.js`](../src/importador.js)).

| Field                                         | Rule                                                                                                                                    |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `itens[].id`                                  | required and unique                                                                                                                     |
| `itens[].tipo`                                | `modelo` (default), `textura` or `hdri`                                                                                                 |
| `itens[].saida`                               | `modelo`: a `.glb` in `public/` (a `.gltf` with `texturasFora`); `hdri`: a `.hdr` in `public/`; `textura`: a folder in `public/`        |
| `itens[].licenca`                             | required; a Fab license is refused, Fab goes into a `.pak`                                                                              |
| `itens[].origem`                              | required: the page it came from                                                                                                         |
| `itens[].fonte`                               | exactly one of `polyhaven` (with `resolucao`) or `arquivo`; `textura` and `hdri` only from Poly Haven                                   |
| `itens[].texturaMax`, `simplificar`, `manter` | optional tuning: texture size cap, simplification ratio, mesh names to keep                                                             |
| `itens[].texturasFora`                        | optional; writes `.gltf`, `.bin` and each WebP texture beside it, because the iPhone WKWebView does not show textures embedded in a GLB |

## Constants

| Name                                 | Value                                                                                                                                    | Where                                               |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `VERSAO_DO_CONTRATO`                 | `1`                                                                                                                                      | [`src/contrato.js`](../src/contrato.js)             |
| `IDIOMAS`                            | `pt-BR`, `en-US`, `es-ES`, `fr-FR`, `de-DE`, `ja-JP`, `zh-CN`, `hi-IN`, `ru-RU`, `ar-AR`                                                 | [`src/idiomas.js`](../src/idiomas.js)               |
| `IDIOMA_CANONICO`, `IDIOMA_DE_RECUO` | `pt-BR`, `en-US`                                                                                                                         | [`src/idiomas.js`](../src/idiomas.js)               |
| `TETO_MB`                            | `{ baixo: 30, alto: 120 }`                                                                                                               | [`src/verificacao.js`](../src/verificacao.js)       |
| `SCRIPTS_DE_INSTALACAO`              | `preinstall`, `install`, `postinstall`, `prepare`, `prepack`, `postpack`                                                                 | [`src/verificacao.js`](../src/verificacao.js)       |
| `LICENCAS_DE_ASSET`                  | `CC0-1.0`, `CC-BY-4.0`, `MIT`, `BSD-3-Clause`, `autoral`, `LicenseRef-Fab-Standard`, `LicenseRef-Sonniss-GDC`, `LicenseRef-Adobe-Mixamo` | [`src/verificacao.js`](../src/verificacao.js)       |
| `LIMITE_DO_RESUMO`                   | `160`                                                                                                                                    | [`src/manifesto.js`](../src/manifesto.js)           |
| `TAMANHO_DO_CODIGO`                  | `5` (no O/0 and no I/1)                                                                                                                  | [`src/host/sala.js`](../src/host/sala.js)           |
| `LIMITE_DO_DOCUMENTO`                | `1048576` bytes (1 MiB)                                                                                                                  | [`src/host/progresso.js`](../src/host/progresso.js) |
| `POSES_POR_SEGUNDO`                  | `10`                                                                                                                                     | [`src/host/presenca.js`](../src/host/presenca.js)   |
| `PERFIS.baixo`, `PERFIS.alto`        | pixelRatio 1.5 and 2, shadow map 1024 and 2048                                                                                           | [`src/modelos.js`](../src/modelos.js)               |
| `QUALIDADES`                         | `baixo`, `medio`, `alto`, `ultra`                                                                                                        | [`src/grafico.js`](../src/grafico.js)               |
