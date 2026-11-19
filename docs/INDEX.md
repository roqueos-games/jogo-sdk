# jogo-sdk documentation

_English | [Português](pt-BR/INDEX.md)_

The contract between RoqueOS and a game, with the hosts that run a game alone and in tests, the `jogo` CLI and the kits every game in [roqueos-games](https://github.com/roqueos-games) shares. For whoever writes a game, implements a host, or changes the SDK.

Where to start depends on what you want.

| I want...                                        | Read                                                                                         |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| **Install and see it working**                   | [GETTING-STARTED.md](GETTING-STARTED.md): from zero to the first result                      |
| **Use a capability or a kit in a game**          | [INTEGRATIONS.md](INTEGRATIONS.md): every capability and kit, with code                      |
| **See how it is built inside**                   | [ARCHITECTURE.md](ARCHITECTURE.md): context, processes, components, flows, decisions, limits |
| **Look up a command, entry point, key or field** | [REFERENCE.md](REFERENCE.md)                                                                 |
| **Maintain it and cut a release**                | [OPERATIONS.md](OPERATIONS.md): routine, publishing, updating, undoing                       |
| **Understand a failure**                         | [WHEN-IT-BREAKS.md](WHEN-IT-BREAKS.md): symptom, cause, what to do                           |
| **Add a capability, a rule or a command**        | [EXTENDING.md](EXTENDING.md)                                                                 |
| **Know what the tests prove**                    | [TESTING.md](TESTING.md)                                                                     |
| **Know what it protects and what it does not**   | [THREAT-MODEL.md](THREAT-MODEL.md)                                                           |
| **Find a term**                                  | [GLOSSARY.md](GLOSSARY.md)                                                                   |
| **Contribute**                                   | [CONTRIBUTING.md](../CONTRIBUTING.md)                                                        |
| **See what changed**                             | [CHANGELOG.md](../CHANGELOG.md) (in Portuguese)                                              |
| **Report a vulnerability**                       | [SECURITY.md](../SECURITY.md)                                                                |

## Diagrams

| Diagram                                  | Source                                                           | Explained in                                                                                            |
| ---------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| The three hosts and the contract (image) | [`contrato.svg`](contrato.svg), a hand-written SVG, no generator | [README.md](../README.md)                                                                               |
| Context: hosts, contract, game, CI       | Mermaid in the Markdown                                          | [ARCHITECTURE.md, section 2](ARCHITECTURE.md#2-context-who-uses-it-and-what-it-depends-on)              |
| Mounting a game                          | Mermaid in the Markdown                                          | [ARCHITECTURE.md, section 5.1](ARCHITECTURE.md#51-mounting-a-game)                                      |
| `jogo check` in a game's CI              | Mermaid in the Markdown                                          | [ARCHITECTURE.md, section 5.2](ARCHITECTURE.md#52-jogo-check-in-a-games-ci)                             |
| Importing a third-party model            | Mermaid in the Markdown                                          | [ARCHITECTURE.md, section 5.3](ARCHITECTURE.md#53-importing-a-third-party-model)                        |
| A live room between two tabs             | Mermaid in the Markdown                                          | [ARCHITECTURE.md, section 5.4](ARCHITECTURE.md#54-a-live-room-between-two-tabs-on-the-development-host) |
