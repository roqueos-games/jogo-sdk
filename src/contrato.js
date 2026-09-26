// O CONTRATO ENTRE O ROQUEOS E UM JOGO.
//
// O jogo não importa nada do RoqueOS. Ele recebe um `host` com capacidades, e
// é só por elas que fala com o sistema: quem é o jogador, onde guardar o
// recorde, se o aparelho é fraco, como avisar alguma coisa na tela. O host do
// RoqueOS implementa isto por cima das stores dele; o host de desenvolvimento
// implementa com o navegador puro, para o jogo rodar sozinho; o host falso
// implementa em memória, para teste.
//
// Por que capacidade, e não store: um jogo que recebe a store inteira pode
// abrir janela, ler credencial de servidor e mexer no desktop. Um jogo que
// recebe `placar.salvar` só consegue salvar o próprio placar. Isto organiza o
// código; não é fronteira de segurança, porque código na mesma origem lê o que
// a página lê. A segurança de um jogo aberto vem da revisão no merge e do pin
// exato de versão no RoqueOS.
//
// Versionamento: capacidade nova e opcional é mudança menor; mudar a forma de
// uma que existe é versão nova do contrato, e o host recusa o jogo que pede
// outra versão em vez de quebrar em runtime.

export const VERSAO_DO_CONTRATO = 1

/** Função. Qualquer outro valor em `forma` é um objeto com aquelas chaves. */
export const FN = 'fn'

/**
 * As capacidades, com a forma que o host precisa entregar e o motivo de cada
 * uma existir. O motivo é parte do contrato: capacidade sem motivo vira
 * atalho para o jogo alcançar o que não devia.
 */
export const CAPACIDADES = Object.freeze({
  identidade: {
    obrigatoria: true,
    forma: { atual: FN, aoMudar: FN },
    porque:
      'atual() devolve { uid, nome } ou { uid: null, nome: null } para convidado. O jogo usa para decidir se salva na conta e para mostrar o nome em partida online.',
  },
  avisar: {
    obrigatoria: true,
    forma: FN,
    porque:
      'avisar(mensagem, { tipo, fixo }) com tipo info, sucesso, aviso ou erro. É o que o jogador PRECISA ler, como "partida online pede conta". fixo: true fica na tela até o jogador fechar, para o aviso que não pode sumir sozinho: "não consegui ler o seu mundo, nada foi gravado por cima" some em cinco segundos e o jogador acha que perdeu tudo. Host que não sabe fazer aviso fixo mostra passageiro, pior mas sem quebrar.',
  },
  audio: {
    obrigatoria: true,
    forma: { contexto: FN, destravar: FN },
    porque:
      'contexto() devolve o AudioContext compartilhado (ou null). destravar() existe porque o iOS só libera áudio depois de um gesto do usuário.',
  },
  desempenho: {
    obrigatoria: true,
    forma: { modoLeve: FN },
    porque:
      'modoLeve() diz se o aparelho pede o perfil leve: sem sombra, sem pós-processamento, pixelRatio baixo. Efeito bonito no desktop derruba o iPhone.',
  },
  metricas: {
    obrigatoria: true,
    forma: { evento: FN },
    porque:
      'evento(nome, dados) registra uso. Os nomes de evento são do jogo e não mudam sem motivo, porque o histórico de analytics depende deles.',
  },
  placar: {
    obrigatoria: true,
    forma: { carregar: FN, salvar: FN },
    porque:
      'carregar() e salvar(dados) do recorde DESTE jogo. O host já nasce preso ao jogo, então um jogo não escreve o placar de outro. O host do RoqueOS espelha o best no Pódio.',
  },
  armazenamento: {
    obrigatoria: true,
    forma: { ler: FN, gravar: FN, apagar: FN },
    porque:
      'Chave e valor em texto, no espaço roqueos:<jogo>:<chave>. É o mesmo formato das chaves que os jogos já usavam no localStorage, e é o que garante que ninguém perde o recorde na extração.',
  },
  idioma: {
    obrigatoria: true,
    forma: { atual: FN, aoMudar: FN },
    porque:
      'atual() devolve um dos dez idiomas. O texto do jogo mora no jogo e desce quando ele monta, não no pacote de entrada do RoqueOS.',
  },
  tela: {
    obrigatoria: false,
    forma: { alternarTelaCheia: FN, emTelaCheia: FN },
    porque: 'Tela cheia de verdade, que no RoqueOS precisa sair da janela sem desmontar o jogo.',
  },
  teclado: {
    obrigatoria: false,
    forma: { reivindicar: FN, liberar: FN },
    porque:
      'No desktop do RoqueOS várias janelas disputam o teclado. O jogo reivindica enquanto está ativo e libera quando perde o foco.',
  },
  // A forma da `ia` mudou na 0.3.0 (entrou `disponivel`) sem versão nova do
  // contrato, como exceção: nenhum host em uso e nenhum jogo tinham `ia`, então
  // ninguém quebra. O motivo e a medição estão no CHANGELOG. Não é precedente.
  ia: {
    obrigatoria: false,
    forma: { completar: FN, disponivel: FN },
    porque:
      'disponivel() diz, ANTES da pergunta, se há modelo agora: prometer conversa e devolver frase pronta é pior que não oferecer a caixa de texto. completar({ sistema, mensagens }), com mensagens [{ papel: "jogador" | "modelo", texto }], devolve texto ou null (sem modelo, erro ou limite). A chave do provedor nunca chega no jogo, e o host decide limite e consentimento, porque cada chamada pode custar dinheiro na conta do jogador.',
  },
  // A sala, função por função:
  //
  //   criar({ estadoInicial, vez })  → { codigo, link }. Quem joga agora vira
  //       o anfitrião (o host sabe quem é). Sem conta, lança Error com
  //       .codigo = 'sem-conta'.
  //   entrar(codigo)  → { ok: true } | { ok: true, reentrada: true } |
  //       { erro: 'nao-encontrada' | 'propria' | 'cheia' | 'sem-conta' }.
  //       Reentrada é quem já era o convidado voltando (recarregou a página).
  //   observar(codigo, fn)  → parar(). fn recebe a sala, ou null se ela
  //       sumiu, a primeira vez logo depois e de novo a cada mudança. Nunca
  //       dentro do próprio observar: no banco de verdade a sala chega depois.
  //   jogar(codigo, { estado, vez, vencedor, situacao })  estado e vez sempre;
  //       vencedor e situacao só quando mudam.
  //   encerrar(codigo, vencedor)  melhor esforço, nunca lança.
  //   conviteRecebido()  o código do convite com que esta janela foi aberta
  //       (link ou QR), ou null.
  //
  // A sala que o observar entrega: { anfitriao, nomeDoAnfitriao, convidado,
  // nomeDoConvidado, situacao, vez, estado, vencedor, anfitriaoSaiu }, com
  // situacao em SITUACOES_DA_SALA. O jogo sabe o próprio lado pelo que
  // chamou (quem criou é o anfitrião, quem entrou é o convidado) e não
  // precisa comparar uid. Os nomes são do SDK; traduzir para os campos do
  // banco é trabalho do host do RoqueOS, e o banco não muda por causa disto.
  sala: {
    obrigatoria: false,
    forma: {
      criar: FN,
      entrar: FN,
      observar: FN,
      jogar: FN,
      encerrar: FN,
      conviteRecebido: FN,
    },
    porque:
      'Partida online de dois jogadores: um cria a sala e recebe código e link (o QR), o outro entra, e os dois trocam o estado do tabuleiro. O jogo não fala com banco nenhum: quem guarda a sala é o host, e o estado é opaco para ele, que só repassa. Sem conta não há sala: criar lança e entrar devolve sem-conta, e é o jogo que avisa o jogador.',
  },
  // A sala ao vivo (desde 0.3.0), função por função. `caminho` é relativo à
  // sala, com os segmentos separados por '/'; '' é a sala inteira.
  //
  //   criar({ meta })  → { codigo, link, eu: { uid, nome } }. O host grava
  //       `meta` com host = eu.uid, hostName e createdAt (hora do servidor),
  //       e a janela passa a estar na sala. Sem conta, lança Error com
  //       .codigo = 'sem-conta'; sem código livre, lança.
  //   entrar(codigo)  → { ok: true, meta, eu } | { erro: 'nao-encontrada' |
  //       'sem-conta' }. Não escreve nada: a presença é do jogo.
  //   sair(codigo)  para os ouvintes daquela sala nesta janela. Não escreve
  //       nada, e o que foi armado com aoCair continua armado, como no banco.
  //   conviteRecebido()  o código com que a janela foi aberta, ou null.
  //   conectado(fn)  → parar(). fn(true | false) logo depois e a cada troca.
  //   horaDoServidor()  marcador opaco que o host troca pela hora do servidor
  //       quando grava. É { '.sv': 'timestamp' }, o mesmo do Realtime Database.
  //
  //   ler(codigo, caminho)  → Promise<valor | null>. Rejeita quando não
  //       consegue ler (.codigo = 'indisponivel', ou 'fora-da-sala').
  //   gravar(codigo, caminho, valor)  → Promise<boolean>. Substitui; null apaga.
  //   atualizar(codigo, caminho, parcial)  → Promise<boolean>. Cada chave de
  //       `parcial` pode ser um caminho ('3_-7/1234'); null apaga aquela chave.
  //   apagar(codigo, caminho)  → Promise<boolean>.
  //   empurrar(codigo, caminho, valor)  → Promise<chave | null>, com a chave
  //       nova em ordem de tempo.
  //   observar(codigo, caminho, fn)  → parar(). fn(valor | null) logo depois
  //       e a cada mudança daquele caminho.
  //   observarFilhos(codigo, caminho, { adicionado, mudado, removido },
  //       { ultimos })  → parar(). Cada fn(chave, valor), em ordem de chave;
  //       removido recebe o valor que o filho tinha; ultimos: só os N últimos.
  //   aoCair(codigo, caminho, 'apagar' | 'cancelar')  → Promise<boolean>. O
  //       que o host apaga quando esta janela cair ou fechar; 'cancelar'
  //       desarma aquele caminho e tudo abaixo dele, como o banco faz.
  //
  // Vale para todas:
  //   - Caminho com '.', '#', '$', '[', ']', caractere de controle ou segmento
  //     vazio, e undefined, função ou NaN em qualquer ponto do valor: TypeError
  //     na hora da chamada. O banco recusa os dois; pegar no teste é melhor
  //     que pegar no jogador.
  //   - Escrita recusada (regra do banco, rede, sala que esta janela não criou
  //     nem entrou) resolve false, ou null no empurrar. Nunca lança.
  //   - Na sala que esta janela não criou nem entrou, ler rejeita com
  //     'fora-da-sala' e observar não entrega nada, como a regra do banco.
  //   - A primeira entrega de observar, observarFilhos e conectado nunca sai
  //     dentro da própria chamada: no banco de verdade ela chega depois.
  //   - O valor volta como o Realtime Database devolve: objeto vazio some
  //     (null), e array é guardado por índice e volta array quando todas as
  //     chaves são inteiras e mais da metade dos índices está preenchida.
  salaAoVivo: {
    obrigatoria: false,
    forma: {
      criar: FN,
      entrar: FN,
      sair: FN,
      conviteRecebido: FN,
      conectado: FN,
      horaDoServidor: FN,
      ler: FN,
      gravar: FN,
      atualizar: FN,
      apagar: FN,
      empurrar: FN,
      observar: FN,
      observarFilhos: FN,
      aoCair: FN,
    },
    porque:
      'Partida em tempo real de vários jogadores no mesmo mundo: presença de cada um, o que só o anfitrião simula, as intenções dos convidados, os pedaços do mundo que mudaram. O host dá o código, o link do convite e quem é o jogador dentro da sala, e guarda a sala no nó que é DESTE jogo: o jogo só enxerga caminhos dentro dela. O que cada nó significa é do jogo; quem decide quem escreve onde é a regra do banco, não o SDK. Sem conta não há sala: criar lança e entrar devolve sem-conta, e é o jogo que avisa o jogador.',
  },
  // O progresso, função por função (desde 0.3.0):
  //
  //   disponivel()  → boolean: há onde guardar agora (no RoqueOS, há conta).
  //   carregar()  → Promise<objeto | null>. null é "não há save"; quando não
  //       consegue ler, REJEITA com .codigo = 'indisponivel'. Sem onde guardar,
  //       null sem tentar.
  //   salvar(dados, { mesclar = false })  → Promise<boolean>. Substitui o
  //       documento; com mesclar, funde mapa com mapa e mantém o campo que não
  //       veio. Recusa (false) o que o Firestore recusa: undefined, array
  //       dentro de array, objeto que não é mapa simples, documento acima de
  //       1 MiB. Nunca lança.
  progresso: {
    obrigatoria: false,
    forma: { disponivel: FN, carregar: FN, salvar: FN },
    porque:
      'O jogo salvo do jogador, na conta dele: o herói, o mundo. Um documento por jogo, que o host já nasce sabendo qual é. "Não tem save" e "não consegui ler o save" são respostas diferentes (null e rejeição), porque confundir as duas grava um mundo vazio por cima de meses de construção. Sem conta, disponivel() é false e nada vai para a conta.',
  },
})

/** As situações de uma sala, na ordem em que acontecem. */
export const SITUACOES_DA_SALA = Object.freeze(['esperando', 'jogando', 'encerrada'])

/** Os motivos de `sala.entrar` recusar, e o de `sala.criar` lançar ('sem-conta'). */
export const ERROS_DA_SALA = Object.freeze(['nao-encontrada', 'propria', 'cheia', 'sem-conta'])

/** Os motivos de `salaAoVivo.entrar` recusar, e o de `salaAoVivo.criar` lançar ('sem-conta'). */
export const ERROS_DA_SALA_AO_VIVO = Object.freeze(['nao-encontrada', 'sem-conta'])

/** Quem fala em cada mensagem de `ia.completar`. */
export const PAPEIS_DA_IA = Object.freeze(['jogador', 'modelo'])

export const OBRIGATORIAS = Object.freeze(
  Object.keys(CAPACIDADES).filter((c) => CAPACIDADES[c].obrigatoria),
)
export const OPCIONAIS = Object.freeze(
  Object.keys(CAPACIDADES).filter((c) => !CAPACIDADES[c].obrigatoria),
)

function conferirForma(valor, forma, caminho, problemas) {
  if (forma === FN) {
    if (typeof valor !== 'function') problemas.push(`${caminho} precisa ser função`)
    return
  }
  if (!valor || typeof valor !== 'object') {
    problemas.push(`${caminho} precisa ser um objeto com ${Object.keys(forma).join(', ')}`)
    return
  }
  for (const [chave, sub] of Object.entries(forma)) {
    conferirForma(valor[chave], sub, `${caminho}.${chave}`, problemas)
  }
}

/**
 * Confere se um host cumpre o contrato: a versão, as obrigatórias e as
 * opcionais que o jogo declarou exigir. Devolve a lista inteira de problemas,
 * não o primeiro, porque host incompleto se conserta de uma vez.
 * @param {object} host
 * @param {{ exigidas?: string[] }} [opcoes]
 * @returns {{ ok: boolean, problemas: string[] }}
 */
export function verificarHost(host, { exigidas = [] } = {}) {
  const problemas = []
  if (!host || typeof host !== 'object') {
    return { ok: false, problemas: ['host ausente'] }
  }
  if (host.versaoDoContrato !== VERSAO_DO_CONTRATO) {
    problemas.push(
      `host fala o contrato ${host.versaoDoContrato ?? '(sem versão)'}, o jogo fala o ${VERSAO_DO_CONTRATO}`,
    )
  }
  for (const nome of exigidas) {
    if (!(nome in CAPACIDADES)) problemas.push(`o jogo exige "${nome}", que não existe no contrato`)
  }
  const olhar = new Set([...OBRIGATORIAS, ...exigidas.filter((n) => n in CAPACIDADES)])
  for (const nome of Object.keys(CAPACIDADES)) {
    const presente = host[nome] !== undefined && host[nome] !== null
    if (!presente) {
      if (olhar.has(nome)) problemas.push(`falta a capacidade "${nome}"`)
      continue
    }
    conferirForma(host[nome], CAPACIDADES[nome].forma, nome, problemas)
  }
  return { ok: problemas.length === 0, problemas }
}
