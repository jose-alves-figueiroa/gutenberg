# CLAUDE.md

As regras do projeto (estrutura, comandos, código e commits) estão em `AGENTS.md`:

@AGENTS.md

## Notas para o Claude Code
- Comece cada sessão lendo `PLAN.md` para saber o que está `[~]` em execução.
- A cada commit que o operador perceba (`feat`, `fix`…), acrescente o item em
  `## [Não lançado]` do `CHANGELOG.md` (ver `AGENTS.md` → Changelog).
- Ao terminar um épico: atualize o `PLAN.md` e o `CHANGELOG.md`, rode `npm test && npm run typecheck && npm run lint`,
  faça o commit no formato de `AGENTS.md` e `git push origin main`.
- Termine as mensagens de commit com:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
