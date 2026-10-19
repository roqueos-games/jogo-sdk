# Changelog

## 0.7.4 (em preparação, 19/10/2026)

- `etapa(nome, promessa, { opcional: true, aguardar: true })` espera a resolução ou rejeição antes de concluir a carga estrita, sem transformar falha do áudio em falha visual. O preparo aguardado participa do progresso e de `etapaAtual()`.
- Usa o mesmo teto global: depois do selo, se todas as obrigatórias terminaram com sucesso e só faltam opcionais aguardadas, o teto conclui. Recurso obrigatório pendente continua erro de prazo; falha obrigatória, registro inválido e cancelamento continuam fatais. Nenhum temporizador novo ou tentativa de abortar downloads.
- `opcional: true` sem `aguardar` continua não bloqueante; `aguardar` sem `opcional` não tolera falha obrigatória. Carga legada, modelos073, contrato do host1, áudio/samples e dependências permanecem inalterados. Candidata local; publicação e integração dependem de revisão e gates.

## 0.7.3 (19/10/2026)

- `criarCenario.liberar()` opcional abandona a carga antes da transferência de recursos: geometria, materiais, mapas e HDR são liberados uma única vez, inclusive quando compartilhados ou recebidos depois do encerramento. Tabelas e cache são limpos; cenário encerrado não aceita nova carga, clone, material ou ambiente.
- Carga pendente rejeita com código seguro `CENARIO_ENCERRADO` ao terminar, sem repopular o cenário. O método não aborta a rede. Clones compartilham recursos; o chamador só libera antes da transferência, ou coordena explicitamente todos os donos. Mapas clonados e PMREM já aplicados continuam sob responsabilidade do jogo.
- Sem chamada explícita, comportamento padrão, `faltaram`, `criarCarregador.esquecer()` e contrato do host 1 permanecem iguais. Sem dependências novas.

## 0.7.2 (19/10/2026)

- Opt-in `estrito` em criarCarregador/criarCenario detecta falha de textura interna que o GLTFLoader absorve. Manager privado por modelo, erro seguro, limpeza do resultado incompleto e retry sem cache de falha. Modelos concorrentes não se contaminam.
- O cenário mantém o resultado `faltaram`; quem chama decide a UI de recuperação. Sem opt-in, contratos e comportamento anteriores permanecem iguais. Sem novas dependências ou alterações na carga071.

## 0.7.1 (19/10/2026)

Carga estrita opcional para revelar a cena só depois de suas tarefas obrigatórias. O contrato
do host continua na versão 1 e o comportamento padrão de `criarCarga` permanece igual.

- `criarCarga({ estrita: true })`: exige `selar()` ao terminar de registrar as etapas;
  resolve `pronto` somente com todas as obrigatórias bem-sucedidas. Falha, teto ou liberação
  rejeitam a promessa original com código e nomes lógicos das etapas, sem a mensagem/URL do asset.
- `etapa(nome, promessa, { opcional: true })` não bloqueia a prontidão nem participa do
  progresso obrigatório. O chamador decide explicitamente o que pode faltar; nenhum áudio
  passa a ser opcional automaticamente. Etapa após o selo é erro de registro.
- Estado estrito acrescenta `sucesso`, `erro` e `selada`; falha/cancelamento nunca inventam
  100%. Callbacks do LoadingManager, timer e ouvintes são limpos; rejeição pode ser observada
  depois sem gerar unhandledRejection. Nova tentativa usa uma nova instância.
- Nenhum jogo foi migrado automaticamente. Uma promessa cumprida não verifica por si só a
  integridade do modelo: o produtor precisa rejeitar a etapa se algum recurso requerido faltar.

## 0.7.0 (18/10/2026)

A capacidade opcional `presenca` (goal104 G2, pedido do founder: "quando entrar no mapa o ideal
seria mostrar todos os jogadores on-line"). O contrato continua na versão 1.

- `presenca`: `entrar({ mapa, pose, aparencia })`, `pose(p)` (o host deixa sair até 10 por
  segundo), `observar(fn)` (só quem está no mesmo mapa, sem o próprio jogador), `trocarDeMapa`,
  `sair` e `conectado`. Mapa fora do formato e pose sem números são TypeError na hora.
- `@roqueos-games/jogo-sdk/presenca`: as regras (`conferirMapa`, `conferirPose`,
  `conferirAparencia`, `POSES_POR_SEGUNDO`) e o motor em memória, que o host do RoqueOS usa antes
  da rede.
- Host falso: presença em memória, `disparar('presenca', { t: 'entrou' | 'pose' | 'mapa' |
'saiu' | 'conexao', ... })`, `host.presencaEnviada` e `presenca: false` para tirar. Host de
  desenvolvimento: presença entre abas pelo BroadcastChannel, sem servidor.
- `yarn mutantes` ganhou três mutantes: sem o teto de 10 poses/s, sem o filtro de mapa e o
  `observar` entregando dentro da própria chamada.

## 0.6.0 (18/10/2026)

A capacidade opcional `retomada` (goal104, pedido do founder: "mesmo sendo convidado sem conta
seria legal gravar uma url temporária para a pessoa poder continuar de onde parou e poder se
registrar depois"). O contrato continua na versão 1: capacidade nova e opcional é mudança
menor, e os jogos que não a declaram não a recebem.

- `retomada`: `estado()` ('conta' | 'convidado' | 'sem-onde'), `link()` (o link de uso único,
  com prazo, para continuar em outro aparelho, ou null), `revogar()` e `levarParaConta()`. O
  jogo nunca vê segredo nem código; o código vai no fragmento da URL.
- `progresso`: só o texto do motivo muda, de "Sem conta, disponivel() é false" para "Sem onde
  guardar, disponivel() é false" (decisão 7 do goal104): o host do RoqueOS passa a guardar o
  herói do convidado da RagnaRoque no servidor. A forma não muda.
- Host falso: `retomada` em memória, link `.invalid` com `#retomar=`, `disparar('retomada',
{ estado })` e `retomada: false` para tirar. Host de desenvolvimento: link null e
  `levarParaConta` 'indisponivel' (sem servidor não há outro aparelho).
- `yarn mutantes` ganhou três mutantes: código na query, forma sem `levarParaConta` e o motivo
  do `progresso` de volta a "sem conta".

## 0.5.1 (18/10/2026)

O CLI `jogo` recusa o que não conhece (Goal 102). Duas vezes um agente rodou
`yarn -s jogo assets importar --usage` achando que veria a ajuda; o CLI ignorava qualquer flag
que não lia, e o importador reimportou o catálogo inteiro por cima dos arquivos. O contrato
continua na versão 1: nada aqui muda capacidade, host ou o que o `jogo check` confere.

- `src/cli.js`: cada comando (`check`, `assets importar`, `olho`) declara as opções que aceita,
  e o parse roda inteiro antes de qualquer comando tocar no disco. Opção desconhecida, opção de
  valor sem `=valor` (o `--apenas palmeira` com espaço), opção repetida, bandeira com valor,
  argumento solto a mais, comando ou subcomando desconhecido: sai 2 dizendo qual e com o uso.
- `--usage`, `--help` e `-h` em qualquer nível mostram a ajuda daquele nível e saem 0 sem rodar
  nada; a ajuda ganha de qualquer outro argumento da linha.
- `jogo assets importar --apenas=…` com um id que não está em `assets/importar.json` sai 1 antes
  de escrever, em vez de importar zero itens e dizer "ok".
- `jogo assets importar` sem `--apenas` continua importando a lista inteira.
- `test/cli.test.js` roda o CLI num catálogo falso de verdade (um GLB que o importador sabe ler)
  e confere, por SHA-256 e mtime, que nem a opção desconhecida nem o `--usage` escrevem nada.
  `yarn mutantes` ganhou cinco mutantes do CLI e do `--apenas`.

## 0.4.0 (16/10/2026)

O kit para trocar desenho feito na hora por modelo 3D de mercado (Goal 80, pedido do fundador
de 16/10/2026: todos os jogos na qualidade do Call of Roque e da Agentolandia). O contrato
continua na versão 1: nada aqui muda a forma de uma capacidade, e o host do RoqueOS não muda.

- `@roqueos-games/jogo-sdk/modelos`: `perfilDoJogo(host)` (o `desempenho.modoLeve()` do host
  escolhe entre o perfil baixo e o alto; `?perfil=` força), `prepararRenderizador` (sRGB, tom
  ACES, sombra e pixelRatio pelo perfil), `acenderAmbiente` (HDR ou `RoomEnvironment` via PMREM),
  `criarCarregador` (GLTF com meshopt, um download por arquivo e um clone por pedido, o
  `SkeletonUtils.clone` para modelo com esqueleto, progresso por arquivo) e `liberar`. `criarCenario`
  (Goal 83) junta modelos, texturas PBR e céu num pedido só, mede e assenta o modelo no chão e
  veste material com repetição própria; o que faltar fica listado e não derruba a cena. O SDK não
  importa o three: o jogo entrega os módulos da versão dele.
- `@roqueos-games/jogo-sdk/grafico` (pedido do fundador de 16/10/2026, 21h02, para todos os
  jogos): qualidades Baixo, Médio, Alto e Ultra (Ultra no computador, Médio no toque, Baixo no
  aparelho fraco), cada efeito ligável à parte (oclusão de ambiente GTAO, bloom, borrão de
  movimento da câmera, antisserrilhado, vinheta), FOV, a escolha guardada no `armazenamento` do
  host, e `criarPosProcesso`, a cadeia do quadro sobre o EffectComposer do three do jogo.
- `@roqueos-games/jogo-sdk/painel`: o painel de configurações (Gráfico e Som) em DOM puro,
  folha que sobe do pé da tela no celular e cartão no computador, alvos de 48 px, área segura
  do iPhone, nos dez idiomas.
- `jogo assets importar`: lê `assets/importar.json` e transforma o modelo (Poly Haven pela API,
  ou arquivo baixado à mão do Sketchfab, do Mixamo ou do Fab; FBX, OBJ e `.blend` passam pelo
  Blender sem janela) em GLB com geometria meshopt e textura WebP. Fixa o SHA-256 do original em
  `assets/source-lock.json` (original que mudou na origem para o import) e escreve a linha do
  ASSETS.md com o SHA-256 da saída. As dependências pesadas são do jogo, em devDependencies.
  Com `texturasFora`, sai `.gltf` + `.bin` + texturas ao lado, cada arquivo com a própria linha:
  o WKWebView do iPhone não mostra textura embutida no GLB.
- `jogo olho <rótulo>`: o roteiro do jogo (`olho/roteiro.mjs`) leva até a partida, e o olho tira
  as fotos e mede o quadro (p50, p99, pior, acima de 100 ms) em desktop no perfil alto, celular e
  TV no baixo, em pt-BR, gravando o renderizador que o WebGL reportou.
- `jogo check`, três réguas novas: o teto por perfil (30 MB fora de `alto/`, 120 MB no total;
  decisão do fundador de 16/10/2026), o asset do Fab só dentro de `.pak` e só em jogo fechado
  (EULA §4c e §5a), e a quarta coluna opcional do ASSETS.md com o SHA-256, que o arquivo tem de
  bater. `yarn mutantes` quebra cada régua de propósito e confere que a suíte reprova.

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
