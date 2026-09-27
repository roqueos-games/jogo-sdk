Rotina de manutenção de um jogo da roqueos-games. Uma coisa por iteração, com a evidência no chat. Para na primeira que tiver trabalho.

1. **Gate vermelho.** `roqueos-gate` (o `yarn verificar`: lint, formato, testes e `jogo check`). Conserta e cola a saída.
2. **CI do GitHub vermelho.** `gh run list --limit 3`. O workflow `verificar` roda em todo push e em PR de fork, sem segredo; vermelho lá e verde aqui é ambiente divergente, e se investiga antes de qualquer outra coisa.
3. **Issue ou PR de fora sem resposta.** `gh issue list` e `gh pr list`. Quem contribui espera resposta; uma linha de "vi, olho até sexta" já conta.
4. **Asset sem origem.** O `jogo check` lê o `ASSETS.md`. Arquivo novo em `public/` sem linha, com origem e licença, não entra.
5. **SDK atrás.** O `package.json` pina o `jogo-sdk` por tag. Tag nova no SDK com capacidade que o jogo usa vira bump, com o `yarn verificar` verde e o changelog dizendo o que mudou.
6. **Drift de docs.** README, CONTRIBUTING e `jogo.json` dizem a mesma coisa sobre controles, recorde e idiomas.

Mudança visível no jogo não fecha sem o jogo aberto de verdade (`yarn dev`), com print antes de declarar pronto. Jogo com three.js só fecha com evidência no aparelho-alvo. Nunca enfraquece teste para o gate passar.
