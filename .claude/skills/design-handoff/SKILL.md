---
name: design-handoff
description: Ciclo de design com o Claude Design no Gutenberg. Use para preparar um pedido novo (gerar as telas reais em design/implemented/<versão> e escrever design/proposals/vN/brief) ou para receber uma proposta de volta (guardar em proposals/vN/handoff e registrar no PLAN.md). Gatilhos: "pedido de design", "brief", "handoff", "mandar para o Claude Design", "telas implementadas", "nova proposta".
---

# Ciclo de design (Claude Design ↔ Gutenberg)

A estrutura e as regras estão em `design/README.md`. Leia antes. Resumo:
`design/proposals/vN/` (brief + handoff; o handoff nunca é editado) e
`design/implemented/<versão>/` (gerado por script, uma pasta por pedido).

Os pedidos de design **não** iniciam trabalho no `PLAN.md`: épicos citados no brief continuam
`[ ]` até a proposta voltar e ser aceita.

## A. Preparar um pedido

1. **Número da proposta:** `N` = maior `design/proposals/v*` + 1. Versão do app: `version` do
   `package.json`.
2. **Telas reais:** com o Gutenberg fechado (porta 8484 livre), rode `npm run design:implemented`.
   - Se uma tela nova surgiu desde o último pedido, acrescente-a em `SCREENS`
     (`scripts/design-implemented.mjs`); cada entrada abre a tela a partir da aba, por papel e nome
     acessível (textos do `src/shared/i18n/pt-BR.ts`).
   - As resoluções ficam em `RESOLUTIONS` e seguem o `PLAN.md` (E16).
   - Se falhar num seletor, abra o `.png` da última tela gerada para ver o estado.
3. **Conferir a saída:** `.png` com o tamanho exato da resolução (`sips -g pixelWidth`), `.html` sem
   `<script>` e sem `file://`, fontes em `assets/`.
4. **`design/implemented/<versão>/NOTES.md`** (modelo: `design/implemented/0.2.3/NOTES.md`):
   - tabela de telas (arquivo → o que mostra);
   - tabela "Onde a página rola" montada do `scroll.json` (`page`, `pageX`, `boxes`), com "—" para 0;
   - diferenças em relação à proposta em vigor (`design/README.md`), tiradas do `PLAN.md` e do
     `CHANGELOG.md` desde a proposta. Só o que a tela mostra; nada de detalhe de código.
5. **`design/proposals/vN/brief/`** (modelo: `design/proposals/v2/brief/`):
   - `BRIEF.md`: o que recebe, o que pedimos (um item por épico ou ajuste, com o problema visto
     pelo operador), restrições do `AGENTS.md` que afetam o design, o que devolver;
   - `epics.md`: os épicos do `PLAN.md` envolvidos, copiados com o commit de origem;
   - `tokens.css`: cópia de `src/renderer/src/styles/tokens.css`.
6. **Commit e push** (sem changelog, o operador não vê):
   `docs(repo): pedido de design vN e telas implementadas <versão>`. Antes:
   `npm test && npm run typecheck && npm run lint`.
7. Diga ao operador o que enviar: `design/proposals/vN/brief/`, `design/implemented/<versão>/`
   e `design/proposals/<em vigor>/`.

## B. Receber a proposta

1. Peça o retorno como pacote (zip no formato da v1: `README.md` + `design/`). Extraia para `design/proposals/vN/handoff/` **sem editar nada** e apague o zip (não fica no repositório). Um link de artefato sozinho vem empacotado e sem README: peça o zip.
2. Compare com o brief: cada item pedido tem resposta? As restrições foram respeitadas (tokens,
   sem rolagem nas resoluções, 2 linhas no OBS, pt-BR sem travessão)? Liste as lacunas para o
   operador antes de aceitar.
3. Aceita: atualize "Proposta em vigor" em `design/README.md`, ajuste os épicos no `PLAN.md`
   (critérios vindos da proposta; tire o ⛔ dos que dependiam dela) e faça o commit
   `docs(repo): recebe a proposta de design vN`.
