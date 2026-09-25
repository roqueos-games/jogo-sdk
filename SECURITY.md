# Segurança

## Como reportar

Não abra issue pública para falha de segurança. Use o
[relatório privado de vulnerabilidade](https://github.com/roqueos-games/jogo-sdk/security/advisories/new)
do GitHub. A resposta vem em até sete dias.

## O que este SDK promete, e o que não promete

Um jogo roda **na mesma origem** do RoqueOS. O SDK entrega capacidades em vez das stores do
sistema, e isso organiza o código, mas **não é uma fronteira de segurança**: código na mesma
origem consegue ler o que a página lê. O que protege quem usa o RoqueOS é:

- todo merge nos repos da organização passa pela revisão do mantenedor (`CODEOWNERS`);
- o RoqueOS instala cada jogo por uma versão exata, com o SHA travado no lockfile, e toda
  troca de versão é revisada antes de entrar;
- nenhum repo de jogo pode ter script que rode sozinho no install, e o `jogo check` reprova;
- a capacidade `ia` nunca entrega chave de provedor ao jogo, e quem limita o uso é o host;
- o CI de pull request não lê segredo nenhum.

---

## Security (English)

Do not open public issues for vulnerabilities; use GitHub's private vulnerability reporting.
Games run on the same origin as RoqueOS: the capability boundary organizes code but is not a
security boundary. Protection comes from maintainer review on every merge, exact version pins
in RoqueOS, no install-time scripts, AI keys never reaching the game, and secret-free CI.
