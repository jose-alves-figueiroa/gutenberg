# Gutenberg — Plano de implementação

Legenda: `[ ]` a fazer · `[~]` em execução · `[x]` feito
Fonte: `design_handoff_gutenberg/README.md` + protótipo `design/Gutenberg.dc.html` (classe `Component`).
Concluídos: E0–E3. Em execução: **E4 (Biblioteca)**.

## Stack e protocolo (decisão)
O OBS roda em outro computador da LAN e consome os dados do Gutenberg por **HTTP** — o protocolo já em uso (substitui o JSON do Holyrics). Isso substitui o obs-websocket sugerido no README do handoff.

- **Servidor HTTP** no processo principal do Electron (PC do operador): **Hono** (`@hono/node-server`) + **zod** (`@hono/zod-validator`). Um servidor, duas classes de rota:
  - **Públicas na LAN (OBS):** `GET /overlay` (página da Browser Source, servida pelo Gutenberg), `GET /api/v1/current` (tela atual, payload v1), `GET /api/v1/events` (o mesmo payload por Server-Sent Events), `GET /api/v1/health` (latência/estado)
  - **Só locais** (`127.0.0.1`; recusadas vindas da LAN): biblioteca (leitura/edição), liturgias, comandos de apresentação
- **Payload v1** (README → "Payload"): `{ v, seq, type, header, lines, meta }`, schema zod único em `src/shared`; sem HTML, até 2 linhas
- **Renderer:** React + cliente tipado do Hono (`hono/client`) + **TanStack Query**; a UI usa a mesma API HTTP via `localhost` (sem IPC próprio)
- **Banco:** SQLite via `node:sqlite` (Node 24 do Electron 44), repositório em `src/main/library/`
- **Rede:** o OBS aponta a Browser Source para `http://<ip-do-operador>:<porta>/overlay`; IP e porta exibidos na aba Conexão (porta configurável); regra de firewall do Windows criada no instalador (E8)

## E0 — Planejamento
- [x] Ler o handoff (README, protótipo, styles.css, payload do Holyrics)
- [x] Criar este PLAN.md
- [x] `AGENTS.md` (regras para agentes + estrutura de commits) e `CLAUDE.md`
- [x] `.gitignore`
- [x] Repositório git com remoto `git@github.com:jose-alves-figueiroa/gutenberg.git`
- [x] Convenção: código, schemas, comentários e testes em inglês; textos da UI via i18n (`src/shared/i18n`, pt-BR)

## E1 — Base do app (Fase 1)
**US1.1** Como desenvolvedor, quero um projeto Electron + Vite + React + TS rodando, para ter onde construir o app.
- [x] Scaffold com `electron-vite` (main / preload / renderer) na raiz
- [x] Scripts `dev`, `build`, `test`, `typecheck`, `lint`
- [x] Vitest configurado (ambiente `node` para lógica, `jsdom` para componentes) + Testing Library
- [x] Janela 1280×820 (mín. 900 para permitir o empilhamento abaixo de 1100px); `contextIsolation` ligado, sem `nodeIntegration`

**US1.2** Como operador, quero o visual Broadsheet funcionando offline, para o app ficar igual ao design sem internet.
- [x] Portar tokens de `design/_ds/.../styles.css` para `src/renderer/src/styles/tokens.css` (cores, espaçamento, raio, sombra, tipografia)
- [x] Portar classes de componente (`.btn` primário/secundário/ghost/ícone, `.input`, `.field`, `.tag`, `.seg`, `.nav`)
- [x] Remover o `@import` do Google Fonts; empacotar Source Serif 4 (400, 600, 400 itálico) via `@fontsource/source-serif-4`
- [x] Estados globais: hover `--color-accent-100`, foco `outline 2px accent / offset 2px`, desabilitado 45% opacidade
- [x] Teste: CSS não referencia URLs externas (fontes/ícones locais)

**US1.3** Como operador, quero a nav sempre visível com as 4 abas, para navegar entre as rotinas.
- [x] Componente `Nav`: marca "Gutenberg" (22px/600, tracking −0.02em)
- [x] Abas Liturgia · Biblioteca · Apresentar · Conexão, ícone Phosphor duotone 18px + texto 15px, padding 8×12; ativa com `color-mix(accent 12%)` e texto `--color-accent-700`
- [x] Campo de busca rápida (placeholder, sem lógica): flex `1 1 280px`, máx. 440px, fundo surface, borda divider
- [x] Indicador de conexão (bolinha 9px + rótulo + "192.168.0.12 · 18 ms", estado estático); clique abre a aba Conexão
- [x] 4 views vazias (`LiturgyView`, `LibraryView`, `PresentView`, `ConnectionView`) com kicker/título
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
- [x] `src/shared/slides.ts`: `slidesOf(entry, max)` → `{ header, lines[] }` (porte de `slidesOf` do protótipo)
- [x] Bíblia: `Hebreus 12.15` + ` (i/n)` quando o versículo ocupa várias telas
- [x] CFW: `CFW 1.1`
- [x] Catecismo: `Breve Catecismo · P. 1 · pergunta` / `Breve Catecismo · P. 1` na resposta
- [x] Credo: nome do credo
- [x] Salmos/HNC: sem autobreak; cada estrofe em telas de 2 versos (E3); cabeçalho `Salmo 133B`
- [x] Testes de cabeçalho para cada coleção, incluindo Hb 12.15 com `(1/n)…(n/n)`

## Backlog (fases futuras)
### E3 — Dados (Fase 2) ✓
**Requisito funcional:** o app sai com a Bíblia ARA completa, o Saltério de Genebra e o Hinário Novo Cântico completos, os símbolos de fé de Westminster (CFW na edição da IP Aliança, Breve, Maior) e os 3 credos.
Tasks detalhadas, schemas (em inglês) e fontes: **`docs/DATA.md` → Progresso**. Aqui só o status das user stories.
- [x] US3.0 Dados versionados e cifrados (git-crypt + chave por senha, com backup)
- [x] US3.1 Formato interno, validadores, limpeza (`clean.ts`), `data:build`, `data:check`, seed
- [x] US3.2 Bíblia ARA (`translate:bible`): 66 livros, 31.104 versículos
- [x] US3.3 Saltério de Genebra (173 títulos, CC0) e HNC (404 hinos), com créditos e telas de 2 versos; API do Holyrics fica opcional para "Outros cânticos"
- [x] US3.4 Símbolos de Westminster: CFW (35 caps., edição da IP Aliança), Breve (107), Maior (196, com complemento da IP Bom Pastor)
- [x] US3.5 Credos Apostólico, Niceno e de Atanásio (`translate:creeds`)

### E4 — Biblioteca (Fase 4)
Especificação: README → "Biblioteca" e protótipo (`Component.render`, ramo `libCol`). Os dados vêm do banco gerado na E3.

**US4.1** Como operador, quero que o app abra a biblioteca do banco local, para usar os dados da E3.
- [x] `src/main/db/open.ts`: banco em `userData`; na 1ª execução copia o banco empacotado (dev: `data/build/gutenberg.sqlite`); migra; `node:sqlite` (validado no Electron 44)
- [x] `src/main/library/repository.ts`: consultas e gravações sobre `SqlDatabase` (coleções na ordem do menu, Bíblia, confissões com inserção ordenada de seções, catecismos, hinários, credos); testes sobre o banco do seed

**US4.2** Como desenvolvedor, quero a API HTTP local da biblioteca, para a UI e o OBS usarem o mesmo servidor.
- [x] Servidor Hono no main (`src/main/server/`): sobe com o app em `0.0.0.0`, porta em `settings.http_port` (padrão 8484); middleware `localOnly` (loopback) — conferido no app real: LAN recebe 403
- [x] Rotas `/api/v1/library/*` (só locais) sobre o repositório, com validação zod (`src/shared/library-schemas.ts`, tipos inferidos dos schemas); 400 para entrada inválida, 404 para registro ausente
- [x] Ponte IPC provisória removida; o preload só expõe `serverUrl`
- [x] Renderer: `ApiProvider` (cliente `hono/client` tipado pelo `AppType` do servidor + `QueryClientProvider`); CSP `connect-src` para `http://127.0.0.1:*`
- [x] Testes: rotas via `app.request()` sobre o banco do seed; recusa de chamadas da LAN e sem origem conhecida

**US4.3** Como operador, quero navegar pelas coleções, para achar qualquer texto.
- [x] Coluna esquerda: coleções nos 3 grupos (Bíblia no topo) com contagem; selecionada em accent (como no protótipo); rótulos do menu do protótipo para os documentos conhecidos ("Confissão de Westminster", "Breve Catecismo"), título do banco para os demais
- [x] Breadcrumb clicável, título h2 32px e dica 14px (`views/library/parts.tsx`)

**US4.4** Bíblia (somente leitura)
- [x] Livros em grade (AT/NT) → capítulos (grade de números) → versículos (lista) — conferido no app com a ARA completa
- [x] Seleção de trecho: 1º clique e último versículo; destaque `--color-accent-200`; dicas do protótipo; cliques rápidos consistentes (atualização funcional)

**US4.5** Confissões
- [ ] Capítulos (lista com título e "k de N seções") → seções (grade) → editor (texto corrido)

**US4.6** Catecismos
- [ ] Grade de perguntas (1–107 / 1–196) → editor (pergunta + resposta)

**US4.7** Hinários e credos
- [ ] Saltério: grade 1–150 → versões/partes → editor (nº, versão, versificação, letra por estrofes); "Nova versão"
- [ ] HNC (e demais hinários) e credos: lista → editor; "Novo hino" / "Novo credo"

**US4.8** Estados cadastrado / não cadastrado
- [ ] Grades: cadastrado em `--color-surface`; não cadastrado transparente e `--color-neutral-600`; clicar cria o registro vazio e abre o editor

**US4.9** Folha do item
- [ ] Prévia "Como fica na transmissão · N telas" (cartões `minmax(210px,1fr)` com `slidesOf`)
- [ ] Barra sticky: Apresentar agora / Adicionar à liturgia (habilitados nas E5/E6), Descartar / Salvar (desabilitados sem alterações), "Salvo — vale para todas as liturgias"

### E5 — Liturgia (Fase 5)
- [ ] CRUD de cultos
- [ ] Linhas com Momento editável, ↑ ↓ ✕
- [ ] Picker agrupado por coleção + busca + atalho de referência bíblica

### E6 — Apresentar e busca rápida (Fase 6)
- [ ] Lista de itens, item "Avulso", cartões NO AR / A SEGUIR
- [ ] Anterior/Próximo com passagem entre itens; Limpar tela / Mostrar texto
- [ ] Busca rápida: livros, tag de livro, capítulo.versículo, prefixos `bc cm cfw sg hnc credo`
- [ ] Estado de apresentação persistido em disco

### E7 — Conexão com o OBS por HTTP (Fase 7)
**US7.1** Como operador, quero que o OBS mostre a tela atual, para a transmissão acompanhar a apresentação.
- [ ] Schema zod do payload v1 (`src/shared/payload.ts`) gerado a partir de `slidesOf`; `type: CLEAR` para "Limpar tela"; `seq` crescente persistido com o estado de apresentação
- [ ] `GET /api/v1/current` (JSON) e `GET /api/v1/events` (SSE: envia o estado atual ao conectar e a cada mudança; heartbeat)
- [ ] `GET /overlay`: HTML estático da Browser Source — conecta ao SSE, cai para polling de `/current` se o SSE falhar, ignora `seq` menor que o último, **mantém o último texto se a rede cair**; estilo (fonte, cor, posição) no overlay/OBS
- [ ] Ao reconectar, o overlay recebe o estado atual (último `seq`) — sem reenvio manual

**US7.2** Como operador, quero ver o estado da conexão com o OBS, para agir se a rede falhar.
- [ ] Rastrear clientes do overlay (SSE conectados, último acesso, latência via `GET /api/v1/health` chamado pelo overlay a cada 2 s)
- [ ] Estados: conectado / instável (> 500 ms) / sem resposta (3 falhas seguidas); alimentam o indicador da nav
- [ ] Aba Conexão: IP do operador e URL do overlay exibidos (copiar), porta editável (só números, até 5 dígitos), Reconectar/Testar, registro de eventos com hora

### E8 — Empacotamento (Fase 8)
- [ ] `electron-builder` para Windows, com o banco (`data:build`) como recurso
- [ ] Regra de firewall do Windows para a porta do servidor HTTP (instalador)
- [ ] Guia de configuração do OBS: Browser Source com a URL do overlay exibida na aba Conexão
