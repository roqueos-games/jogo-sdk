# Referência

_[English](../REFERENCE.md) | Português_

> **Para quem:** quem precisa consultar um comando, ponto de entrada, arquivo, chave ou campo sem ler o resto.
> **O que tem aqui:** tabelas dos scripts do repo, do CLI `jogo` e dos códigos de saída, dos pontos de entrada do pacote, dos arquivos que um repo de jogo carrega, das chaves e parâmetros de URL que os hosts usam, e os formatos do `jogo.json`, do `ASSETS.md` e do `assets/importar.json`, campo a campo.
> **Onde ir para o resto:** como as peças se ligam, na [ARQUITETURA.md](ARQUITETURA.md); como usar cada capacidade, em [INTEGRACOES.md](INTEGRACOES.md).

## Sumário

1. [Scripts do repo](#scripts-do-repo)
2. [O CLI `jogo`](#o-cli-jogo)
3. [Códigos de saída](#códigos-de-saída)
4. [Pontos de entrada do pacote](#pontos-de-entrada-do-pacote)
5. [Arquivos e pastas](#arquivos-e-pastas)
6. [Chaves, parâmetros de URL e ambiente](#chaves-parâmetros-de-url-e-ambiente)
7. [O manifesto `jogo.json`](#o-manifesto-jogojson)
8. [O registro `ASSETS.md`](#o-registro-assetsmd)
9. [A lista de importação `assets/importar.json`](#a-lista-de-importação-assetsimportarjson)
10. [Constantes](#constantes)

O CLI imprime as mensagens em português, e este documento as cita exatamente como saem.

## Scripts do repo

Do [`package.json`](../../package.json). Rode com o Yarn 1.22.

| Script              | O que faz                                                                                                     | Exemplo             |
| ------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------- |
| `yarn verificar`    | o gate: lint, formato, testes e `jogo check --sdk`, nessa ordem; o mesmo do CI                                | `yarn verificar`    |
| `yarn test`         | `node --test test/*.test.js`                                                                                  | `yarn test`         |
| `yarn lint`         | ESLint no repo ([`eslint.config.js`](../../eslint.config.js))                                                 | `yarn lint`         |
| `yarn format:check` | Prettier conferindo, Markdown incluído ([`.prettierrc`](../../.prettierrc))                                   | `yarn format:check` |
| `yarn format`       | Prettier escrevendo os arquivos                                                                               | `yarn format`       |
| `yarn jogo:check`   | `node bin/jogo.mjs check --sdk`                                                                               | `yarn jogo:check`   |
| `yarn mutantes`     | quebra cada régua de propósito e confere que a suíte reprova ([`test/mutantes.mjs`](../../test/mutantes.mjs)) | `yarn mutantes`     |

## O CLI `jogo`

Declarado em [`src/cli.js`](../../src/cli.js), executado por [`bin/jogo.mjs`](../../bin/jogo.mjs). `--usage`, `--help` ou `-h` em qualquer nível mostram a ajuda daquele nível e saem 0 sem rodar nada.

| Comando                | Opções                                   | O que faz                                                                                                                             |
| ---------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `jogo check [pasta]`   | `--sdk`, `--json`                        | confere um repo de jogo contra o contrato; `--sdk` confere só os scripts de instalação; `--json` imprime `{ ok, pasta, secoes }`      |
| `jogo assets importar` | `--apenas=id,id`                         | lê `assets/importar.json` da pasta atual e escreve modelos e texturas; sem `--apenas` importa a lista inteira e sobrescreve as saídas |
| `jogo olho <rótulo>`   | `--url=…`, `--roteiro=…`, `--segundos=…` | fotos e quadro em desktop, celular e TV, gravados em `.olho/<rótulo>/`; sem `--url` sobe o `yarn dev` do jogo na porta 5199           |

| Opção            | Tipo     | Padrão                    | Efeito                                                 |
| ---------------- | -------- | ------------------------- | ------------------------------------------------------ |
| `--sdk`          | bandeira | desligada                 | só a seção dos scripts de instalação                   |
| `--json`         | bandeira | desligada                 | resultado em JSON no stdout                            |
| `--apenas=id,id` | valor    | a lista inteira           | só esses ids; id fora da lista sai 1 antes de escrever |
| `--url=http://…` | valor    | sobe o `yarn dev` na 5199 | o jogo já servido                                      |
| `--roteiro=…`    | valor    | `olho/roteiro.mjs`        | o roteiro que chega até a partida                      |
| `--segundos=…`   | valor    | `5`                       | quanto tempo mede o quadro; tem de ser maior que zero  |

## Códigos de saída

| Código | Quando                                                                                                                                                             | Mensagem de exemplo                                           |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `0`    | sucesso, ou pedido de ajuda                                                                                                                                        | `ok, o repo cumpre o contrato.`                               |
| `1`    | o `jogo check` achou problema, o `jogo olho` viu erro na página, ou um comando lançou                                                                              | `3 problema(s).`                                              |
| `2`    | o parse recusou a linha: opção desconhecida, opção de valor sem `=valor`, opção repetida, bandeira com valor, argumento a mais, comando ou subcomando desconhecido | `jogo assets importar: --apenas precisa de valor: --apenas=…` |

## Pontos de entrada do pacote

Do `exports` do [`package.json`](../../package.json), importados como `@roqueos-games/jogo-sdk/<entrada>`.

| Entrada                     | Arquivo                                                            | Exportações principais                                                                                                                                                                                                                                                                                                              |
| --------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.`                         | [`src/index.js`](../../src/index.js)                               | `definirJogo`, `verificarHost`, `VERSAO_DO_CONTRATO`, `CAPACIDADES`, `OBRIGATORIAS`, `OPCIONAIS`, `SITUACOES_DA_SALA`, `ERROS_DA_SALA`, `ERROS_DA_SALA_AO_VIVO`, `PAPEIS_DA_IA`, `IDIOMAS`, `IDIOMA_CANONICO`, `IDIOMA_DE_RECUO`, `normalizarIdioma`, `emModoE2E`, `estadoE2E`, `validarManifesto`, `ETIQUETAS`, `LIMITE_DO_RESUMO` |
| `./host-de-desenvolvimento` | [`src/host/desenvolvimento.js`](../../src/host/desenvolvimento.js) | `criarHostDeDesenvolvimento({ jogoId, janela, registro })`                                                                                                                                                                                                                                                                          |
| `./host-falso`              | [`src/host/falso.js`](../../src/host/falso.js)                     | `criarHostFalso({ jogoId, uid, nome, idioma, modoLeve, ia, iaDisponivel, sala, salaAoVivo, convite, recusar, progresso, retomada, presenca })`                                                                                                                                                                                      |
| `./armazenamento`           | [`src/host/armazenamento.js`](../../src/host/armazenamento.js)     | `chaveDoJogo`, `armazenamentoEmMemoria`, `armazenamentoDoJogo`                                                                                                                                                                                                                                                                      |
| `./sala-ao-vivo`            | [`src/host/salaAoVivo.js`](../../src/host/salaAoVivo.js)           | `segmentosDoCaminho`, `conferirValor`, `conferirAtualizacao`, `normalizarCodigoDaSala`, `MARCADOR_DA_HORA`, `criarSalaAoVivo`                                                                                                                                                                                                       |
| `./presenca`                | [`src/host/presenca.js`](../../src/host/presenca.js)               | `conferirMapa`, `conferirPose`, `conferirAparencia`, `POSES_POR_SEGUNDO`, `criarPresenca`                                                                                                                                                                                                                                           |
| `./modelos`                 | [`src/modelos.js`](../../src/modelos.js)                           | `PERFIS`, `perfilDoJogo`, `prepararRenderizador`, `acenderAmbiente`, `caminhoDoPerfil`, `criarCarregador`, `liberar`, `criarCenario`                                                                                                                                                                                                |
| `./grafico`                 | [`src/grafico.js`](../../src/grafico.js)                           | `QUALIDADES`, `PRESETS`, `EFEITOS`, `FOV`, `configuracaoPadrao`, `carregarConfiguracao`, `salvarConfiguracao`, `trocarQualidade`, `efeitoLigado`, `criarPosProcesso`                                                                                                                                                                |
| `./painel`                  | [`src/painel.js`](../../src/painel.js)                             | `abrirPainel`, `TEXTOS_DO_PAINEL`, `textosDoPainel`, `CSS_DO_PAINEL`                                                                                                                                                                                                                                                                |
| `./pacote`                  | [`src/pacote.js`](../../src/pacote.js)                             | `selarPacote`, `abrirPacote`, `carregarPacote`, `ASSINATURA`                                                                                                                                                                                                                                                                        |
| `./som`                     | [`src/som.js`](../../src/som.js)                                   | `criarAudio`, `criarPanner`, `soltar`, `ESPACO_PADRAO`                                                                                                                                                                                                                                                                              |
| `./carga`                   | [`src/carga.js`](../../src/carga.js)                               | `criarCarga`, `calcularProgresso`                                                                                                                                                                                                                                                                                                   |

## Arquivos e pastas

| Caminho                                                      | O que guarda                                                  | Quem escreve                   | Quem lê                                                           |
| ------------------------------------------------------------ | ------------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------- |
| `jogo.json` (jogo)                                           | o manifesto                                                   | quem faz o jogo                | `jogo check`; o RoqueOS, para catálogo, janelas, convites e Pódio |
| `i18n/<idioma>.json` (jogo)                                  | os textos do jogo, um JSON por idioma, `pt-BR.json` como base | quem faz o jogo                | `jogo check` (mesmas chaves, nenhum texto vazio)                  |
| `public/` (jogo)                                             | tudo o que o jogo serve                                       | quem faz o jogo e o importador | `jogo check` (registro, peso, Fab)                                |
| `public/**/alto/` (jogo)                                     | o que só o desktop baixa                                      | quem faz o jogo                | `jogo check` (fora dos 30 MB)                                     |
| `ASSETS.md` (jogo)                                           | o registro dos assets                                         | quem faz o jogo e o importador | `jogo check`                                                      |
| `assets/importar.json` (jogo)                                | a lista de importação                                         | quem faz o jogo                | `jogo assets importar`                                            |
| `assets/source-lock.json` (jogo)                             | URL, bytes e SHA-256 de cada original                         | o importador                   | o importador (original que mudou faz parar)                       |
| `.local/asset-source/` (jogo)                                | originais baixados à mão, fora do git                         | quem faz o jogo                | o importador (`fonte.arquivo`)                                    |
| `olho/roteiro.mjs` (jogo)                                    | o caminho até a partida para o `jogo olho`                    | quem faz o jogo                | `jogo olho`                                                       |
| `.olho/<rótulo>/` (jogo)                                     | fotos por cenário e o `resultado.json`                        | `jogo olho`                    | quem compara o antes e o depois                                   |
| [`src/`](../../src/)                                         | o SDK                                                         | quem mantém                    | os jogos, o CLI                                                   |
| [`test/fixtures/jogo-ok/`](../../test/fixtures/jogo-ok/)     | um jogo de exemplo válido                                     | quem mantém                    | os testes                                                         |
| [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) | o workflow `verificar`                                        | quem mantém                    | o GitHub Actions                                                  |
| [`CHANGELOG.md`](../../CHANGELOG.md)                         | o que mudou em cada versão, com os motivos                    | quem mantém                    | os jogos decidindo um bump                                        |

## Chaves, parâmetros de URL e ambiente

| Nome                                           | Padrão                                                               | O que muda                                                                                                                |
| ---------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `roqueos:<jogo>:<chave>`                       | n/a                                                                  | onde o `armazenamento` guarda cada chave, nos dois hosts ([`src/host/armazenamento.js`](../../src/host/armazenamento.js)) |
| `roqueos:<jogo>:grafico`                       | n/a                                                                  | a escolha de gráfico do jogador, em JSON, gravada por `salvarConfiguracao` ([`src/grafico.js`](../../src/grafico.js))     |
| `roqueos:<jogo>:progresso`                     | n/a                                                                  | o jogo salvo no host de desenvolvimento                                                                                   |
| `roqueos:<jogo>:sala:<CÓDIGO>`                 | n/a                                                                  | uma sala de dois jogadores no host de desenvolvimento                                                                     |
| `roqueos:<jogo>:salaAoVivo:<CÓDIGO>/<caminho>` | n/a                                                                  | uma folha de uma sala ao vivo no host de desenvolvimento                                                                  |
| `roqueos:<jogo>:presenca`                      | n/a                                                                  | o nome do BroadcastChannel da presença entre abas                                                                         |
| `sessionStorage` da aba                        | n/a                                                                  | o jogador por aba do host de desenvolvimento: recarregar mantém o jogador, duplicar a aba copia                           |
| `?sala=<código>`                               | nenhum                                                               | o link de convite das duas salas no host de desenvolvimento                                                               |
| `?perfil=baixo` ou `?perfil=alto`              | do `desempenho.modoLeve()`                                           | força o perfil no `perfilDoJogo`                                                                                          |
| `#retomar=<código>`                            | nenhum                                                               | o link de retomada do host falso; o código vai no fragmento                                                               |
| `window.__ROS_E2E__`                           | ausente                                                              | modo de teste para Playwright ou Cypress, lido por `emModoE2E` e `estadoE2E` ([`src/e2e.js`](../../src/e2e.js))           |
| `BLENDER`                                      | `/Applications/Blender.app/Contents/MacOS/Blender`, depois `blender` | o binário do Blender que o importador usa para FBX, OBJ e `.blend`                                                        |
| porta `5199`                                   | fixa                                                                 | onde o `jogo olho` sobe o `yarn dev` do jogo quando não há `--url`                                                        |

## O manifesto `jogo.json`

Conferido por `validarManifesto` ([`src/manifesto.js`](../../src/manifesto.js)) e por `conferirManifesto` ([`src/verificacao.js`](../../src/verificacao.js)).

| Campo              | Tipo             | Regra                                                                                                                      |
| ------------------ | ---------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `id`               | texto            | minúsculas e dígitos, começando por letra                                                                                  |
| `slug`             | texto            | palavras `a-z0-9` ligadas por hífen; o endereço público `roqueos.com.br/jogos/<slug>`, permanente (quem trava é o RoqueOS) |
| `versaoDoContrato` | número           | igual a `VERSAO_DO_CONTRATO`, hoje `1`                                                                                     |
| `nome`             | objeto           | um texto não vazio por idioma, os dez e só eles                                                                            |
| `descricao`        | objeto           | igual ao `nome`                                                                                                            |
| `seo`              | objeto           | `pt-BR` e `en-US`, cada um com `resumo` (até 160 caracteres), `sobre` e `comoJogar`                                        |
| `etiquetas`        | lista            | ao menos uma, todas em `ETIQUETAS`                                                                                         |
| `capa`             | texto            | caminho de um `.jpg`, `.jpeg`, `.png` ou `.webp` que existe                                                                |
| `icone`            | texto            | caminho de um `.svg` que existe                                                                                            |
| `brilho`           | texto, opcional  | uma cor `rgba()` ou `rgb()`                                                                                                |
| `janela`           | objeto           | `largura`, `altura`, `minLargura`, `minAltura`, inteiros positivos em pixels                                               |
| `aceitaConvite`    | booleano         | obrigatório; `false` com `sala` ou `salaAoVivo` reprova                                                                    |
| `entraNoPodio`     | booleano         | obrigatório; `true` exige `recorde`                                                                                        |
| `recorde`          | objeto ou `null` | `chave` (a chave do armazenamento onde o best mora) e `maiorEMelhor` (booleano)                                            |
| `capacidades`      | lista            | só as capacidades opcionais que o jogo exige                                                                               |

## O registro `ASSETS.md`

Uma linha de tabela em Markdown por arquivo de `public/`, lida por `conferirAssets` ([`src/verificacao.js`](../../src/verificacao.js)):

```markdown
| Caminho           | Licença | Origem                     | SHA-256 |
| ----------------- | ------- | -------------------------- | ------- |
| `public/capa.jpg` | autoral | gerada para o teste do SDK |         |
```

| Coluna  | Regra                                                                                                                             |
| ------- | --------------------------------------------------------------------------------------------------------------------------------- |
| caminho | o caminho do arquivo a partir da raiz do repo, com ou sem crase                                                                   |
| licença | em jogo aberto, uma de `LICENCAS_DE_ASSET`; em jogo fechado (`license: UNLICENSED`), qualquer licença menos `?` ou `desconhecida` |
| origem  | não vazia                                                                                                                         |
| SHA-256 | opcional; quando traz 64 caracteres hexadecimais, o arquivo tem de bater                                                          |

## A lista de importação `assets/importar.json`

Validada por `validarLista` antes de qualquer download ([`src/importador.js`](../../src/importador.js)).

| Campo                                         | Regra                                                                                                                               |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `itens[].id`                                  | obrigatório e único                                                                                                                 |
| `itens[].tipo`                                | `modelo` (padrão), `textura` ou `hdri`                                                                                              |
| `itens[].saida`                               | `modelo`: um `.glb` em `public/` (um `.gltf` com `texturasFora`); `hdri`: um `.hdr` em `public/`; `textura`: uma pasta em `public/` |
| `itens[].licenca`                             | obrigatória; licença do Fab é recusada, o Fab vai num `.pak`                                                                        |
| `itens[].origem`                              | obrigatória: a página de onde veio                                                                                                  |
| `itens[].fonte`                               | exatamente um de `polyhaven` (com `resolucao`) ou `arquivo`; `textura` e `hdri` só da Poly Haven                                    |
| `itens[].texturaMax`, `simplificar`, `manter` | ajustes opcionais: teto do tamanho da textura, razão de simplificação, nomes de malha a manter                                      |
| `itens[].texturasFora`                        | opcional; escreve `.gltf`, `.bin` e cada textura WebP ao lado, porque o WKWebView do iPhone não mostra textura embutida no GLB      |

## Constantes

| Nome                                 | Valor                                                                                                                                    | Onde                                                   |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `VERSAO_DO_CONTRATO`                 | `1`                                                                                                                                      | [`src/contrato.js`](../../src/contrato.js)             |
| `IDIOMAS`                            | `pt-BR`, `en-US`, `es-ES`, `fr-FR`, `de-DE`, `ja-JP`, `zh-CN`, `hi-IN`, `ru-RU`, `ar-AR`                                                 | [`src/idiomas.js`](../../src/idiomas.js)               |
| `IDIOMA_CANONICO`, `IDIOMA_DE_RECUO` | `pt-BR`, `en-US`                                                                                                                         | [`src/idiomas.js`](../../src/idiomas.js)               |
| `TETO_MB`                            | `{ baixo: 30, alto: 120 }`                                                                                                               | [`src/verificacao.js`](../../src/verificacao.js)       |
| `SCRIPTS_DE_INSTALACAO`              | `preinstall`, `install`, `postinstall`, `prepare`, `prepack`, `postpack`                                                                 | [`src/verificacao.js`](../../src/verificacao.js)       |
| `LICENCAS_DE_ASSET`                  | `CC0-1.0`, `CC-BY-4.0`, `MIT`, `BSD-3-Clause`, `autoral`, `LicenseRef-Fab-Standard`, `LicenseRef-Sonniss-GDC`, `LicenseRef-Adobe-Mixamo` | [`src/verificacao.js`](../../src/verificacao.js)       |
| `LIMITE_DO_RESUMO`                   | `160`                                                                                                                                    | [`src/manifesto.js`](../../src/manifesto.js)           |
| `TAMANHO_DO_CODIGO`                  | `5` (sem O/0 e sem I/1)                                                                                                                  | [`src/host/sala.js`](../../src/host/sala.js)           |
| `LIMITE_DO_DOCUMENTO`                | `1048576` bytes (1 MiB)                                                                                                                  | [`src/host/progresso.js`](../../src/host/progresso.js) |
| `POSES_POR_SEGUNDO`                  | `10`                                                                                                                                     | [`src/host/presenca.js`](../../src/host/presenca.js)   |
| `PERFIS.baixo`, `PERFIS.alto`        | pixelRatio 1,5 e 2, mapa de sombra 1024 e 2048                                                                                           | [`src/modelos.js`](../../src/modelos.js)               |
| `QUALIDADES`                         | `baixo`, `medio`, `alto`, `ultra`                                                                                                        | [`src/grafico.js`](../../src/grafico.js)               |
