# Changelog

## 0.3.0 (26/09/2026)

O que a RagnaRoque e o RoqueCraft precisam para sair do RoqueOS. O contrato continua na
versão 1: as duas capacidades novas são opcionais, `avisar` não muda de forma, e a única
mudança de forma (`ia`) é uma exceção registrada abaixo.

- Capacidade opcional `salaAoVivo`: a sala em tempo real de vários jogadores. `criar`,
  `entrar`, `sair`, `conviteRecebido`, `conectado` e `horaDoServidor`, e as operações sobre os
  nós da sala: `ler`, `gravar`, `atualizar`, `apagar`, `empurrar`, `observar`, `observarFilhos`
  (com `ultimos`) e `aoCair`. O host dá o código, o link e quem é o jogador, e guarda a sala no
  nó que é daquele jogo; o que cada nó significa é do jogo. Caminho com `.`, `#`, `$`, `[`, `]`,
  controle, `..` ou segmento vazio, e `undefined`, função, `NaN` ou `Date` no valor são
  `TypeError` na hora da chamada. Escrita recusada resolve `false` (ou `null` no `empurrar`) e
  nunca lança. Fora da sala que a janela criou ou em que entrou, escrita é `false`, `ler`
  rejeita com `fora-da-sala` e `observar` não entrega nada. A primeira entrega de `observar`,
  `observarFilhos` e `conectado` nunca sai dentro da chamada. O valor volta como o Realtime
  Database devolve (objeto vazio some; array volta array pela conta do `val()` do banco).
  `ERROS_DA_SALA_AO_VIVO` exportado.
- Capacidade opcional `progresso`: o jogo salvo na conta. `disponivel()`, `carregar()` (`null`
  é "não há save"; quando não consegue ler, rejeita com `.codigo = 'indisponivel'`) e
  `salvar(dados, { mesclar })` (substitui, ou funde mapa com mapa como o `merge` do Firestore;
  nunca lança).
- **Exceção: `ia` mudou de forma sem versão nova do contrato.** Agora é `{ completar,
disponivel }`, e o pedido tem formato: `completar({ sistema, mensagens: [{ papel: 'jogador'
| 'modelo', texto }] })` devolve texto ou `null`. O RoqueCraft só oferece a caixa de conversa
  do aldeão quando há modelo, e só `completar` não diz isso antes da pergunta. Pela regra do
  contrato isto seria versão 2; ficou na 1 porque não havia ninguém para quebrar, medido em
  26/09/2026: nenhum repo de jogo usa `host.ia` nem declara `ia` no `jogo.json`, o host do
  RoqueOS (master e `jogos/onda-3b`) não tem `ia`, e os hosts do SDK também não (o de
  desenvolvimento nunca teve; o falso só tem quando o teste pede). Um teste prova que os dois
  hosts do SDK continuam no contrato e que a forma antiga agora reprova. Não é precedente: com
  um implementador que seja, mudar a forma é versão nova. `PAPEIS_DA_IA` exportado.
- `avisar(mensagem, { tipo, fixo })`: `fixo: true` fica na tela até o jogador fechar, para o
  aviso que não pode sumir sozinho (o do save indisponível do RoqueCraft). A forma não muda.
- `jogo check`: `firebase`, `firebase/*` e `@firebase/*` proibidos no `src/` do jogo, em
  `import`, `export … from`, `import()` e `require()`, com arquivo, linha e o porquê: o jogo
  não fala com banco, quem fala é o host. Estava escrito no motivo da `sala` desde a 0.2.0 e
  nada impedia. Import comentado não conta.
- `jogo.json`: `salaAoVivo` com `aceitaConvite: false` reprova, pelo mesmo motivo da `sala`
  (`CAPACIDADES_COM_CONVITE`).
- Host falso: `salaAoVivo` com o mesmo motor do de desenvolvimento, sobre o Storage em memória;
  os outros jogadores por `disparar('salaAoVivo', { acao, codigo, uid, ... })` (`criar`,
  `gravar`, `atualizar`, `apagar`, `empurrar`, `aoCair`, `cair`, `sumir`); a queda desta janela
  por `disparar('conexao', false)`, que roda o que ela armou com `aoCair`; a opção `recusar`
  para o teste fazer o papel da regra do banco; `arvoreDaSala(codigo)`. `progresso` em memória
  com `progresso: { salvo, falharLeitura, falharEscrita, disponivel }` e
  `disparar('progresso', …)`; sem `disponivel`, segue a conta. `ia` com `iaDisponivel` e
  `disparar('ia', { disponivel })`, conferindo o formato do pedido. `avisosDoHost` guarda o que
  o host diria no console. `salaAoVivo: false` e `progresso: false` tiram as capacidades.
- Os dois hosts de teste recusam em `progresso.salvar`, com `false`, o que o Firestore recusa:
  `undefined`, array dentro de array, objeto que não é mapa simples, campo vazio ou `__assim__`,
  e documento acima de 1 MiB (medido com o `firebase` 12.7.0 do front). É o que pega o save do
  RoqueCraft, que grava `outrasDimensoes` como array dentro de array.
- Host de desenvolvimento: `salaAoVivo` entre abas do mesmo navegador, uma folha por chave no
  `localStorage` e um índice em memória mantido pelo evento `storage`; cada escrita termina
  numa chave da sala com a lista das folhas, e a outra aba aplica a escrita inteira de uma vez.
  `aoCair` roda no `pagehide`; `conectado` segue o `navigator.onLine`. `progresso` em
  `roqueos:<jogo>:progresso`. `avisar` marca o fixo no console. Não emula regra do banco.
- `armazenamentoEmMemoria()` enumera como o Storage de verdade (`length` e `key(i)`).
- Novo ponto de entrada `@roqueos-games/jogo-sdk/sala-ao-vivo`, com as regras de caminho, de
  valor e do código da sala (`segmentosDoCaminho`, `conferirValor`, `conferirAtualizacao`,
  `normalizarCodigoDaSala`, `MARCADOR_DA_HORA`), para o host do RoqueOS recusar exatamente o
  que os hosts de teste recusam.

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
