# How to contribute

_English | [Português](docs/pt-BR/CONTRIBUTING.md)_

Thank you for wanting to help. This repo is small on purpose, and the bar is the same for everyone, maintainers included.

1. Open an issue before changing the contract ([`src/contrato.js`](src/contrato.js)). A new capability touches RoqueOS and every game, so the conversation comes before the code.
2. Fork, create a branch, and run `yarn install --ignore-scripts`.
3. Every new rule comes with a test that fails without it. A test that passes with and without the change proves nothing.
4. Run `yarn verificar` before opening the pull request. It is the same command CI runs.
5. Open the pull request explaining the why, not only the what.

The code, the comments and the commit messages are in Brazilian Portuguese, the project's canonical language. Issues and pull requests in English are welcome.

No script that runs by itself on install (`preinstall`, `postinstall`, `prepare`): `jogo check` fails it, and the reason is in [`src/verificacao.js`](src/verificacao.js).

Where each kind of change goes, and which test proves it, is in [docs/EXTENDING.md](docs/EXTENDING.md) and [docs/TESTING.md](docs/TESTING.md).

The pull request template ([`.github/pull_request_template.md`](.github/pull_request_template.md)) asks for the same checks in writing: a test for every fix, `yarn verificar` green, new text in every language the repo requires, and a line in `ASSETS.md` for new media. A security problem never goes into a public issue: [SECURITY.md](SECURITY.md) has the private channel.

## Conduct

Treat others the way you would like to be treated: criticize the code, never the person. Harassment, insults and exposing someone's personal data remove the person from the project. To report, use the contact in [SECURITY.md](SECURITY.md).
