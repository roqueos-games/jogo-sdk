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
      'avisar(mensagem, { tipo }) com tipo info, sucesso, aviso ou erro. É o que o jogador PRECISA ler, como "partida online pede conta".',
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
  ia: {
    obrigatoria: false,
    forma: { completar: FN },
    porque:
      'completar({ sistema, mensagens }) devolve texto ou null. A chave do provedor nunca chega no jogo, e o host decide limite e consentimento, porque cada chamada pode custar dinheiro na conta do jogador.',
  },
})

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
  if (host.versaoDoContrato > VERSAO_DO_CONTRATO + 1) {
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
