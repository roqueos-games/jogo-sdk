# Changelog

## 0.2.1 (26/09/2026)

- `jogo check`: jogo fechado (`license: UNLICENSED` no package.json) aceita asset com
  licença de terceiro fora da lista aberta, como um personagem do Mixamo, porque o repo não
  publica o arquivo. Continua exigindo a linha no ASSETS.md, a licença escrita e a origem;
  "?" e "desconhecida" reprovam. Jogo aberto não muda.

## 0.2.0 (25/09/2026)

- Capacidade opcional `sala`, a partida online de dois jogadores que o Xadrez e as Damas
  precisam para sair do RoqueOS: `criar`, `entrar`, `observar`, `jogar`, `encerrar` e
  `conviteRecebido`. O jogo não fala com banco nenhum, o estado do tabuleiro é opaco para o
  host, e sem conta não há sala. O contrato continua na versão 1: nenhuma capacidade que já
  existia mudou de forma.
- `SITUACOES_DA_SALA` (`esperando`, `jogando`, `encerrada`) e `ERROS_DA_SALA` (`nao-encontrada`,
  `propria`, `cheia`, `sem-conta`) exportados, o vocabulário da sala em código.
- Host falso: sala em memória, com as mesmas regras de cadeira do RoqueOS; `convite` abre o host
  como se a janela viesse de um link; `disparar('sala', { acao, codigo, ... })` faz o outro
  jogador criar, entrar, jogar, encerrar, cair ou sumir; `sala: false` tira a capacidade.
- Host de desenvolvimento: sala entre duas abas do mesmo navegador, no `localStorage` e com o
  evento `storage`, sem rede e sem Firebase. O link é a própria página com `?sala=<código>`, cada
  aba é um jogador, e fechar a aba do anfitrião marca `anfitriaoSaiu`.
- `jogo.json`: `sala` entra em `capacidades`; com `aceitaConvite: false` o `jogo check` reprova,
  porque o convite abriria o RoqueOS sem abrir o jogo.

## 0.1.0 (25/09/2026)

- Contrato v1: as capacidades `identidade`, `avisar`, `audio`, `desempenho`, `metricas`,
  `placar`, `armazenamento` e `idioma`, obrigatórias, e `tela`, `teclado` e `ia`, opcionais.
- `definirJogo` e `mount`, que recusam host fora do contrato com a lista do que falta.
- Host de desenvolvimento, host falso e o espaço de chaves `roqueos:<jogo>:<chave>`,
  compatível com o que os jogos já usavam no RoqueOS.
- `jogo.json` e o `jogo check`: manifesto, textos nos dez idiomas, origem dos assets e
  proibição de script de instalação.
