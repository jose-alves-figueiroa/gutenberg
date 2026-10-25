# Design

O que o Claude Design propôs e o que o app de fato é, lado a lado.

**Proposta em vigor: [v1](proposals/v1/README.md).**

## Pastas

| Pasta | O que tem | Quem escreve |
| --- | --- | --- |
| `proposals/vN/` | Uma proposta do Claude Design. Não é editada depois de entregue: correções entram na próxima. | Claude Design |
| `proposals/vN/brief/` | O pedido que gerou a proposta: o que mudar, épicos do `PLAN.md`, restrições e a pasta de `implemented/` usada. | Nós |
| `proposals/vN/handoff/` | O que voltou do Claude Design (mesmo formato da v1). | Claude Design |
| `implemented/<versão>/` | O app real na versão do `package.json`, gerado por script: para cada tela, um HTML autocontido e um PNG por resolução, mais um `NOTES.md` com o que difere da proposta e onde a tela rola. | Script |

A v1 é anterior a esta estrutura: o pacote original está na raiz de `proposals/v1/` (`README.md`, `design/`, `reference/`), sem `brief/` nem `handoff/`.

## Fluxo

Passo a passo detalhado na skill `.claude/skills/design-handoff/SKILL.md`.

1. Gerar o real da versão atual em `implemented/<versão>/` com `npm run design:implemented` (só quando for enviar um pedido, não a cada versão).
2. Escrever `proposals/vN/brief/` apontando para essa pasta.
3. Enviar `brief/` e `implemented/<versão>/` ao Claude Design.
4. Guardar o retorno em `proposals/vN/handoff/` sem editar.
5. Aceita a proposta, atualizar a linha "Proposta em vigor" acima e registrar os épicos no `PLAN.md`.
