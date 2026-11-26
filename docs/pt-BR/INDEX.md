# Documentação do jogo-sdk

_[English](../INDEX.md) | Português_

O contrato entre o RoqueOS e um jogo, com os hosts que rodam o jogo sozinho e no teste, o CLI `jogo` e os kits que todos os jogos da [roqueos-games](https://github.com/roqueos-games) dividem. Para quem escreve um jogo, implementa um host, ou muda o SDK.

Por onde começar depende do que você quer.

| Quero...                                                   | Leia                                                                                          |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Instalar e ver funcionando**                             | [COMECAR.md](COMECAR.md): do zero ao primeiro resultado                                       |
| **Usar uma capacidade ou um kit num jogo**                 | [INTEGRACOES.md](INTEGRACOES.md): cada capacidade e cada kit, com código                      |
| **Ver como ele é por dentro**                              | [ARQUITETURA.md](ARQUITETURA.md): contexto, processos, componentes, fluxos, decisões, limites |
| **Consultar um comando, ponto de entrada, chave ou campo** | [REFERENCIA.md](REFERENCIA.md)                                                                |
| **Manter e cortar uma versão**                             | [OPERACAO.md](OPERACAO.md): rotina, publicar, atualizar, desfazer                             |
| **Entender uma falha**                                     | [QUANDO-QUEBRA.md](QUANDO-QUEBRA.md): sintoma, causa, o que fazer                             |
| **Acrescentar uma capacidade, uma régua ou um comando**    | [ESTENDER.md](ESTENDER.md)                                                                    |
| **Saber o que os testes provam**                           | [TESTES.md](TESTES.md)                                                                        |
| **Saber o que ele protege e o que não protege**            | [MODELO-DE-AMEACAS.md](MODELO-DE-AMEACAS.md)                                                  |
| **Achar um termo**                                         | [GLOSSARIO.md](GLOSSARIO.md)                                                                  |
| **Contribuir**                                             | [CONTRIBUTING.md](CONTRIBUTING.md)                                                            |
| **Ver o que mudou**                                        | [CHANGELOG.md](../../CHANGELOG.md)                                                            |
| **Relatar uma vulnerabilidade**                            | [SECURITY.md](../../SECURITY.md)                                                              |

## Diagramas

| Diagrama                            | Fonte                                                                | Explicado em                                                                                               |
| ----------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Os três hosts e o contrato (imagem) | [`contrato.svg`](../contrato.svg), um SVG escrito à mão, sem gerador | [README.pt-BR.md](../../README.pt-BR.md)                                                                   |
| Contexto: hosts, contrato, jogo, CI | mermaid no Markdown                                                  | [ARQUITETURA.md, seção 2](ARQUITETURA.md#2-contexto-quem-usa-e-do-que-depende)                             |
| Montar um jogo                      | mermaid no Markdown                                                  | [ARQUITETURA.md, seção 5.1](ARQUITETURA.md#51-montar-um-jogo)                                              |
| O `jogo check` no CI de um jogo     | mermaid no Markdown                                                  | [ARQUITETURA.md, seção 5.2](ARQUITETURA.md#52-o-jogo-check-no-ci-de-um-jogo)                               |
| Importar um modelo de mercado       | mermaid no Markdown                                                  | [ARQUITETURA.md, seção 5.3](ARQUITETURA.md#53-importar-um-modelo-de-mercado)                               |
| Uma sala ao vivo entre duas abas    | mermaid no Markdown                                                  | [ARQUITETURA.md, seção 5.4](ARQUITETURA.md#54-uma-sala-ao-vivo-entre-duas-abas-no-host-de-desenvolvimento) |
