# jogo-sdk

O contrato entre o RoqueOS e um jogo. Leia o README e `src/contrato.js` antes de mudar
qualquer coisa: mudar a forma de uma capacidade é versão nova do contrato e alcança o
`roqueos-front` e todos os jogos da organização roqueos-games.

- Gate: `yarn verificar` (o mesmo do CI e do pre-push).
- Toda regra nova vem com teste que reprova sem ela.
- Sem script de instalação no package.json; sem dependência de runtime.
- Português do Brasil no código e nos commits.
