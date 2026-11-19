# Quando quebra

_[English](../WHEN-IT-BREAKS.md) | Português_

> **Para quem:** quem viu o gate, o `jogo check`, um host ou o CLI falhar e quer a causa e o conserto.
> **O que tem aqui:** o primeiro comando de diagnóstico, depois uma tabela por área com o que aparece, a causa e o que fazer; falha que já aconteceu leva a data.
> **Onde ir para o resto:** os formatos que cada régua lê, na [REFERENCIA.md](REFERENCIA.md); por que cada regra existe, na [ARQUITETURA.md](ARQUITETURA.md#8-decisões-de-design).

## Sumário

1. [Primeiro, o diagnóstico](#primeiro-o-diagnóstico)
2. [Instalação](#instalação)
3. [O gate](#o-gate)
4. [Montar um jogo](#montar-um-jogo)
5. [O `jogo check` num jogo](#o-jogo-check-num-jogo)
6. [O CLI e o importador](#o-cli-e-o-importador)
7. [Hosts, salas e saves](#hosts-salas-e-saves)

Os programas imprimem em português; as mensagens abaixo estão como aparecem.

## Primeiro, o diagnóstico

```bash
yarn verificar                                  # no SDK: onde o gate para
node bin/jogo.mjs check ../caminho-do-jogo --json   # um jogo: cada seção, como dado
```

O `jogo check` imprime todos os problemas de todas as seções de uma vez, nunca só o primeiro, e sai 1 se houver algum ([`bin/jogo.mjs`](../../bin/jogo.mjs)).

## Instalação

| O que aparece                                                                            | Causa                                                                                           | O que fazer                                                                                                                |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| ``error Your lockfile needs to be updated, but yarn was run with `--frozen-lockfile`.``  | `package.json` e `yarn.lock` discordam, em geral uma dependência mudou sem o lock               | instale sem a flag só se a mudança de dependência é de propósito, e comite `package.json` e `yarn.lock` juntos             |
| `The engine "node" is incompatible with this module. Expected version ">=22". Got "..."` | Node mais velho que o 22 (`engines` no [`package.json`](../../package.json))                    | `nvm use` (o [`.nvmrc`](../../.nvmrc) diz 24); reproduzido em 18/11/2026 com um `engines` de mentira, a mensagem é do Yarn |
| o `yarn install` de um jogo roda um script do SDK                                        | não roda: o SDK não declara script de instalação, e o `jogo check --sdk` reprova se aparecer um | se acontecer, o `package.json` mudou; o `yarn jogo:check` aponta o script                                                  |

## O gate

| O que aparece                                                                         | Causa                                                                                               | O que fazer                                                                                    |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `[warn] Code style issues found in the above file. Run Prettier with --write to fix.` | um arquivo, Markdown incluído, não está no formato do Prettier ([`.prettierrc`](../../.prettierrc)) | `yarn format`, revise o diff, comite                                                           |
| `# fail 1` no resumo do `yarn test`                                                   | um teste reprovou: o código está errado, não o teste                                                | leia o `not ok` acima do resumo; nunca enfraqueça o teste ([CONTRIBUTING.md](CONTRIBUTING.md)) |
| `REPROVOU  scripts de instalação` no `yarn jogo:check`                                | o `package.json` declara `preinstall`, `install`, `postinstall`, `prepare`, `prepack` ou `postpack` | tire o script; o motivo está em [`src/verificacao.js`](../../src/verificacao.js)               |
| `SOBREVIVEU` no `yarn mutantes`                                                       | uma régua foi quebrada de propósito e a suíte passou: a régua não tem teste                         | escreva o teste que reprova sem a régua ([TESTES.md](TESTES.md))                               |
| `NÃO APLICOU` no `yarn mutantes`                                                      | o código que o mutante troca mudou, e o mutante não casa mais                                       | atualize o mutante em [`test/mutantes.mjs`](../../test/mutantes.mjs) para o código novo        |

## Montar um jogo

| O que aparece                                                                 | Causa                                                                               | O que fazer                                                                                                        |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `[oi] host não cumpre o contrato: falta a capacidade "identidade"; ...`       | falta ao host uma capacidade obrigatória, ou uma que o jogo listou em `capacidades` | implemente o que a lista diz; todos os problemas vêm numa mensagem só ([`src/contrato.js`](../../src/contrato.js)) |
| `host fala o contrato 2, o jogo fala o 1`                                     | host e jogo em versões diferentes do contrato                                       | pine o jogo numa tag do SDK na versão do host                                                                      |
| `id de jogo inválido: "Meu-Jogo" (minúsculas e dígitos, começando por letra)` | o `definirJogo` recebeu um id fora de `^[a-z][a-z0-9]*$`                            | use minúsculas e dígitos ([`src/index.js`](../../src/index.js))                                                    |
| `montar precisa devolver { ativar, desmontar }`                               | o `montar` não devolveu nada, ou devolveu sem `desmontar`                           | devolva o objeto; `ativar` é opcional, `desmontar` não                                                             |

## O `jogo check` num jogo

| O que aparece                                                                                                            | Causa                                                    | O que fazer                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `jogo.json ausente`                                                                                                      | o jogo não tem manifesto                                 | crie a partir de [`test/fixtures/jogo-ok/jogo.json`](../../test/fixtures/jogo-ok/jogo.json)      |
| `i18n/ ausente: o texto do jogo mora no jogo, um JSON por idioma`                                                        | não há a pasta `i18n/`                                   | um JSON por idioma, `pt-BR.json` como base                                                       |
| `public/... sem linha no ASSETS.md (caminho \| licença \| origem)`                                                       | um arquivo em `public/` sem origem                       | acrescente a linha com licença e origem                                                          |
| `public/... mudou desde o import: SHA-256 ...`                                                                           | um arquivo trocado à mão depois que o importador o fixou | rode `jogo assets importar --apenas=<id>` de novo, ou acerte a linha se a troca foi de propósito |
| `perfil baixo soma ... MB fora de alto/, teto 30 MB; os maiores: ...`                                                    | o que o celular baixa passa de 30 MB                     | leve o que é só do desktop para uma pasta `alto/`, ou diminua                                    |
| `... é do Fab e está cru em public/: a licença manda impedir a extração, só entra num .pak cifrado`                      | asset do Fab ou do Sonniss fora de um `.pak`             | sele com `selarPacote` ([`src/pacote.js`](../../src/pacote.js))                                  |
| `src/a.js:1 importa "firebase/app": o jogo não fala com banco, quem fala é o host (salaAoVivo, progresso, placar, sala)` | o jogo importa o Firebase                                | use a capacidade; import comentado não conta                                                     |
| `capacidades tem sala e aceitaConvite é false: o link do convite abriria o RoqueOS sem abrir o jogo`                     | jogo com sala que recusa convite                         | ponha `"aceitaConvite": true`                                                                    |

## O CLI e o importador

| O que aparece                                                                                                    | Causa                                                                         | O que fazer                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `jogo assets importar: --apenas precisa de valor: --apenas=…` (sai 2)                                            | `--apenas palmeira` com espaço                                                | `--apenas=palmeira`                                                                                                              |
| `opção desconhecida --x` (sai 2)                                                                                 | uma opção que o comando não declara                                           | `jogo <comando> --usage` lista as que existem                                                                                    |
| o catálogo inteiro reimportado por cima dos arquivos, quando a intenção era ver a ajuda (18/10/2026, duas vezes) | antes da 0.5.1 o CLI ignorava a flag que não lia, e o `--usage` era uma delas | consertado na 0.5.1: a ajuda ganha de tudo e opção desconhecida sai 2 antes de tocar no disco ([`src/cli.js`](../../src/cli.js)) |
| `--apenas: o id "x" não está em assets/importar.json`                                                            | erro de digitação no id                                                       | acerte o id; nada foi escrito                                                                                                    |
| `ENOENT: no such file or directory, open '.../assets/importar.json'`                                             | o comando rodou fora da raiz do jogo                                          | `cd` para o repo do jogo                                                                                                         |
| `falta @gltf-transform/core no jogo: yarn add -D ...`                                                            | faltam ao jogo as ferramentas do importador                                   | rode a linha de `yarn add -D` que a mensagem imprime                                                                             |
| `modelo FBX/OBJ/.blend precisa do Blender: instale ou aponte BLENDER=`                                           | nenhum Blender encontrado                                                     | instale o Blender ou aponte `BLENDER` para o binário                                                                             |
| `a fonte fixada mudou: ... (era ..., veio ...)`                                                                  | o original na origem não é o fixado em `assets/source-lock.json`              | confira o original novo; se estiver certo, tire a entrada dele da trava e importe de novo                                        |
| `jogo olho precisa de um rótulo simples: antes, depois, g81…`                                                    | `jogo olho` sem rótulo                                                        | `jogo olho antes`                                                                                                                |
| `roteiro ausente: olho/roteiro.mjs (o caminho até a partida é do jogo)`                                          | o jogo não tem roteiro para o olho                                            | escreva o `olho/roteiro.mjs` ([`src/olho.js`](../../src/olho.js))                                                                |
| `falta o Playwright no jogo: yarn add -D playwright@1.60.0 && yarn playwright install chromium`                  | falta o Playwright ao jogo                                                    | rode a linha                                                                                                                     |
| `vite` preso na porta 5199 depois do `jogo olho` (16/10/2026, primeira prova)                                    | matar só o `yarn` deixava vivo o `vite`, filho dele                           | consertado: o servidor roda num grupo de processo próprio, e o grupo inteiro é morto                                             |

## Hosts, salas e saves

| O que aparece                                                                                                                                                     | Causa                                                                                  | O que fazer                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TypeError: caminho "a.b" tem ".", que o banco não aceita em chave ...`                                                                                           | caminho da sala ao vivo com `.`, `#`, `$`, `[`, `]` ou caractere de controle           | o erro vem na hora da chamada de propósito; troque o caminho                                                                                              |
| `progresso.salvar` devolve `false` e o `avisosDoHost` do host falso diz `... é array dentro de array, que o Firestore recusa ("Nested arrays are not supported")` | o save tem algo que o Firestore recusa; é o que pega o `outrasDimensoes` do RoqueCraft | mude a forma do save (objeto de arrays em vez de array de arrays)                                                                                         |
| `progresso.carregar()` rejeita com `codigo === 'indisponivel'`                                                                                                    | não deu para ler o save                                                                | não grave por cima; avise com `avisar(..., { fixo: true })` e deixe o jogador tentar de novo                                                              |
| a aba do convite no WebKit nunca vê as escritas da outra aba (26/09/2026, WebKit 26.4)                                                                            | o WebKit só entrega o evento `storage` à aba que já leu o `localStorage`               | consertado no host de desenvolvimento, que lê o `localStorage` uma vez quando começa ([`src/host/desenvolvimento.js`](../../src/host/desenvolvimento.js)) |
| as duas abas agem como o mesmo jogador                                                                                                                            | a segunda aba foi duplicada, o que copia o `sessionStorage`                            | abra o link numa aba nova em vez de duplicar                                                                                                              |
