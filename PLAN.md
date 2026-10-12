# Gutenberg — Plano de implementação

Legenda: `[ ]` a fazer · `[~]` em execução · `[x]` feito
Fonte: `design_handoff_gutenberg/README.md` + protótipo `design/Gutenberg.dc.html` (classe `Component`).
Escopo atual: **Fase 1 (Base)** e **Fase 3 (Quebra de telas)**. As demais fases ficam no backlog.

## E0 — Planejamento
- [x] Ler o handoff (README, protótipo, styles.css, payload do Holyrics)
- [x] Criar este PLAN.md
- [x] `AGENTS.md` (regras para agentes + estrutura de commits) e `CLAUDE.md`
- [x] `.gitignore`
- [x] Repositório git com remoto `git@github.com:jose-alves-figueiroa/gutenberg.git`

## E1 — Base do app (Fase 1)
**US1.1** Como desenvolvedor, quero um projeto Electron + Vite + React + TS rodando, para ter onde construir o app.
- [x] Scaffold com `electron-vite` (main / preload / renderer) na raiz
- [x] Scripts `dev`, `build`, `test`, `typecheck`, `lint`
- [x] Vitest configurado (ambiente `node` para lógica, `jsdom` para componentes) + Testing Library
- [x] Janela 1280×820 (mín. 900 para permitir o empilhamento abaixo de 1100px); `contextIsolation` ligado, sem `nodeIntegration`

**US1.2** Como operador, quero o visual Broadsheet funcionando offline, para o app ficar igual ao design sem internet.
- [x] Portar tokens de `design/_ds/.../styles.css` para `src/renderer/styles/tokens.css` (cores, espaçamento, raio, sombra, tipografia)
- [x] Portar classes de componente (`.btn` primário/secundário/ghost/ícone, `.input`, `.field`, `.tag`, `.seg`, `.nav`)
- [x] Remover o `@import` do Google Fonts; empacotar Source Serif 4 (400, 600, 400 itálico) via `@fontsource/source-serif-4`
- [x] Estados globais: hover `--color-accent-100`, foco `outline 2px accent / offset 2px`, desabilitado 45% opacidade
- [x] Teste: CSS não referencia URLs externas (fontes/ícones locais)

**US1.3** Como operador, quero a nav sempre visível com as 4 abas, para navegar entre as rotinas.
- [x] Componente `Nav`: marca "Gutenberg" (22px/600, tracking −0.02em)
- [x] Abas Liturgia · Biblioteca · Apresentar · Conexão, ícone Phosphor duotone 18px + texto 15px, padding 8×12; ativa com `color-mix(accent 12%)` e texto `--color-accent-700`
- [x] Campo de busca rápida (placeholder, sem lógica): flex `1 1 280px`, máx. 440px, fundo surface, borda divider
- [x] Indicador de conexão (bolinha 9px + rótulo + "192.168.0.12 · 18 ms", estado estático); clique abre a aba Conexão
- [x] 4 views vazias (`LiturgiaView`, `BibliotecaView`, `ApresentarView`, `ConexaoView`) com kicker/título
- [x] Layout empilha colunas abaixo de 1100px
- [x] Testes (RTL): renderiza as 4 abas; clicar troca a view e marca a aba ativa (`aria-current`/`aria-selected`); clicar no status abre Conexão

## E2 — Quebra de telas (Fase 3)
**US3.1** Como operador, quero que textos longos sejam divididos em telas de 2 linhas legíveis, para a CFW e os catecismos não quebrarem mal no OBS.
- [x] `src/shared/autobreak.ts`: porte fiel de `split`, `wordChunks`, `twoLines`, `autobreak` do protótipo (linhas 431–457)
- [x] Limite padrão 96, validado/clampado em 60–160 (`DEFAULT_MAX`, `MIN_MAX`, `MAX_MAX`), exposto como configuração
- [x] Fixtures "golden": rodar o `autobreak` original do protótipo em Node para gerar a saída esperada de CFW 1.1, Hb 12.14, Hb 12.15 e BC P.1 nos limites 60, 72, 96, 128, 160 (+ casos sintéticos de borda) → `tests/fixtures/autobreak.golden.json`
- [x] Testes de paridade: saída do TS === golden, e fuzz de 500 textos contra o `autobreak` do protótipo
- [x] Testes por regra:
  - [x] linha em branco força quebra
  - [x] segmento ≤ limite vira 1 tela
  - [x] segmento > limite divide em frases nas pausas `, ; : . ! ?`
  - [x] frase > limite vira pedaços equilibrados por palavra
  - [x] frases agrupadas em ordem até o limite
  - [x] última tela < 30% junta com a anterior se couber em 120%
  - [x] 2 linhas equilibradas, preferindo após `, ; :`; sem quebra se ≤ 55% do limite
  - [x] nenhuma tela tem mais de 2 linhas; nenhuma linha contém HTML
  - [x] texto vazio/nulo → `[]`

**US3.2** Como operador, quero cabeçalhos corretos em cada tela, para o OBS mostrar a referência certa.
- [x] `src/shared/slides.ts`: `slidesOf(collection, item, max)` → `{ header, lines[] }` (porte de `slidesOf` do protótipo)
- [x] Bíblia: `Hebreus 12.15` + ` (i/n)` quando o versículo ocupa várias telas
- [x] CFW: `CFW 1.1`
- [x] Catecismo: `Breve Catecismo · P. 1 · pergunta` / `Breve Catecismo · P. 1` na resposta
- [x] Credo: nome do credo
- [x] Salmos/HNC: sem autobreak, 1 estrofe = 1 tela; cabeçalho `Salmo 133B`
- [x] Testes de cabeçalho para cada coleção, incluindo Hb 12.15 com `(1/n)…(n/n)`

## Backlog (fases futuras)
### E3 — Dados (Fase 2)
**Requisito funcional:** o app sai com a Bíblia ARA completa, as 246 músicas do Holyrics, os símbolos de fé de Westminster (CFW, Breve, Maior) e os 3 credos. Arquitetura, formato interno e fontes: `docs/DADOS.md`.

**US3.0** Como mantenedor, quero os dados versionados e cifrados, para o repositório público não expor os textos.
- [x] git-crypt: `init`, `.gitattributes` (`data/canonical/**`), chave exportada, cifrada com `GUTENBERG_DATA_PASSWORD` em `.secrets/` (ignorado); `npm run data:key` / `data:unlock` (também no `prebuild`)
- [x] Verificação: teste `tests/gitcrypt.test.ts` falha se algum arquivo de `data/canonical/` estiver em claro no git (o aviso de repo trancado fica no `data:check`, US3.1)

**US3.1** Como desenvolvedor, quero um formato interno próprio, para não depender do esquema de nenhuma fonte.
- [ ] `src/shared/data-model.ts`: tipos + validadores (livro da Bíblia, música, CFW, catecismo, credos), `formato: 1`
- [ ] `src/shared/clean.ts`: remove `<ctt>`, `<desc>`, `<span>`, `&nbsp;`, `(RA)`; junta quebras simples de texto corrido; testes com o payload real do Holyrics
- [ ] `npm run data:build`: `data/canonical/` → SQLite do app (schema do README + `refs`, créditos, `origem`); migrações
- [ ] `npm run data:check`: completude (66 livros, 246 músicas, 33 caps. da CFW, 107 + 196 perguntas, 3 credos); avisa quando o repo está trancado (`\0GITCRYPT`)
- [ ] Seed do protótipo para desenvolvimento/testes
- [ ] Limite de caracteres por tela persistido como configuração

**US3.2** Bíblia ARA
- [ ] `translate:biblia`: OpenLP SQLite → `data/canonical/biblia/ara/` (testes com fixture OpenLP sintética)
- [ ] Traduzir o `ARA.sqlite` e conferir (Hb 12.14–15 igual ao protótipo)

**US3.3** Músicas do Holyrics (salmos, HNC e demais) com créditos
- [ ] Investigar (só leitura) o formato da tabela `music` de `database.db`
- [ ] `translate:musicas`: decifra só `music` (chave em `HOLYRICS_DB_KEY`, fora do git) → `data/canonical/musicas/`
- [ ] Classificar salmo × hino; estrofes limpas; créditos (autor, artista, copyright)
- [ ] Testes com registro sintético cifrado com chave de teste
- [ ] Plano B (se necessário): API local do Holyrics (`GetSongs`/`GetLyrics`)

**US3.4** Símbolos de fé de Westminster
- [ ] `translate:cfw`: página da IP Aliança → `westminster/cfw.json`; valida 33 capítulos e seções
- [ ] `translate:breve`: gist JSON → `westminster/breve.json`; numera pela posição (item 81 defeituoso); valida 1–107
- [ ] `translate:maior`: PDF da IPB → `westminster/maior.json`; valida 1–196; revisão manual

**US3.5** Credos
- [ ] `translate:credos`: texto revisado à mão → `credos.json` com Apostólico, Niceno e Atanasiano

### E4 — Biblioteca (Fase 4)
- [ ] Coleções em 3 grupos (Bíblia no topo) + breadcrumb
- [ ] Bíblia: Livro (AT/NT) → Capítulo → Versículos, seleção de trecho, somente leitura
- [ ] CFW: Capítulo → Seção → Editor
- [ ] Catecismos: grid de perguntas → Editor
- [ ] Salmos: grid 1–150 → Versões → Editor
- [ ] HNC e Credos: lista → Editor
- [ ] Estados cadastrado/não cadastrado; clicar em não cadastrado cria registro
- [ ] Prévia "Como fica na transmissão" + barra sticky (Apresentar agora, Adicionar, Descartar/Salvar)

### E5 — Liturgia (Fase 5)
- [ ] CRUD de cultos
- [ ] Linhas com Momento editável, ↑ ↓ ✕
- [ ] Picker agrupado por coleção + busca + atalho de referência bíblica

### E6 — Apresentar e busca rápida (Fase 6)
- [ ] Lista de itens, item "Avulso", cartões NO AR / A SEGUIR
- [ ] Anterior/Próximo com passagem entre itens; Limpar tela / Mostrar texto
- [ ] Busca rápida: livros, tag de livro, capítulo.versículo, prefixos `bc cm cfw sg hnc credo`
- [ ] Estado de apresentação persistido em disco

### E7 — Conexão (Fase 7)
- [ ] Cliente `obs-websocket-js` v5, `BroadcastCustomEvent` com payload v1
- [ ] Ping 2 s, estados ok/instável/sem resposta, backoff 1/2/4/8 s, reenvio do último `seq`
- [ ] `overlay.html` para o OBS (ignora `seq` menor)
- [ ] Aba Conexão (IP só exibido, porta editável, Reconectar/Testar, registro de eventos)
- [ ] Descoberta do IP (mDNS/UDP ou arquivo de config)

### E8 — Empacotamento (Fase 8)
- [ ] `electron-builder` para Windows
- [ ] Instalação do overlay no PC do OBS
