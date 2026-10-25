# Design

O que o Claude Design propôs e o que o app de fato é, lado a lado.

**Proposta em vigor: [v1](proposals/v1/README.md).**

## Propostas

| Proposta | Pedido | Retorno | Estado |
| --- | --- | --- | --- |
| [v1](proposals/v1/README.md) | (anterior a esta estrutura) | `proposals/v1/` | Em vigor; implementada até a 0.2.3 |
| [v2](proposals/v2/handoff/README.md) | [brief](proposals/v2/brief/BRIEF.md), app [0.2.3](implemented/0.2.3/NOTES.md) | `proposals/v2/handoff/`, recebido em 2026-10-25 | Recebida; aguarda aceite (ver "Em aberto" no README dela) |

Para abrir um protótipo, sirva a pasta `design/` dele por HTTP (`npx serve proposals/v2/handoff/design`)
e abra o `.dc.html` principal.

## Pastas

| Pasta | O que tem | Quem escreve |
| --- | --- | --- |
| `proposals/vN/` | Uma proposta do Claude Design. Não é editada depois de entregue: correções entram na próxima. | Claude Design |
| `proposals/vN/brief/` | O pedido que gerou a proposta: o que mudar, épicos do `PLAN.md`, restrições e a pasta de `implemented/` usada. | Nós |
| `proposals/vN/handoff/` | O que voltou do Claude Design, como veio: `README.md` (especificação, "O que muda" e "Decisões e dúvidas") e `design/` (protótipos `.dc.html`, `support.js`, `_ds/`), o mesmo formato da v1. | Claude Design |
| `implemented/<versão>/` | O app real na versão do `package.json`, gerado por script: para cada tela, um HTML autocontido e um PNG por resolução, mais um `NOTES.md` com o que difere da proposta e onde a tela rola. | Script |

A v1 é anterior a esta estrutura: o pacote original está na raiz de `proposals/v1/` (`README.md`, `design/`, `reference/`), sem `brief/` nem `handoff/`.

## Fluxo

Passo a passo detalhado na skill `.claude/skills/design-handoff/SKILL.md`.

1. Gerar o real da versão atual em `implemented/<versão>/` com `npm run design:implemented` (só quando for enviar um pedido, não a cada versão).
2. Escrever `proposals/vN/brief/` apontando para essa pasta.
3. Enviar `brief/` e `implemented/<versão>/` ao Claude Design.
4. Pedir o retorno como pacote (zip no formato da v1) e guardá-lo em `proposals/vN/handoff/` sem editar; o zip não fica no repositório.
5. Aceita a proposta, atualizar a linha "Proposta em vigor" acima e registrar os épicos no `PLAN.md`.
