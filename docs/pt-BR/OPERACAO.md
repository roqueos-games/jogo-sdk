# Operação

_[English](../OPERATIONS.md) | Português_

> **Para quem:** quem mantém o SDK saudável, corta uma versão e leva os jogos até ela.
> **O que tem aqui:** a rotina, como uma versão é publicada, como atualizar sem quebrar os jogos e o RoqueOS, como desfazer, o que há para guardar, e o que olhar.
> **Onde ir para o resto:** o que pode mudar numa versão menor e o que não pode, na [ARQUITETURA.md](ARQUITETURA.md#8-decisões-de-design); como acrescentar uma capacidade ou uma régua, em [ESTENDER.md](ESTENDER.md).

## Sumário

1. [A rotina](#1-a-rotina)
2. [Publicar uma versão](#2-publicar-uma-versão)
3. [Atualizar sem quebrar](#3-atualizar-sem-quebrar)
4. [Desfazer](#4-desfazer)
5. [Backup e restauração](#5-backup-e-restauração)
6. [Monitorar](#6-monitorar)

## 1. A rotina

Nada roda com horário marcado. O SDK não tem servidor nem job; o que roda sozinho é o workflow `verificar` no GitHub Actions, em todo push na `main` e todo pull request, inclusive de fork ([`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)).

A rotina de manutenção do [`.claude/loop.md`](../../.claude/loop.md) é a rotina, uma coisa por iteração, parando na primeira que tiver trabalho: gate vermelho, CI do GitHub vermelho, issue ou pull request de fora sem resposta, asset sem origem, o SDK atrás (num jogo), e deriva de documentação.

```bash
yarn verificar          # o gate
gh run list --limit 3   # as últimas rodadas do CI
gh issue list           # issues de fora
gh pr list              # pull requests de fora
```

Vermelho no GitHub e verde aqui é ambiente divergente, e se investiga antes de qualquer outra coisa ([`.claude/loop.md`](../../.claude/loop.md)).

## 2. Publicar uma versão

Não há script de release no repo nem publicação no npm: os jogos instalam o SDK do GitHub pela tag. Uma versão, como o histórico mostra, são três coisas que andam juntas:

1. A `version` no [`package.json`](../../package.json) (hoje `0.7.0`).
2. Uma seção no topo do [`CHANGELOG.md`](../../CHANGELOG.md) com a versão, a data, o que mudou e por quê, e se a versão do contrato mudou.
3. Uma tag git `vX.Y.Z` naquele commit, que é o que os jogos pinam.

```bash
yarn verificar
git tag v0.7.1
git push origin v0.7.1
```

A tag nasce depois que a mudança está na `main`, por um pull request revisado ([`.github/CODEOWNERS`](../../.github/CODEOWNERS)).

## 3. Atualizar sem quebrar

O contrato decide que tipo de versão é uma mudança ([`src/contrato.js`](../../src/contrato.js)):

| Mudança                                                            | Versão                                  | Quem tem de agir                                                       |
| ------------------------------------------------------------------ | --------------------------------------- | ---------------------------------------------------------------------- |
| Uma capacidade nova e opcional                                     | menor                                   | ninguém; o jogo que não a declara não a recebe                         |
| Um kit novo, uma régua nova do `jogo check`, uma opção nova do CLI | menor, ou patch para um conserto        | os jogos, quando sobem: régua nova pode reprovar jogo que passava      |
| Uma forma diferente para uma capacidade que existe                 | `VERSAO_DO_CONTRATO` nova               | o host do RoqueOS e todos os jogos; o host recusa jogo de outra versão |
| A mudança da `ia` na 0.3.0                                         | ficou no contrato 1 como exceção medida | não é precedente ([`CHANGELOG.md`](../../CHANGELOG.md))                |

Antes de uma tag que acrescenta régua ao `jogo check`, rode o SDK novo contra os jogos que você tem na máquina, para a nota da versão dizer quais reprovam:

```bash
node bin/jogo.mjs check ../um-jogo
```

Em cada jogo, o bump é a troca do pin no `package.json` dele, com o `yarn verificar` dele verde e o changelog dele dizendo o que mudou ([`.claude/loop.md`](../../.claude/loop.md)).

## 4. Desfazer

| Passo                                           | Como voltar                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Uma mudança mergeada que não devia ter saído    | `git revert` num pull request, e uma versão patch nova                                                                                                                                                                                                                                                               |
| Uma tag que os jogos já pinam                   | o repo não tem procedimento documentado para retirar uma tag. O que se sabe: o RoqueOS instala cada jogo numa versão exata com o SHA travado no lockfile ([`SECURITY.md`](../../SECURITY.md)), então uma tag movida não alcançaria quem já travou; publicar uma versão patch nova é o caminho que alcança todo mundo |
| Um jogo que subiu para uma versão que o quebra  | o jogo volta para a tag anterior no `package.json` dele                                                                                                                                                                                                                                                              |
| O `jogo assets importar` sobrescreveu as saídas | `git checkout -- public/ ASSETS.md assets/source-lock.json` no jogo, desde que estivessem comitados                                                                                                                                                                                                                  |

## 5. Backup e restauração

O SDK não guarda dado nenhum. O repositório no GitHub é o backup, e o histórico do que cada versão prometeu é o [`CHANGELOG.md`](../../CHANGELOG.md).

O que guarda dado é o host de desenvolvimento, no navegador que roda o `yarn dev` de um jogo: o armazenamento, o save e as salas moram no `localStorage`, em `roqueos:<jogo>:...` ([REFERENCIA.md](REFERENCIA.md#chaves-parâmetros-de-url-e-ambiente)). É dado de teste. Para recomeçar, apague essas chaves pelo devtools do navegador. O dado de verdade do jogador mora no host do RoqueOS, fora deste repo.

## 6. Monitorar

| O que olhar          | Onde                                                                                | Saudável                                                                               |
| -------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| O gate               | `yarn verificar`                                                                    | termina em `ok, o repo cumpre o contrato.`; em 18/11/2026: 284 testes, nenhum falhando |
| Os mutantes          | `yarn mutantes`                                                                     | `ok, os 34 mutantes morreram.` (34 em 18/11/2026, em cerca de 24 s)                    |
| O CI do GitHub       | `gh run list --limit 3`                                                             | as últimas rodadas do `verificar` verdes                                               |
| Contribuição de fora | `gh issue list`, `gh pr list`                                                       | nenhuma esperando sem resposta                                                         |
| Relato de segurança  | relatório privado de vulnerabilidade do GitHub ([`SECURITY.md`](../../SECURITY.md)) | respondido em até sete dias                                                            |
