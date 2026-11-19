# Estender

_[English](../EXTENDING.md) | Português_

> **Para quem:** quem vai acrescentar uma peça que o SDK foi feito para receber: uma capacidade, uma régua do `jogo check`, um comando ou opção do CLI, uma etiqueta, um kit.
> **O que tem aqui:** para cada ponto de extensão, os arquivos que mudam, o que muda junto com eles, e a conferência que reprova quando falta um passo.
> **Onde ir para o resto:** que tipo de versão é cada mudança, na [OPERACAO.md](OPERACAO.md#3-atualizar-sem-quebrar); como provar uma régua, em [TESTES.md](TESTES.md).

## Sumário

1. [Antes de tudo](#1-antes-de-tudo)
2. [Uma capacidade nova e opcional](#2-uma-capacidade-nova-e-opcional)
3. [Mudar a forma de uma capacidade](#3-mudar-a-forma-de-uma-capacidade)
4. [Uma régua nova do `jogo check`](#4-uma-régua-nova-do-jogo-check)
5. [Um comando ou opção nova do CLI](#5-um-comando-ou-opção-nova-do-cli)
6. [Uma etiqueta nova da galeria](#6-uma-etiqueta-nova-da-galeria)
7. [Um ponto de entrada novo de kit](#7-um-ponto-de-entrada-novo-de-kit)

## 1. Antes de tudo

Mudar o contrato alcança o `roqueos-front`, que é fechado, e todos os jogos da organização ([`CLAUDE.md`](../../CLAUDE.md)). Abra uma issue antes de mudar o [`src/contrato.js`](../../src/contrato.js): a conversa vem antes do código ([CONTRIBUTING.md](CONTRIBUTING.md)). Toda regra nova vem com um teste que reprova sem ela, e o SDK nunca ganha dependência de runtime nem script de instalação.

## 2. Uma capacidade nova e opcional

1. Acrescente em `CAPACIDADES` no [`src/contrato.js`](../../src/contrato.js) com `obrigatoria: false`, a `forma` e o `porque`. O motivo é parte do contrato: capacidade sem motivo vira atalho para o jogo alcançar o que não devia. Documente cada função num comentário acima dela, como fazem `sala`, `salaAoVivo`, `progresso`, `presenca` e `retomada`.
2. Implemente nos dois hosts de teste, [`src/host/desenvolvimento.js`](../../src/host/desenvolvimento.js) e [`src/host/falso.js`](../../src/host/falso.js). Regra compartilhada vai num arquivo próprio em [`src/host/`](../../src/host/), porque duas cópias de uma regra divergem na primeira correção. Dê ao host falso uma opção para tirá-la (`<nome>: false`) e um caso de `disparar` para o que vem de fora.
3. Exporte as regras que o host do RoqueOS precisa aplicar, por uma entrada nova no `exports` do [`package.json`](../../package.json), como fazem `./sala-ao-vivo` e `./presenca`.
4. Testes num `test/<nome>.test.js` novo, e ao menos um mutante no [`test/mutantes.mjs`](../../test/mutantes.mjs) para cada regra que protege o jogador.
5. Uma versão menor no [`CHANGELOG.md`](../../CHANGELOG.md), dizendo que o contrato continua na versão 1, e a capacidade em [INTEGRACOES.md](INTEGRACOES.md).

O que pega um passo que faltou: o `verificarHost` só olha uma capacidade opcional que está presente ou é exigida, então um host que a esqueceu passa calado. O [`test/contrato.test.js`](../../test/contrato.test.js) fecha esse buraco capacidade por capacidade, chamando `verificarHost(host, { exigidas: ['<nome>'] })` nos dois hosts do SDK, como faz para `sala` e `retomada`; escreva esse teste para a nova.

## 3. Mudar a forma de uma capacidade

É uma `VERSAO_DO_CONTRATO` nova. O host recusa jogo de outra versão em vez de quebrar em runtime ([`src/contrato.js`](../../src/contrato.js)), então o host do RoqueOS e todos os jogos andam juntos. A única exceção até hoje é a `ia` na 0.3.0, mantida na versão 1 porque ninguém a usava, medida e registrada no [`CHANGELOG.md`](../../CHANGELOG.md); não é precedente.

## 4. Uma régua nova do `jogo check`

1. Uma função `conferir<Algo>(raiz)` no [`src/verificacao.js`](../../src/verificacao.js) que devolve uma lista de problemas, cada um dizendo o arquivo e o motivo. O comentário acima dela diz o que já custou caro sem ela.
2. Uma seção no `verificarRepo`, com um nome que diz o que confere.
3. Os testes no [`test/verificacao.test.js`](../../test/verificacao.test.js): um que reprova, um que passa, usando [`test/fixtures/jogo-ok/`](../../test/fixtures/jogo-ok/) como base válida.
4. Um mutante no [`test/mutantes.mjs`](../../test/mutantes.mjs) que tira a régua; o `yarn mutantes` tem de terminar com todos os mutantes mortos.
5. Uma entrada no changelog que diga quais jogos podem passar a reprovar.

Não há nível de aviso: problema que não reprova é problema que ninguém conserta ([`bin/jogo.mjs`](../../bin/jogo.mjs)).

## 5. Um comando ou opção nova do CLI

1. Declare em `COMANDOS` no [`src/cli.js`](../../src/cli.js): `uso`, `resumo`, `posicionais`, e cada opção com `tipo` (`bandeira` ou `valor`), `ajuda` e, quando o valor pode vir errado, `validar`.
2. Acrescente o ramo no [`bin/jogo.mjs`](../../bin/jogo.mjs). Comando declarado sem ramo sai 2 com `jogo: <comando> está declarado mas não tem implementação`.
3. Testes no [`test/cli.test.js`](../../test/cli.test.js), inclusive que `--usage` e opção desconhecida não escrevem nada.

O parse roda inteiro antes de qualquer comando tocar no disco, e opção não declarada sai 2. É a regra da 0.5.1 e não se reabre ([ARQUITETURA.md](ARQUITETURA.md#8-decisões-de-design)).

## 6. Uma etiqueta nova da galeria

`ETIQUETAS` no [`src/manifesto.js`](../../src/manifesto.js) é uma lista fechada porque o rótulo traduzido mora no RoqueOS, na chave `games.tag<Etiqueta>`. Etiqueta nova é mudança nos dois lados: aqui, e a chave nos dez idiomas no front. O [`test/manifesto.test.js`](../../test/manifesto.test.js) cobre a lista.

## 7. Um ponto de entrada novo de kit

Um kit é um arquivo em [`src/`](../../src/) com uma entrada própria no `exports` do [`package.json`](../../package.json) (como `./som` e `./carga`). Ele nunca importa o three nem pacote de runtime nenhum: o jogo entrega os módulos da versão dele, porque duas cópias do three na mesma página quebram o `instanceof` ([`src/modelos.js`](../../src/modelos.js)). Ferramenta pesada é devDependency do jogo, e o erro quando ela falta imprime a linha exata de `yarn add -D` ([`src/importador.js`](../../src/importador.js)). O kit ganha o arquivo de teste dele, os mutantes das regras que importam, e uma seção em [INTEGRACOES.md](INTEGRACOES.md).
