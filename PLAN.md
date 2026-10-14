# Gutenberg — Plano de implementação

Legenda: `[ ]` a fazer · `[~]` em execução · `[x]` feito
Fonte: `design_handoff_gutenberg/README.md` + protótipo `design/Gutenberg.dc.html` (classe `Component`).
Concluídos: E0–E11. Pendente: **US8.4** e **US10.4** (validação em campo). Pendente: **US8.4** (validar os instaladores em Windows/Ubuntu reais).

## Stack e protocolo (decisão)
O OBS roda em outro computador da LAN e consome os dados do Gutenberg por **HTTP** — o protocolo já em uso (substitui o JSON do Holyrics). Isso substitui o obs-websocket sugerido no README do handoff.

- **Servidor HTTP** no processo principal do Electron (PC do operador): **Hono** (`@hono/node-server`) + **zod** (`@hono/zod-validator`). Um servidor, duas classes de rota:
  - **Públicas na LAN (OBS):** sob `/overlay`, por **saída** (ver E7 → Saídas): `GET /overlay/<saída>` (página da Browser Source, servida pelo Gutenberg), `GET /overlay/resources/<saída>` (tela atual, payload v1), `GET /overlay/resources/<saída>/events` (o mesmo payload por Server-Sent Events); sem saída (`/overlay`, `/overlay/resources`, `/overlay/resources/events`) = tudo; `GET /api/v1/health` (latência/estado)
  - **Só locais** (`127.0.0.1`; recusadas vindas da LAN): biblioteca (leitura/edição), liturgias, comandos de apresentação
- **Payload** compatível com o JSON que o Holyrics envia hoje (`{ "map": { … } }`, ver E7 e `design_handoff_gutenberg/reference/holyrics-payload-exemplo.json.txt`), com texto **limpo** (sem HTML) e campos extras `seq`/`lines`; schema zod único em `src/shared`
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

### E4 — Biblioteca (Fase 4) ✓
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
- [x] Capítulos (lista com título e "k de N seções") → seções (grade, rótulos não numéricos como `R1` incluídos) → editor (texto corrido)

**US4.6** Catecismos
- [x] Grade de perguntas (1–107 / 1–196) → editor (pergunta + resposta)

**US4.7** Hinários e credos
- [x] Saltério: grade 1–150 → versões/partes → editor (nº, versão, versificação, letra por estrofes); "Nova versão" (próxima letra livre); cânticos sem número listados abaixo da grade
- [x] HNC (e demais hinários) e credos: lista → editor; "Novo hino". Sem "Novo credo": os 3 credos são fixos (`apostles`, `nicene`, `athanasian`)

**US4.8** Estados cadastrado / não cadastrado
- [x] Grades: cadastrado em `--color-surface`; não cadastrado transparente e `--color-neutral-600`; clicar abre o editor vazio e o registro é criado **ao Salvar** (desvio consciente do protótipo, que gravava um registro vazio no clique)

**US4.9** Folha do item
- [x] Prévia "Como fica na transmissão · N telas" (cartões `minmax(210px,1fr)` com `slidesOf`, limite de `settings.screen_char_limit`), inclusive para o trecho bíblico selecionado
- [x] Barra sticky: Apresentar agora / Adicionar à liturgia (desabilitados até as E5/E6), Descartar / Salvar (desabilitados sem alterações), "Alterações não salvas" / "Salvo — vale para todas as liturgias"

### E5 — Liturgia (Fase 5) ✓
Especificação: README → "Liturgia" e protótipo (ramo `isLit`, `addToCulto`, `pickList`).

**US5.1** Como operador, quero itens de liturgia com referência estável, para editar a biblioteca e valer em todas as liturgias.
- [x] `src/shared/bible-ref.ts`: busca de livros (abreviação ou nome, sem acento: `1` → 1Sm…1Jo, `1c` → 1Cr, 1Co), parser de referência (`hb 12`, `hb 12.14`, `hb 12.14-15`, também `:`), `item_ref` (`Hb:12:14-15`) e título (`Hebreus 12.14–15`); paridade com o protótipo, exceto `jo` → **João** (o protótipo dava Jó; a abreviação digitada exatamente tem prioridade, `jó` → Jó)
- [x] `collection` + `item_ref`: `bible:ara` / `Hb:12:14-15`; `songbook:<id>` / id da música; `confession:<id>` / `1.1`; `catechism:<id>` / número; `creeds` / id (validado por zod)
- [x] Resolver no main (`src/main/library/items.ts`, rota `/api/v1/library/resolve`): título, rótulo da coleção e telas (`slidesOf` com o limite salvo) de qualquer item; item inexistente aparece como "(item removido)"

**US5.2** Como operador, quero cadastrar e organizar cultos, para preparar a liturgia antes do culto.
- [x] Repositório e rotas locais `/api/v1/liturgy/*`: cultos (listar com nº de itens, criar, renomear, excluir) e itens (incluir no fim, editar momento, mover ↑/↓, remover, renumerando posições)
- [x] Coluna esquerda: cultos (nome + "N itens", selecionado em tint de accent), "+ Novo culto"; culto atual compartilhado pelo app (`ServiceProvider`)
- [x] Cabeçalho: kicker "LITURGIA", nome do culto em h2 34px (editável, salva no Enter/blur), "Excluir culto" (com confirmação), "Apresentar este culto" (habilitado na E6)
- [x] Linhas `28px | minmax(110px,180px) | 1fr | auto`: nº, Momento (input transparente, salva no Enter/blur), título + "coleção · N telas", ↑ ↓ ✕ (↑ do primeiro e ↓ do último desabilitados)

**US5.3** Como operador, quero adicionar itens por coleção ou referência, para montar a liturgia rápido.
- [x] Busca por coleção (`/api/v1/library/search`): número ou título (hinários), número ou texto da pergunta (catecismos), `1.1` ou texto (confissões), título (credos)
- [x] Picker: chips agrupados Bíblia | Hinário e salmos | Doutrina; campo de busca com placeholder por tipo; resultados em grade `auto-fill minmax(240px,1fr)`
- [x] Bíblia no picker: digitando um livro, lista os livros (clicar completa `Hb `); referência completa mostra "Adicionar Hebreus 12.14–15"
- [x] "Adicionar à liturgia" na Biblioteca (E4) adiciona o item ao culto atual ("Adicionado a {culto}"); desabilitado sem culto ou com alterações não salvas

### E6 — Apresentar e busca rápida (Fase 6) ✓
Especificação: README → "Apresentar" e "Busca rápida"; protótipo (`goLive`, `step`, `present`, `dropAdhoc`, `suggestions`).

**US6.1** Como operador, quero que o estado da apresentação viva no processo principal, para sobreviver a um reinício e alimentar o OBS (E7).
- [x] `src/shared/presentation.ts` (puro): estado `{ serviceId, adhoc, live, slide, blank, seq }` e comandos `service`, `go`, `step` (passa entre itens: próximo item tela 1, item anterior última tela), `blank`, `adhoc`, `dropAdhoc`; índices limitados quando a liturgia muda; `seq` sobe a cada comando
- [x] Main: estado persistido em disco (`settings.presentation_state`), sequência = Avulso (no topo, se houver) + itens do culto resolvidos; sem culto escolhido, usa o primeiro
- [x] Rotas locais `GET /api/v1/present` (culto, itens com telas, tela no ar) e `POST /api/v1/present/command` (zod)

**US6.2** Como operador, quero a tela Apresentar, para conduzir o culto.
- [x] Lista de itens (Momento, título, coleção, "no ar"; item vê-se clicando sem ir ao ar); item Avulso no topo com ✕ "Tirar item avulso"
- [x] Cabeçalho "Momento · Coleção" + título; "Limpar tela" / "Mostrar texto"
- [x] Cartões das telas (NO AR / A SEGUIR); clicar põe no ar
- [x] Barra sticky: Anterior / Próximo (com a próxima linha ou o próximo item, "Fim da liturgia"); setas ← → do teclado
- [x] "Apresentar este culto" (Liturgia) e "Apresentar agora" (Biblioteca, como Avulso, sem alterar a liturgia salva) habilitados

**US6.3** Como operador, quero a busca rápida na barra, para apresentar algo fora da liturgia.
- [x] Lógica pura (`src/shared/quick-search.ts`): referência bíblica completa, lista de livros (tag do livro + `capítulo.versículo`), prefixos das coleções (`bc cm cfw sg hnc credo`, vindos dos dados; um prefixo cadastrado vence a abreviação de livro igual)
- [x] Sugestões com ↑↓/Enter/Esc/Backspace (volta ao livro); Bíblia primeiro; Enter apresenta como Avulso e abre Apresentar

### E7 — Conexão com o OBS por HTTP (Fase 7) ✓
**Payload**: as rotas públicas entregam o **mesmo formato do Holyrics** (`{ "map": { … } }`, mesmas chaves), para o overlay atual do OBS continuar funcionando, mas com os valores limpos — o que motivou o projeto (README → "Problemas"):

```json
{
  "map": {
    "type": "BIBLE",
    "header": "Hebreus 12.15 (2/2)",
    "text": "nem haja alguma raiz de amargura que, brotando,\nvos perturbe, e, por meio dela, muitos sejam contaminados;",
    "lines": ["nem haja alguma raiz de amargura que, brotando,", "vos perturbe, e, por meio dela, muitos sejam contaminados;"],
    "seq": 128,
    "key_ok": "true", "key_error": "", "display_errors": "_true", "attention": false,
    "color": "#FAFAFA", "background": "#FFFFFF", "font": "Open Sans", "bold": false,
    "valign": "bottom", "halign": "center", "font_max_rows": "15", "max_html_types": "3",
    "alert_velocity": "160", "alert_height": "15%", "alert_bold": false,
    "alert_background": "#000000", "alert_font": "Arial", "alert_color": "#FAFAFA"
  }
}
```
- `type`: `BIBLE`, `MUSIC`, `CREED`, `CONFESSION`, `CATECHISM`, `CLEAR` (README); em `CLEAR`, `header` e `text` vazios
- `header` e `text` **sem HTML** (sem `<desc>`, `<ctt>`, `&nbsp;`, `<span>`, sem o sufixo `(RA)` e sem o `text-force-update`); `text` com as até 2 linhas separadas por `\n`
- Em `MUSIC`, também `$system_var_music_title`, `$system_var_music_artist`, `$system_var_music_author`, `$system_var_music_copyright` (créditos da E3)
- Extras que um overlay do Holyrics ignora: `seq` (crescente; o overlay descarta `seq` menor) e `lines` (array)
- Estilos (`color`, `background`, `font`, `bold`, `valign`, `halign`, `font_max_rows`, `alert_*`) vêm de `settings`, com os valores do Holyrics como padrão e `valign` por tipo (Bíblia/doutrina `bottom`, música `middle`, como no exemplo)

**Saídas**: cada saída é uma URL própria ligada a um conjunto de coleções, para o OBS ter uma Browser Source (e um layout) por tipo de conteúdo — por exemplo, a Bíblia como lower third e os hinos centralizados.
| Rota (pública na LAN, CORS aberto) | Conteúdo |
|---|---|
| `GET /overlay/<saída>` | página HTML da Browser Source daquela saída |
| `GET /overlay/resources/<saída>` | JSON `{ "map": … }` da saída (tela atual; `CLEAR` se o item no ar não é dela) |
| `GET /overlay/resources/<saída>/events` | o mesmo JSON por SSE (estado ao conectar, cada mudança, heartbeat 15 s) |
| `GET /overlay`, `/overlay/resources`, `/overlay/resources/events` | sem saída = **tudo** (compatível com o JSON do Holyrics) |
| `GET /api/v1/health?output=<saída>&rtt=` | latência/estado (o overlay chama a cada 2 s) |

- **Saídas padrão**, seguindo os grupos do app: `bible` (Bíblia: `bible:*`), `songs` (Salmos e hinos: `songbook:*`) e `doctrine` (Doutrina: `creeds`, `confession:*`, `catechism:*`)
- **O próprio operador configura** na aba Conexão (são dados em `settings.outputs`, não código): slug da URL, nome, coleções e estilo de cada saída; ex.: só `bible` + `text` (todo o resto). Ligação exata (`songbook:hnc`) ou por tipo (`songbook:*`), a mais específica vence; cada coleção em no máximo uma saída. Uma coleção nova (Harpa Cristã) entra pelo tipo ou é ligada a outra saída sem mudar código
- Slug `^[a-z0-9-]{1,32}$`; reservados: `resources`, `events`, `health`; saída desconhecida → 404
- Uma saída só mostra o que é dela: quando o item no ar é de outra saída, ela recebe `CLEAR` — assim a fonte da Bíblia some quando entra um hino
- O `seq` é único para todas as saídas (cada comando sobe um), então nenhuma saída reaproveita tela velha
- Estilo do payload por saída (`valign`, `font_max_rows`, fonte, cores), com os padrões do Holyrics: `bible`/`doctrine` em `bottom`, `songs` em `middle`

**US7.1** Como operador, quero que o OBS mostre a tela atual, para a transmissão acompanhar a apresentação.
- [x] Saídas em `settings` (`outputs`: slug, nome, coleções, estilo), com as três padrão; uma função pura decide a saída de um item (`outputFor(collection)`) e o payload de cada saída (`CLEAR` se o item no ar não for dela)
- [x] Schema zod do payload (`src/shared/payload.ts`) e função pura `toPayload(slide, item, style, seq)`; testes comparando as chaves com o exemplo do Holyrics e garantindo zero HTML
- [x] `GET /overlay/resources/<saída>` e `/overlay/resources/<saída>/events` (SSE: o estado atual ao conectar e a cada mudança; heartbeat a cada 15 s), mais as rotas sem saída (tudo); saída desconhecida ou reservada → 404
- [x] `GET /overlay/<saída>` (e `/overlay`, tudo): HTML estático da Browser Source — conecta ao SSE, cai para polling de `/overlay/resources/<saída>` (1 s) se o SSE falhar, ignora `seq` menor que o último, **mantém o último texto se a rede cair**; usa os estilos do próprio `map` (como o Holyrics)
- [x] Compatibilidade: `/overlay/resources` (tudo) serve a quem hoje consome o JSON do Holyrics (trocar só o endereço no OBS)
- [x] CORS liberado só nas rotas públicas (o overlay pode estar em outra origem)

**US7.2** Como operador, quero ver o estado da conexão com o OBS, para agir se a rede falhar.
- [x] Rastrear clientes do overlay **por saída** (SSE conectados, último acesso, IP; latência via `GET /api/v1/health?output=<saída>` chamado pelo overlay a cada 2 s)
- [x] Estados: conectado / instável (> 500 ms) / sem resposta (3 falhas seguidas); alimentam o indicador da nav e substituem o status estático da E1
- [x] Aba Conexão: IP do operador e, para cada saída, as URLs `/overlay/<saída>` e `/overlay/resources/<saída>` (copiar), as coleções ligadas e o estado dela (o indicador da nav resume todas), porta editável (só números, até 5 dígitos; reinicia só o servidor da LAN — a interface usa um servidor próprio no loopback, em porta livre; porta ocupada mantém a anterior e entra no registro), Testar, registro de eventos com hora
- [x] Saídas editáveis na aba Conexão: criar/renomear/remover, escolher as coleções (cada coleção em no máximo uma saída) e o estilo (cor, fundo, fonte, alinhamentos, linhas máximas)

### E8 — Empacotamento (Fase 8) ✓ (falta a validação em campo, US8.4)
Alvos: **Windows**, **macOS** (Apple Silicon/arm64 — o Mac do mantenedor, macOS 26) e **Linux** simples (Ubuntu/Debian). Comum a todos: `electron-builder`, o banco gerado por `npm run data:build` (após `data:unlock`) como recurso `gutenberg.sqlite`, ícone do app, versão do `package.json`.

**US8.1** Build e artefatos
- [x] `electron-builder.yml` com `extraResources` (banco), `asar`, e scripts `dist:win`, `dist:mac`, `dist:linux` (conferem antes que o banco existe e foi gerado de dados destrancados)
- [x] Ícone do app (1b — tipo móvel, fornecido pelo mantenedor): `build/icon.png` 1024 px (o `electron-builder` gera `.ico`/`.icns`), `build/icons/` por tamanho (Linux), `resources/icon.png` 256 px na janela
- [x] **Windows**: instalador NSIS (x64), atalhos no menu Iniciar e na área de trabalho; gerado no Mac (`npm run dist:win`) ou via CI
- [x] **macOS**: `.dmg` arm64 (Apple Silicon); assinatura ad-hoc (sem conta de desenvolvedor) e instrução para abrir na 1ª vez (Gatekeeper: Ajustes → Privacidade e Segurança → "Abrir mesmo assim"); gerado e aberto neste Mac (banco copiado, overlay respondendo na LAN)
- [x] **Linux**: `.deb` (Ubuntu/Debian, amd64) com atalho no menu e os passos padrão do electron-builder (link em `/usr/bin`, `chrome-sandbox`, AppArmor); `AppImage`; gerados no Mac
- [x] CI (GitHub Actions, `workflow_dispatch`): um job no Ubuntu destranca os dados (segredos `GUTENBERG_DATA_PASSWORD` + `GUTENBERG_DATA_KEY_GPG` em base64) e gera o banco; a matriz `windows-latest` / `macos-latest` / `ubuntu-latest` empacota com ele, sem git-crypt no Windows. Artefatos com retenção curta — **os instaladores contêm os textos em claro**: o repositório é público, então nada de Release pública sem decisão do mantenedor

**US8.2** Rede no PC do operador (o OBS acessa a porta do Gutenberg)
- [x] **Windows**: regra de firewall para o **programa** (vale para qualquer porta escolhida na aba Conexão), perfis privado e domínio, criada pelo instalador NSIS (instalação por máquina, pede administrador) e removida na desinstalação
- [x] **macOS**: o firewall do sistema pergunta na 1ª execução ("permitir conexões de entrada") — documentar; verificar com `socketfilterfw`
- [x] **Linux**: se o `ufw` estiver ativo, o `postinst` do `.deb` libera a porta padrão 8484/tcp (e o `postrm` remove); porta trocada → instrução `sudo ufw allow <porta>/tcp`

**US8.3** Configuração do OBS e atualização
- [x] Guia `docs/OBS.md`: instalar em cada sistema, Browser Source com a URL da saída exibida na aba Conexão (ou o consumidor de JSON existente apontado para `/overlay/resources/<saída>` ou `/overlay/resources`), firewall, problemas comuns
- [x] Atualização preserva o banco do operador em `userData` (o banco empacotado só é copiado na 1ª execução)
- [x] Dados novos da E3 entram sem perder edições: o `data:build` grava `content_version` (hash dos dados); ao abrir, se o banco empacotado tiver outra versão, o conteúdo é atualizado a partir dele, **mantendo os registros editados pelo operador** (músicas e credos com `source = 'edited'`; seções da confissão e perguntas de catecismo marcadas `edited` — migração 2), novas seções do operador na mesma ordem; cultos, liturgias e configurações intactos

**US8.5** Versões no GitHub
- [x] Workflow manual **release** (`workflow_dispatch`, opção draft): reaproveita o `installers` (`workflow_call`), cria a versão `v<package.json>` com os quatro instaladores e as notas da seção do `CHANGELOG.md` (`npm run release:notes`; falha se a versão não estiver fechada no changelog); rodar de novo substitui os arquivos. Publicar é decisão do mantenedor (textos em claro)

**US8.4** Validação em campo
- [x] Rodar o workflow **installers** depois de cadastrar os segredos no GitHub (2026-10-13: testes + banco no Ubuntu, instaladores Windows/macOS/Linux gerados)
- [ ] Instalar num Windows e num Ubuntu reais: regra de firewall / `ufw`, atalho, primeira execução; OBS em outro PC lendo `/overlay/<saída>`

### E9 — Navegação sem rolagem ✓
Listas longas da Biblioteca são paginadas para caber na janela, sem rolar a página.

**US9.1** Como operador, quero navegar a Confissão de Westminster e os hinários sem rolar, para achar o item rápido durante o culto.
- [x] Lista paginada (`List` em `views/library/parts.tsx`): o número de linhas por página vem da altura livre da janela (recalculado ao redimensionar); paginador com primeira/anterior/"Página k de n"/próxima/última, só quando há mais de uma página
- [x] A página aberta é lembrada ao voltar de um item (ex.: abrir o hino 245 e voltar cai na mesma página)
- [x] Aplicada aos capítulos da CFW e à lista de hinos (HNC e hinários sem número de salmo); teclas ←/→ trocam de página quando o foco não está em campo de texto

### E10 — Atualização automática ✓ (falta validar com duas versões publicadas)
Sem servidor próprio: o app consulta as versões publicadas no GitHub Releases (repositório público) com o `electron-updater`. Rascunhos não são vistos pelo app.

**US10.1** Publicação dos metadados de atualização
- [x] O workflow **release** anexa também `latest.yml`, `latest-mac.yml`, `latest-linux.yml` e os `.blockmap` (download diferencial)
- [x] `publish: github` no `electron-builder.yml` só para gerar os metadados (os scripts `dist:*` continuam com `--publish never`)

**US10.2** Como operador, quero que o app se atualize sozinho, para não precisar baixar instaladores.
- [x] `electron-updater` no processo principal: verifica ao abrir (e a cada 6 h), em silêncio se offline; baixa em segundo plano e instala **ao fechar o app** (nunca no meio do culto)
- [x] **Windows** (NSIS por máquina, pede administrador ao instalar), **Linux** AppImage e `.deb` (pede a senha): atualização automática
- [x] **macOS**: sem Developer ID o Squirrel.Mac recusa a atualização — só avisa que há versão nova, com botão que abre a página de versões

**US10.3** Como operador, quero ver e controlar as atualizações.
- [x] Na aba Conexão: versão instalada, "Verificar atualizações", estado (atualizado / baixando k% / pronto para instalar ao fechar / erro) e "Reiniciar e atualizar"
- [x] Aviso discreto na barra quando houver versão nova; textos via i18n
- [x] Rotas locais `/api/v1/update` (estado, verificar, instalar) com `localOnly`; testes com um updater falso

**US10.4** Validação
- [x] App empacotado no Mac consultando o GitHub: sem versão publicada → "versão mais recente" (rascunhos não contam)
- [ ] Publicar a 0.1.0, depois a 0.2.0: o Windows e o Linux baixam e instalam ao fechar; o macOS mostra o aviso e o link

### E11 — Itens longos em seções ✓
Itens longos (capítulo inteiro, Sl 119, hinos de muitas estrofes) aparecem **uma seção por vez**, com uma faixa para pular — seções, não páginas. Duas funções puras em `src/shared/sections.ts`: `sectionUnits` corta o item em **pontos sugeridos** (`SUGGESTED_SECTIONS`, dados: Sl 119 em blocos de 8 versículos com as letras, Lm 3 em blocos de 3; senão, versículo a versículo; hinos por estrofe) e `fitSections` junta os pedaços que **cabem na tela** medida (desde a E12, o Sl 119 fica sempre com uma letra por seção). O payload do OBS não muda.

**US11.1** Como operador, quero apresentar um capítulo longo sem rolar, para achar o ponto da leitura.
- [x] Apresentar: faixa de seções acima das telas, só a seção vista aparece; segue o "no ar" (Próximo/←→ atravessam seções); clicar numa seção só olha; `Shift+←/→` pula de seção (comando `go` existente); dica do Próximo com a seção seguinte

**US11.2** Biblioteca: capítulo longo da Bíblia (> 30 versículos) mostra os versículos por seção; a seleção de trecho atravessa seções
- [x] `BibleBrowser` com a faixa de seções

**US11.3** Prévias "Como fica na transmissão" por seção (hino por estrofe, trecho longo por bloco)
- [x] `Leaf` com a faixa de seções

**US11.4** Revisão das demais páginas (janela 1280×820 e mínima 900×600)
- [x] Registro da aba Conexão: os 8 mais recentes e "Ver todos"
- [x] Grades (Catecismo Maior 196, Saltério 150, capítulos de Salmos) e listas laterais: cabem em 1280×820 (células de 52 px); na janela mínima (900×600) o Catecismo Maior ainda rola um pouco — sem paginação por ora

### E12 — Busca na Biblioteca, cultos recentes e telas no README ✓
Pedidos do operador depois da 0.2.0: achar itens pelo número/título, o Sl 119 uma letra por seção, os cultos mais recentes primeiro e prints no README.

**US12.1** Como operador, quero buscar na coleção aberta da Biblioteca por número, título ou referência (`42B`, `castelo`, `sl 119`, `1.2`).
- [x] Campo de busca acima do navegador da coleção (`LibrarySearch.tsx`); reaproveita `/library/search`; a Bíblia usa `parseBibleRef`/`booksFor`; Enter abre o primeiro, Esc limpa
- [x] `searchCollection` ordena hinos por número: `42B` exato, depois todas as versões de 42, depois 420…; títulos por último

**US12.2** Sl 119: uma letra por seção (1–8, 9–16…), sem dividir nem juntar letras
- [x] `fitSections`: parte nomeada nunca é cortada; só se junta às vizinhas quando o capítulo permite (`join`, dado: Lm 3)

**US12.3** Liturgia: cultos do mais recente para o mais antigo, paginados na lateral
- [x] `services` em ordem decrescente de id; `Pager`/`usePaging` extraídos de `List`; a página segue o culto selecionado

**US12.4** README com prints de cada aba e do OBS
- [x] `npm run screenshots` (playwright-core + Electron): perfil isolado e seed do protótipo (`GUTENBERG_USER_DATA`/`GUTENBERG_SEED`, só fora do app empacotado), OBS simulado por uma janela oculta em `/overlay`


### E13 — Atualização no Mac, textos sem travessão e Conexão sem rolagem ✓ (falta validar a troca do app com duas versões publicadas)
Pedidos do operador depois da 0.2.2.

**US13.1** Como operador no Mac, quero baixar e instalar a versão nova pelo próprio app.
- [x] Sem Developer ID o Squirrel.Mac não instala: o app baixa o `.dmg` do GitHub (`latest-mac.yml`, confere o sha512) com progresso; "Reiniciar e atualizar" troca o `.app` em `/Applications` e reabre; fora de `/Applications` (ou sem permissão), abre o `.dmg`

**US13.2** Nenhum travessão nos textos da interface
- [x] `pt-BR.ts`, títulos da busca rápida e valores vazios; teste impede a volta

**US13.3** Aba Conexão sem rolagem em 1280×820
- [x] Duas páginas (Estado e Saídas); saídas em cartões lado a lado, paginadas quando não cabem; registro paginado. Na janela mínima (900×600) ainda rolam a página Estado (125 a 240 px, conforme o estado da atualização) e o editor de saída (155 px)
