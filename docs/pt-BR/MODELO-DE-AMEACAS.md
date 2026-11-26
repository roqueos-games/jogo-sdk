# Modelo de ameaças

_[English](../THREAT-MODEL.md) | Português_

> **Para quem:** quem revisa um jogo para o RoqueOS, uma mudança no SDK, ou quer saber o que o SDK promete em segurança e o que não promete.
> **O que tem aqui:** o que se protege, de quem, por qual mecanismo, e o que explicitamente não se protege.
> **Onde ir para o resto:** como relatar uma vulnerabilidade, no [SECURITY.md](../../SECURITY.md); as decisões por trás de cada mecanismo, na [ARQUITETURA.md](ARQUITETURA.md#8-decisões-de-design).

## Sumário

1. [A premissa](#1-a-premissa)
2. [O que se protege](#2-o-que-se-protege)
3. [Ameaças e mecanismos](#3-ameaças-e-mecanismos)
4. [O que não se protege](#4-o-que-não-se-protege)

## 1. A premissa

Um jogo roda na mesma origem do RoqueOS. O SDK entrega capacidades em vez das stores do sistema, e isso organiza o código, mas **não é uma fronteira de segurança**: código na mesma origem consegue ler o que a página lê ([SECURITY.md](../../SECURITY.md)). Cada mecanismo abaixo existe por causa dessa premissa, e nenhum finge isolar.

## 2. O que se protege

| Ativo                                     | Onde mora                                            | Por que importa                                                                                    |
| ----------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| A sessão e os dados de quem usa o RoqueOS | a página do RoqueOS, na mesma origem do jogo         | um jogo malicioso alcançaria                                                                       |
| A máquina de quem mantém                  | onde quer que o `yarn install` rode um jogo ou o SDK | script de instalação roda ali sozinho                                                              |
| As chaves dos provedores de IA            | o host do RoqueOS                                    | cada chamada pode custar dinheiro na conta do jogador ([`src/contrato.js`](../../src/contrato.js)) |
| Os assets do Fab e do Sonniss             | arquivos `.pak` em jogos fechados                    | as licenças proíbem deixar o arquivo sair ([`src/verificacao.js`](../../src/verificacao.js))       |
| O código de retomada de um convidado      | o link da `retomada`                                 | quem tem o link leva o herói ([`src/contrato.js`](../../src/contrato.js))                          |
| O mundo salvo do jogador                  | o documento do `progresso`                           | uma escrita errada apaga meses de construção                                                       |

## 3. Ameaças e mecanismos

| Ameaça                                                 | Mecanismo                                                                                                                       | Onde                                                         |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Código malicioso mergeado num jogo aberto ou no SDK    | todo merge passa pela revisão do mantenedor                                                                                     | [`.github/CODEOWNERS`](../../.github/CODEOWNERS)             |
| A versão de um jogo trocada depois da revisão          | o RoqueOS instala cada jogo numa versão exata com o SHA travado no lockfile, e toda troca de versão é revisada                  | [SECURITY.md](../../SECURITY.md)                             |
| Um script que roda sozinho no `yarn install`           | o `jogo check` reprova `preinstall`, `install`, `postinstall`, `prepare`, `prepack` e `postpack`, e o SDK roda isso em si mesmo | [`src/verificacao.js`](../../src/verificacao.js)             |
| Um pull request de fork roubando um token              | o CI roda em `pull_request`, nunca em `pull_request_target`, não lê segredo e só tem permissão de leitura                       | [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) |
| Um jogo alcançando o banco direto                      | `firebase`, `firebase/*` e `@firebase/*` são proibidos no `src/` do jogo; quem fala com o banco é o host                        | [`src/verificacao.js`](../../src/verificacao.js)             |
| Um jogo lendo uma chave de IA                          | a `ia` nunca entrega a chave ao jogo; o host decide limite e consentimento                                                      | [`src/contrato.js`](../../src/contrato.js)                   |
| Um asset licenciado coletado por URL                   | Fab e Sonniss só dentro de um `.pak` em AES-GCM, aberto em memória, só em jogo fechado                                          | [`src/pacote.js`](../../src/pacote.js)                       |
| Um código de retomada vazando para log de servidor     | o código vai no fragmento da URL (`#`), que não chega a servidor nem a log                                                      | [`src/contrato.js`](../../src/contrato.js)                   |
| Um caminho do importador escapando do repo             | o `dentro()` recusa qualquer caminho de saída fora da base, porque os nomes vêm de uma API de terceiros ou de um JSON           | [`src/importador.js`](../../src/importador.js)               |
| Um save que o banco recusaria, descoberto pelo jogador | os hosts de teste recusam o que o Firestore recusa, então o teste do jogo reprova antes                                         | [`src/host/progresso.js`](../../src/host/progresso.js)       |

## 4. O que não se protege

- **Isolamento.** Um jogo na mesma origem lê o que o RoqueOS lê. A proteção é a revisão e o pin, não a fronteira das capacidades.
- **A chave do `.pak`.** Ela mora no código do jogo, em repositório privado. Quem lê o JavaScript do jogo chega à chave; ela impede o download direto e a coleta por URL e não é DRM ([`src/pacote.js`](../../src/pacote.js)).
- **As regras do banco.** Quem pode escrever onde é decidido pelas regras do banco do RoqueOS, não pelo SDK. O host de desenvolvimento não as emula; o `recusar` do host falso só faz o papel delas no teste ([`src/host/salaAoVivo.js`](../../src/host/salaAoVivo.js)).
- **O host de verdade.** O host do RoqueOS mora fora deste repo; nada aqui prova como ele aplica essas regras.
- **Confusão de dependência num jogo.** O SDK não tem dependência de runtime, mas as dependências do próprio jogo são revisadas no repo do jogo, não aqui.
