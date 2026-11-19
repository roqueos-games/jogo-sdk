# Como contribuir

_[English](../../CONTRIBUTING.md) | Português_

Obrigado por querer ajudar. Este repo é pequeno de propósito, e a régua é a mesma para todo mundo, inclusive para quem mantém.

1. Abra uma issue antes de mudar o contrato ([`src/contrato.js`](../../src/contrato.js)). Capacidade nova mexe no RoqueOS e em todos os jogos, então a conversa vem antes do código.
2. Faça o fork, crie um branch e rode `yarn install --ignore-scripts`.
3. Toda regra nova vem com um teste que reprova sem ela. Teste que passa com e sem a mudança não prova nada.
4. Rode `yarn verificar` antes de abrir o PR. É o mesmo que o CI roda.
5. Abra o PR explicando o porquê, não só o quê.

O código, os comentários e as mensagens de commit são em português do Brasil, que é o idioma canônico do projeto. Issue e PR em inglês são bem-vindos.

Nada de script que rode sozinho no install (`preinstall`, `postinstall`, `prepare`): o `jogo check` reprova, e o motivo está em [`src/verificacao.js`](../../src/verificacao.js).

Onde cada tipo de mudança entra, e qual teste a prova, está em [ESTENDER.md](ESTENDER.md) e [TESTES.md](TESTES.md).

O modelo de pull request ([`.github/pull_request_template.md`](../../.github/pull_request_template.md)) pede as mesmas conferências por escrito: um teste para cada conserto, `yarn verificar` verde, texto novo em todos os idiomas que o repo exige, e uma linha no `ASSETS.md` para mídia nova. Problema de segurança nunca vai em issue pública: o [SECURITY.md](../../SECURITY.md) tem o canal privado.

## Conduta

Trate os outros como gostaria de ser tratado: crítica ao código, nunca à pessoa. Assédio, ofensa e exposição de dado pessoal de alguém tiram a pessoa do projeto. Para reportar, use o contato de [SECURITY.md](../../SECURITY.md).
