# Testes

_[English](../TESTING.md) | Português_

> **Para quem:** quem muda o SDK e precisa saber o que a suíte prova, como rodar uma parte dela, e o que conta como pronto.
> **O que tem aqui:** o gate, o que cada arquivo de teste prova, os auxiliares de teste, o teste de mutação, e o critério de aceite.
> **Onde ir para o resto:** quando o gate reprova, [QUANDO-QUEBRA.md](QUANDO-QUEBRA.md#o-gate); os scripts, [REFERENCIA.md](REFERENCIA.md#scripts-do-repo).

## Sumário

1. [O gate](#1-o-gate)
2. [O que cada suíte prova](#2-o-que-cada-suíte-prova)
3. [Auxiliares e fixtures](#3-auxiliares-e-fixtures)
4. [O teste de mutação](#4-o-teste-de-mutação)
5. [O critério de aceite](#5-o-critério-de-aceite)

## 1. O gate

```bash
yarn verificar                       # lint, formato, testes, jogo check --sdk
node --test test/sala.test.js        # um arquivo
yarn mutantes                        # o teste de mutação, fora do gate
```

O `yarn verificar` é o mesmo comando na máquina de quem mantém e no workflow `verificar` ([`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)), que instala com `--frozen-lockfile --ignore-scripts` e roda com permissão só de leitura e sem segredo, para um pull request de fork ser julgado por uma esteira que ele não controla. Os testes usam o `node:test`, sem framework. Medido em 18/11/2026: 284 testes em 43 suítes, todos passando, em cerca de 5 s.

## 2. O que cada suíte prova

| Arquivo                                                        | O que prova                                                                                                                                                      |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`test/contrato.test.js`](../../test/contrato.test.js)         | o contrato: toda capacidade tem forma e motivo, o `verificarHost` lista todos os problemas, os dois hosts do SDK cumprem, e a forma antiga da `ia` agora reprova |
| [`test/definir-jogo.test.js`](../../test/definir-jogo.test.js) | `definirJogo` e `mount`: id inválido, host recusado antes do `montar`, desmontar duas vezes                                                                      |
| [`test/hosts.test.js`](../../test/hosts.test.js)               | os hosts de desenvolvimento e falso, inclusive a `retomada` no de desenvolvimento                                                                                |
| [`test/sala.test.js`](../../test/sala.test.js)                 | a sala de dois jogadores no host falso e entre duas abas no host de desenvolvimento                                                                              |
| [`test/sala-ao-vivo.test.js`](../../test/sala-ao-vivo.test.js) | a sala ao vivo: operações, valores como o Realtime Database devolve, erros de quem porta pegos na hora da chamada, ouvintes, conexão e `aoCair`                  |
| [`test/progresso.test.js`](../../test/progresso.test.js)       | o jogo salvo nos dois hosts e as regras de documento que o Firestore aplica                                                                                      |
| [`test/presenca.test.js`](../../test/presenca.test.js)         | a presença: o teto de 10 poses por segundo, o filtro de mapa, a primeira entrega assíncrona                                                                      |
| [`test/manifesto.test.js`](../../test/manifesto.test.js)       | o `validarManifesto`, campo a campo                                                                                                                              |
| [`test/verificacao.test.js`](../../test/verificacao.test.js)   | cada régua do `jogo check`, reprovando e passando                                                                                                                |
| [`test/cli.test.js`](../../test/cli.test.js)                   | o parse, e o CLI rodando num catálogo falso de verdade, conferindo por SHA-256 e mtime que `--usage` e opção desconhecida não escrevem nada                      |
| [`test/importador.test.js`](../../test/importador.test.js)     | a lista de importação, a trava e o registro, os auxiliares do olho, e o importador de ponta a ponta, inclusive `texturasFora`                                    |
| [`test/modelos.test.js`](../../test/modelos.test.js)           | perfil, renderizador e ambiente, o caminho por perfil, o carregador, `liberar`                                                                                   |
| [`test/cenario.test.js`](../../test/cenario.test.js)           | `criarCenario`: repetição, o modelo no chão, o céu por perfil                                                                                                    |
| [`test/grafico.test.js`](../../test/grafico.test.js)           | qualidades, a escolha guardada, a força do desfoque, renderizador, cadeia de pós-processamento, o painel nos dez idiomas                                         |
| [`test/som.test.js`](../../test/som.test.js)                   | o kit de som                                                                                                                                                     |
| [`test/carga.test.js`](../../test/carga.test.js)               | o progresso da carga                                                                                                                                             |
| [`test/pacote.test.js`](../../test/pacote.test.js)             | o `.pak`: ida e volta, nada em claro, chave errada e pacote mexido recusados                                                                                     |

## 3. Auxiliares e fixtures

[`test/fixtures/jogo-ok/`](../../test/fixtures/jogo-ok/) é um jogo válido: `jogo.json`, os dez arquivos de `i18n/`, `public/` com capa e ícone, e o `ASSETS.md` dele. Um teste de régua copia e quebra uma coisa.

[`test/janela-falsa.js`](../../test/janela-falsa.js) é uma janela de navegador mínima para o host de desenvolvimento. Duas abas dividem o `localStorage` e cada uma tem o seu `sessionStorage`; o evento `storage` não é entregue sozinho, de propósito: o teste entrega à mão, então prova que é o evento que carrega a mudança e controla quando ele chega. `storageQuebrado` imita o Safari em modo privado, que lança no `getItem`.

## 4. O teste de mutação

O [`test/mutantes.mjs`](../../test/mutantes.mjs) troca um pedaço do código que cumpre uma régua, roda a suíte daquele arquivo, e devolve o original. O mutante tem de morrer: a suíte reprova. `SOBREVIVEU` quer dizer que a régua não tem teste; `NÃO APLICOU` quer dizer que o mutante não casa mais com o código. Medido em 18/11/2026: `ok, os 34 mutantes morreram.`, em cerca de 24 s. Não faz parte do `yarn verificar`.

## 5. O critério de aceite

Uma mudança está pronta quando o `yarn verificar` está verde, todo conserto e toda régua nova têm um teste que reprova sem eles ([CONTRIBUTING.md](CONTRIBUTING.md)), e régua nova tem um mutante que morre. Teste nunca é enfraquecido para o gate passar. Mudança nos hosts ou nos kits que o jogo enxerga também se prova no `yarn dev` de um jogo, com o jogo aberto ([`.claude/loop.md`](../../.claude/loop.md)).
