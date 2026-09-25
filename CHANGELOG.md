# Changelog

## 0.1.0 (25/09/2026)

- Contrato v1: as capacidades `identidade`, `avisar`, `audio`, `desempenho`, `metricas`,
  `placar`, `armazenamento` e `idioma`, obrigatórias, e `tela`, `teclado` e `ia`, opcionais.
- `definirJogo` e `mount`, que recusam host fora do contrato com a lista do que falta.
- Host de desenvolvimento, host falso e o espaço de chaves `roqueos:<jogo>:<chave>`,
  compatível com o que os jogos já usavam no RoqueOS.
- `jogo.json` e o `jogo check`: manifesto, textos nos dez idiomas, origem dos assets e
  proibição de script de instalação.
