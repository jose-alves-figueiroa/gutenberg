# AGENTS.md — regras para agentes de código

Gutenberg é um app desktop (Electron + Vite + React + TypeScript) que substitui o Holyrics:
cadastra a liturgia, mantém a biblioteca (Bíblia ARA, salmos, HNC, credos, CFW, catecismos)
e envia telas limpas para o OBS via obs-websocket.

## Fontes de verdade
- **Especificação:** a proposta em vigor, indicada em `design/README.md` (propostas do Claude Design
  em `design/proposals/`, telas reais do app em `design/implemented/`). Protótipos (`*.dc.html`) são
  referência de comportamento — **não são código de produção**. O da v1
  (`design/proposals/v1/design/Gutenberg.dc.html`, classe `Component`) segue como oráculo do
  autobreak. Propostas entregues não são editadas; as decisões do operador ficam em `decisions.md`.
- **Histórico de versões:** `CHANGELOG.md` (formato descrito no topo do arquivo).
- **Plano e progresso:** `PLAN.md` (épicos) e `docs/DATA.md` → Progresso (tasks da E3). Legenda: `[ ]` a fazer · `[~]` em execução · `[x]` feito.
  - Marque `[~]` ao começar uma task e `[x]` só quando ela estiver pronta **e** com testes passando.
  - Não crie épicos/tasks novos sem registrar no `PLAN.md`.
- **Design:** tokens Broadsheet em `src/renderer/src/styles/tokens.css`. Alta fidelidade: não invente
  cores, tamanhos ou espaçamentos fora dos tokens.

## Estrutura
```
src/main/          processo principal do Electron
src/preload/       ponte contextBridge (contextIsolation ligado, sem nodeIntegration)
src/renderer/src/  React: components/, views/, styles/
src/shared/        lógica pura, sem Electron/DOM (autobreak, slides, collections, data-model, i18n) — usada por main e renderer
tests/             Vitest (+ Testing Library); fixtures em tests/fixtures/
scripts/           scripts de apoio (ex.: gerar fixtures golden)
design/            propostas do Claude Design (proposals/vN) e telas reais (implemented/<versão>), ver design/README.md
```

## Comandos
- `npm run dev` — app em modo desenvolvimento
- `npm test` — testes (Vitest)
- `npm run typecheck` — TypeScript sem emitir
- `npm run lint` — ESLint
- `npm run design:implemented` — telas reais do app em `design/implemented/<versão>/` para o Claude Design (fluxo na skill `.claude/skills/design-handoff`)
- `npm run design:check` — gera as telas em `tmp/` e falha se alguma rolar nas 4 resoluções (E16); rode antes de fechar mudanças de layout
- `npm run golden` — regenera `tests/fixtures/autobreak.golden.json` a partir do protótipo
- `npm run hymnal:fetch` / `holyrics:dump` / `translate:<source>` / `data:build` / `data:check` / `data:seed` / `data:unlock` / `data:key` — dados (E3, ver `docs/DATA.md`)

Antes de marcar qualquer task como `[x]` ou commitar: `npm test && npm run typecheck && npm run lint` verdes.

## Regras de código
- TypeScript estrito; nada de `any` sem justificativa em comentário.
- Lógica de domínio em `src/shared/` como funções puras e testadas.
- `autobreak` deve continuar idêntico ao protótipo — mudanças exigem atualizar o golden e justificar.
- Payload para o OBS: sem HTML, sem `&nbsp;`, no máximo 2 linhas por tela.
- App funciona **offline**: fontes e ícones empacotados localmente, nenhuma URL externa no CSS/HTML.
- **Tudo em inglês no código:** identificadores, tipos, chaves de schema/JSON, tabelas, nomes de arquivo,
  comentários, nomes de testes e mensagens de scripts. Textos que o usuário vê ficam em
  `src/shared/i18n/pt-BR.ts` (chaves em inglês) e são lidos com `t()` — nunca literais na UI.
  O conteúdo (Bíblia, hinos, símbolos de fé) continua em português.
- Coleções são documentos (hinário, confissão, catecismo) com `id`, título e prefixo: acrescentar uma
  nova (Harpa Cristã, Dort, Heidelberg) é dado, não código nem schema.
- Dados de conteúdo (ARA, músicas, símbolos de fé, credos) só em `data/canonical/`, no formato interno
  (`docs/DATA.md`; schema, chaves e nomes de arquivo em inglês) e **cifrados com git-crypt**. Nunca commitar esses textos em claro em outro lugar
  (fontes brutas ficam em `tmp/` e `data/sources/`, ignorados). Antes de commitar `data/`, conferir
  `git-crypt status`. Bancos `.sqlite` gerados não são versionados.
- Testes não dependem dos dados reais: usam fixtures sintéticas e o seed do protótipo.

## Commits
Formato [Conventional Commits](https://www.conventionalcommits.org/) com o épico no escopo:

```
<tipo>(<épico>): <resumo no imperativo, minúsculo, ≤ 72 caracteres>

<corpo opcional: o quê e por quê, em pt-BR, linhas ≤ 72>

<rodapé opcional: Refs/Co-Authored-By>
```

- **Tipos:** `feat`, `fix`, `test`, `refactor`, `style`, `docs`, `build`, `chore`.
- **Escopo:** o ID do épico do `PLAN.md` (`E0`, `E1`, `E2`…); use `repo` para mudanças gerais
  (gitignore, docs de agente).
- Exemplos:
  - `feat(E1): nav com as 4 abas e tokens Broadsheet`
  - `feat(E2): porta autobreak do protótipo com testes golden`
  - `docs(repo): adiciona AGENTS.md e regras de commit`
- **Ritmo:** um commit (ou poucos commits coesos) **por épico finalizado**, seguido de
  `git push origin main`. O commit do épico inclui o `PLAN.md` com as tasks marcadas `[x]`
  e o `CHANGELOG.md` atualizado.
- Não commitar com testes, typecheck ou lint quebrados. Não usar `--no-verify`, `--force`
  nem reescrever histórico já publicado.
- Remoto: `git@github.com:jose-alves-figueiroa/gutenberg.git` (SSH), branch `main`.

## Changelog
- **Todo commit** com `feat` ou `fix` (e qualquer outro que o operador perceba) acrescenta um item
  em `## [Não lançado]` do `CHANGELOG.md`, no mesmo commit, seguindo o formato do topo do arquivo.
- Ao gerar instaladores de uma versão nova: subir a versão do `package.json`, transformar
  `[Não lançado]` em `## [x.y.z] - AAAA-MM-DD` e abrir um `[Não lançado]` vazio acima. A seção
  vira as notas da versão no workflow manual **release** (`.github/workflows/release.yml`), que
  só o mantenedor dispara.
- Um teste (`tests/changelog.test.ts`) garante que a versão do `package.json` está no changelog.
