# Como contribuir

Obrigado por querer ajudar. Este repo é pequeno de propósito, e a régua é a mesma para
todo mundo, inclusive para quem mantém.

1. Abra uma issue antes de mudar o contrato (`src/contrato.js`). Capacidade nova mexe no
   RoqueOS e em todos os jogos, então a conversa vem antes do código.
2. Faça o fork, crie um branch e rode `yarn install --ignore-scripts`.
3. Toda regra nova vem com um teste que reprova sem ela. Teste que passa com e sem a mudança
   não prova nada.
4. Rode `yarn verificar` antes de abrir o PR. É o mesmo que o CI roda.
5. Abra o PR explicando o porquê, não só o quê.

O código, os comentários e as mensagens de commit são em português do Brasil, que é o idioma
canônico do projeto. Issue e PR em inglês são bem-vindos.

Nada de script que rode sozinho no install (`preinstall`, `postinstall`, `prepare`): o
`jogo check` reprova, e o motivo está em [`src/verificacao.js`](src/verificacao.js).

## Conduta

Trate os outros como gostaria de ser tratado: crítica ao código, nunca à pessoa. Assédio,
ofensa e exposição de dado pessoal de alguém tiram a pessoa do projeto. Para reportar, use o
contato de [SECURITY.md](SECURITY.md).

---

## Contributing (English)

1. Open an issue before changing the contract (`src/contrato.js`).
2. Fork, branch, and run `yarn install --ignore-scripts`.
3. Every new rule comes with a test that fails without it.
4. Run `yarn verificar` before opening the pull request; CI runs the same command.
5. Explain the why in the pull request.

Code and comments are in Brazilian Portuguese; English issues and pull requests are welcome.
Install-time scripts are not allowed. Be kind: critique code, never people.
