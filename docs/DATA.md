# Dados — Gutenberg

Plano detalhado da E3 (resumo em `PLAN.md`). **Requisito funcional:** o Gutenberg sai com estes dados completos:

| Conteúdo | Completo quando |
|---|---|
| **Bíblia ARA** | 66 livros, todos os capítulos e versículos |
| **Músicas do Holyrics** (salmos genebrinos, HNC e demais) | as 246 músicas cadastradas pela igreja, com letra e créditos |
| **Símbolos de fé de Westminster** | CFW (33 capítulos, todas as seções), Breve Catecismo (107), Catecismo Maior (196) |
| **Credos** | Apostólico, Niceno e Atanasiano |

Convenção: **código, formato, chaves, nomes de arquivo, comandos e tabelas em inglês**; o **conteúdo**
(títulos, textos, nomes dos livros) em português; textos da interface via i18n (`src/shared/i18n`).

## Progresso

Legenda: `[ ]` a fazer · `[~]` em execução · `[x]` feito

### E3 — Dados

**US3.0** Como mantenedor, quero os dados versionados e cifrados, para o repositório público não expor os textos.
- [x] git-crypt: `init`, `.gitattributes` (`data/canonical/**`)
- [x] Chave exportada, cifrada com `GUTENBERG_DATA_PASSWORD` em `.secrets/` (ignorado); `npm run data:key` / `data:unlock` (também no `prebuild`)
- [x] Teste `tests/gitcrypt.test.ts`: falha se algum arquivo de `data/canonical/` estiver em claro no git
- [x] Renomear `data/canonical/.verificacao.json` → `.gitcrypt-check.json` com o schema em inglês
- [x] Backup de `.secrets/gutenberg-data.key.gpg` e da senha fora deste computador (mantenedor)

**US3.1** Como desenvolvedor, quero um formato interno próprio, para não depender do esquema de nenhuma fonte.
- [x] Convenção: código, schemas, comentários e testes em inglês; textos da UI via i18n (`src/shared/i18n`, pt-BR)
- [x] `src/shared/data-model.ts`: tipos `BibleBook`, `Songbook`/`Song`, `Confession`, `Catechism`, `Creeds` (`format: 1`)
- [x] Modelo genérico: hinários, confissões e catecismos são documentos com título (Harpa Cristã, Dort, Heidelberg entram sem mudar schema); `version` nos salmos (133B × 133C)
- [x] `src/shared/slides.ts` e `collections.ts` usando o data-model; cabeçalhos via i18n + `shortTitle`/`itemLabel` do documento
- [x] Validadores do data-model (`src/shared/validate.ts`; usados pelos tradutores, `data:check` e `data:build`)
- [x] `src/shared/clean.ts`: remove `<ctt>`, `<desc>`, `<span>`, `text-force-update`, `&nbsp;`, `(RA)`; junta quebras simples de texto corrido; testes com o payload real do Holyrics
- [x] `npm run data:build`: `data/canonical/` → SQLite do app (`src/main/db/schema.ts` com migrações via `user_version`; `node:sqlite` no build)
- [x] `npm run data:check`: completude (`src/shared/requirements.ts`, contagens conferidas contra o protótipo); avisa quando o repo está trancado (`\0GITCRYPT`)
- [x] Seed do protótipo (`LIB0`) no formato interno: `npm run data:seed` → `tests/fixtures/canonical/`
- [x] Limite de caracteres por tela persistido como configuração (`settings.screen_char_limit`, padrão 96; preservado entre builds). A UI que o altera fica para a E4/E6

**US3.2** Como operador, quero a Bíblia ARA completa, para apresentar qualquer leitura.
- [x] `translate:bible`: OpenLP SQLite → `data/canonical/bible/ara/` (testes com fixture OpenLP sintética)
- [x] Obter o `ARA.sqlite` (github.com/damarals/biblias) em `data/sources/`
- [x] Traduzir e conferir: 66 livros, 1.189 capítulos, 31.104 versículos; Hb 12.14–15 idêntico ao protótipo. A fonte usa "Cânticos", "Oséias", "Miquéias" e "Atos dos Apóstolos": o nome da fonte fica no formato interno, os cabeçalhos usam `BOOKS`

**US3.3** Como operador, quero as músicas que a igreja cadastrou no Holyrics, com os créditos.
- [x] Investigar (só leitura) o formato da tabela `music` de `database.db`: cada registro é cifrado, e o próprio Holyrics protege o código que o lê (strings ofuscadas e 36 pacotes `lib/pack*.dat` cifrados). Descriptografar exigiria quebrar essa proteção — **não seguimos por aí**; vale o plano B
- [x] Plano B — `npm run holyrics:dump`: cliente da API local do Holyrics (`GetSongs` → `GetLyrics` por música) → `data/sources/holyrics-songs.json` (bruto, fora do git)
- [x] `translate:songs`: dump → `data/canonical/songbooks/<id>/`; atribui hinário (`psalter` por "Salmo 133B"/artista "Comissão Brasileira de Salmodia", `hnc` por número no título, o resto em `other` com lista para revisão); número + `version`; estrofes na ordem de apresentação do Holyrics (refrão repetido); créditos (autor, artista, copyright)
- [x] Testes com API simulada e dump sintético
- [ ] **Mantenedor:** no PC do Holyrics, Configurações → API Server → habilitar e criar um token com `GetSongs` e `GetLyrics`; preencher `HOLYRICS_API_URL` e `HOLYRICS_API_TOKEN` no `.env`; rodar `npm run holyrics:dump`
- [ ] Rodar `translate:songs`, revisar a lista `other` e conferir: 246 músicas; Salmo 133B igual ao payload de exemplo

**US3.4** Como operador, quero os símbolos de fé de Westminster completos, para apresentar doutrina.
- [x] `translate:confession`: página da IP Aliança → `confessions/wcf.json`: 33 capítulos, 171 seções, todas com referências. Capítulo 31 com 4 seções (revisão americana adotada pela IPB; o protótipo contava 5, do texto de 1647). Os capítulos extras da página (34 "Do Espírito Santo", 35 "Do Amor de Deus e das Missões") ficam de fora por padrão (`--all-chapters` os inclui) — **decisão pendente do mantenedor**
- [x] `translate:catechism -- --id wsc`: gist JSON → `catechisms/wsc.json`: 107 perguntas com referências; a 81 recuperada do campo `numero`
- [~] `translate:catechism -- --id wlc`: PDF da IPB → `catechisms/wlc.json`. Parser pronto (`pdftotext -raw`, que preserva hífens); **o PDF não tem as perguntas 176, 177 e 192** — aguardando o texto delas em `data/sources/wlc-supplement.json` (`[{ number, question, answer, refs }]`). As referências impressas após a 191 parecem misturar as da 191 e da 192

**US3.5** Como operador, quero os três credos, para a confissão de fé no culto.
- [ ] Texto revisado à mão (tradução recitada no culto) em `data/sources/creeds.txt`
- [ ] `translate:creeds` → `creeds.json` com Apostólico, Niceno e Atanasiano

## Arquitetura

```
fontes externas            tradutores                   formato interno (versionado, cifrado)        app
────────────────           ─────────────                ──────────────────────────────────────      ───────────────
ARA.sqlite (OpenLP)   ──▶  translate:bible      ──┐
API do Holyrics      ──▶  translate:songs      ──┤
página IP Aliança     ──▶  translate:confession ──┼──▶  data/canonical/**  (git-crypt)  ──▶ data:build ──▶ SQLite
gist (JSON)           ──▶  translate:catechism  ──┤                                           (empacotado no
PDF IPB               ──▶  translate:catechism  ──┤                                            instalador)
texto revisado à mão  ──▶  translate:creeds     ──┘
```

1. **Formato interno próprio.** Não replicamos o esquema de nenhuma fonte (nem OpenLP, nem Holyrics):
   cada fonte é **traduzida** para o nosso modelo, definido em `src/shared/data-model.ts`.
2. **Versionado e cifrado.** `data/canonical/**` vai para o git cifrado com **git-crypt**: no GitHub
   (repositório público) só aparecem bytes cifrados; em claro após `npm run data:unlock`.
3. **Fontes brutas fora do git.** O que é baixado ou copiado (`tmp/Holyrics`, `data/sources/`) fica
   ignorado; só a tradução canônica é versionada.
4. **Build gera o banco.** `npm run data:build` lê `data/canonical/` e gera o SQLite do app;
   `npm run data:check` valida a completude.
5. **Créditos e origem.** Todo registro guarda `source` (`name` + id original) e, nas músicas,
   autor, artista e copyright.

## Formato interno (`data/canonical/`)

JSON UTF-8, com `"format": 1` no topo, texto já limpo (sem HTML). Texto corrido (versículo, seção,
resposta, credo) usa linha em branco entre parágrafos e **nenhuma** quebra simples — o `autobreak`
cuida das telas. Tipos: `src/shared/data-model.ts`.

**Documentos, não tipos fixos.** Hinários, confissões e catecismos são documentos com `id`, título,
título curto e prefixo de busca. Para acrescentar a Harpa Cristã, os Cânones de Dort ou o Catecismo de
Heidelberg basta um novo arquivo — sem mudar código nem schema.

```
data/canonical/
  .gitcrypt-check.json
  bible/ara/
    meta.json                      { format, code: "ARA", name, copyright, source }
    01-Gn.json … 66-Ap.json
  songbooks/
    hnc/songbook.json              hinário
    hnc/songs/155.json …
    psalter/songbook.json          saltério genebrino
    psalter/songs/133B.json …      <number><version>
    other/songbook.json            "Outros cânticos": músicas do Holyrics fora de um hinário publicado
    other/songs/<slug>.json …
  confessions/
    wcf.json                       Confissão de Fé de Westminster
  catechisms/
    wsc.json                       Breve Catecismo de Westminster
    wlc.json                       Catecismo Maior de Westminster
  creeds.json
```

**Bible book** (`bible/ara/58-Hb.json`):
```json
{ "format": 1, "book": "Hb", "name": "Hebreus", "order": 58, "testament": "NT",
  "chapters": [ ["v1", "v2", "…"], ["…"] ] }
```
`chapters[c-1][v-1]` é o texto do versículo `c.v`. Abreviações e nomes vêm de `BOOKS`
(`src/shared/collections.ts`).

**Songbook** (`songbooks/psalter/songbook.json`, `songbooks/hnc/songbook.json`):
```json
{ "format": 1, "id": "psalter", "title": "Salmos genebrinos", "shortTitle": "Salmo",
  "prefix": "sg", "itemLabel": "Salmo", "source": { "name": "holyrics-db" } }
```
`itemLabel` vai antes do número no cabeçalho (`Salmo 133B`); vazio em hinários (`155 · Castelo forte`).

**Song** (`songbooks/psalter/songs/133B.json`):
```json
{ "format": 1, "id": "psalter-133B", "songbook": "psalter", "number": "133", "version": "B",
  "title": "Salmo 133B", "versification": "",
  "credits": { "author": "", "artist": "Comissão Brasileira de Salmodia", "copyright": "" },
  "stanzas": [ ["Oh! Como é bom e agradável,", "bem suave, sim,"], ["…"] ],
  "source": { "name": "holyrics-db", "id": "1674772445640" } }
```
`version` distingue as versões do mesmo número (133A, 133B, 133C); vazio quando só há uma.

**Confession** (`confessions/wcf.json`):
```json
{ "format": 1, "id": "wcf", "title": "Confissão de Fé de Westminster", "shortTitle": "CFW", "prefix": "cfw",
  "chapters": [ { "id": "1", "title": "Da Escritura Sagrada",
                  "sections": [ { "id": "1", "text": "Ainda que a luz da natureza…" } ] } ],
  "source": { "name": "ipalianca" } }
```
`chapters[].id` e `sections[].id` são **rótulos** (texto): servem para `1`, `3/4` (capítulo III/IV dos
Cânones de Dort) ou `R1` (rejeição de erros). A ordem é a do array.

**Catechism** (`catechisms/wsc.json`, `wlc.json`):
```json
{ "format": 1, "id": "wsc", "title": "Breve Catecismo de Westminster", "shortTitle": "Breve Catecismo", "prefix": "bc",
  "questions": [ { "number": 1, "question": "Qual é o fim principal do homem?",
                   "answer": "O fim principal do homem é glorificar a Deus, e gozá-lo para sempre.",
                   "refs": "Rm 11.36; 1Co 10.31; …" } ],
  "source": { "name": "gist" } }
```

**Creeds** (`creeds.json`):
```json
{ "format": 1,
  "creeds": [ { "id": "apostles", "title": "Credo Apostólico", "text": "…" },
              { "id": "nicene", "title": "Credo Niceno", "text": "…" },
              { "id": "athanasian", "title": "Credo Atanasiano", "text": "…" } ],
  "source": { "name": "manual" } }
```

**Verificação do git-crypt** (`.gitcrypt-check.json`): `{ "format": 1, "check": "git-crypt ok" }`.

## Schema SQLite do app (`data:build`)

Gerado a partir do formato interno; nomes em inglês (substituem os nomes em português sugeridos no
README do handoff). Documentos ficam em tabelas próprias e os itens apontam para eles — um novo
hinário, confissão ou catecismo é só uma linha nova.

| Tabela | Colunas |
|---|---|
| `bible_versions` | `code` (PK), `name`, `copyright`, `source` |
| `bible_verses` | `version` → `bible_versions`, `book`, `chapter`, `verse`, `text` (somente leitura) |
| `songbooks` | `id` (PK), `title`, `short_title`, `prefix`, `item_label`, `source` |
| `songs` | `id` (PK), `songbook_id` → `songbooks`, `number`, `version`, `title`, `versification`, `author`, `artist`, `copyright`, `lyrics`, `source`; único (`songbook_id`, `number`, `version`, `title`) — o título entra porque músicas avulsas (`other`) não têm número |
| `confessions` | `id` (PK), `title`, `short_title`, `prefix`, `source` |
| `confession_sections` | `confession_id` → `confessions`, `position`, `chapter`, `chapter_title`, `section`, `section_title`, `text`, `refs` |
| `catechisms` | `id` (PK), `title`, `short_title`, `prefix`, `source` |
| `catechism_questions` | `catechism_id` → `catechisms`, `number`, `question`, `answer`, `refs` |
| `creeds` | `id` (PK), `title`, `text`, `source` |
| `services` | `id`, `name` (cultos — E5) |
| `liturgy_items` | `service_id`, `position`, `moment`, `collection`, `item_ref` (E5) |
| `settings` | `key`, `value` (ex.: limite de caracteres por tela) |

`songs.lyrics` guarda as estrofes separadas por linha em branco. O `data:build` substitui as tabelas de conteúdo e preserva `services`, `liturgy_items` e `settings`. O build usa `node:sqlite` (sem dependência nativa); o driver do app em runtime é decidido na E4 — o código só depende da interface `SqlDatabase`. `confession_sections.chapter` e
`section` são texto (rótulos); `position` dá a ordem.

## Tradutores (fonte → formato interno)

| Comando | Fonte | Tradução |
|---|---|---|
| `translate:bible -- --file data/sources/ARA.sqlite` | OpenLP SQLite (ex.: `ARA.sqlite` de github.com/damarals/biblias) | `book.book_reference_id` 1–66 → `BOOKS`; `verse(chapter, verse, text)` → `chapters`; limpa o texto |
| `holyrics:dump` + `translate:songs -- --file data/sources/holyrics-songs.json` | API local do Holyrics da igreja (246 músicas) | `GetSongs`/`GetLyrics` → dump bruto → atribui hinário (`hnc`, `psalter`, `other`), número e `version` → estrofes na ordem do Holyrics + créditos |
| `translate:confession -- --id wcf --file data/sources/wcf.html` | https://www.ipalianca.org/simbolos-de-fe/confiss%C3%A3o-de-f%C3%A9-de-westminster | Capítulos/seções; valida 33 capítulos e a contagem de seções (`CFW_S` do protótipo) |
| `translate:catechism -- --id wsc --file data/sources/wsc.json` | https://gist.github.com/joaolucasl/2084125f96a1275be2de55e4fed89f0c | `{numero, pergunta, resposta, refs}` → `questions`; **numera pela posição** (o item 81 tem a pergunta no campo `numero`); valida 1–107 |
| `translate:catechism -- --id wlc --file data/sources/wlc.pdf` | https://www.ipb.org.br/content/Arquivos/Catecismo_Maior_de_Westminster.pdf | Extrai texto do PDF, separa perguntas, remove cabeçalhos/rodapés, guarda refs; valida 1–196; revisão manual do que quebrar |
| `translate:creeds -- --file data/sources/creeds.txt` | Texto revisado à mão (`## Credo Apostólico` + texto) — fonte: seção "Símbolos de fé" da IP Aliança ou a tradução recitada no culto | Exatamente os 3 credos |

As fontes só são baixadas quando a user story correspondente for executada. O tradutor do PDF usa `pdftotext` (poppler: `brew install poppler`); só o mantenedor roda tradutores, e o resultado é versionado.

### Músicas do Holyrics — API local
A tabela `music` de `files/database.db` é cifrada registro a registro, e o Holyrics protege o código
que a lê (strings ofuscadas, classes em pacotes `lib/pack*.dat` cifrados). Não quebramos essa
proteção: as músicas saem pela **API local oficial** (github.com/holyrics/API-Server), que entrega o
mesmo conteúdo — letra por slide, ordem de apresentação e créditos.

1. No PC do Holyrics: Configurações → API Server → habilitar; criar um token com permissão para
   `GetSongs` e `GetLyrics`; anotar IP e porta.
2. No `.env`: `HOLYRICS_API_URL=http://<ip>:<porta>` e `HOLYRICS_API_TOKEN=<token>`.
3. `npm run holyrics:dump` → `data/sources/holyrics-songs.json` (não precisa do repositório destrancado).
4. `npm run translate:songs -- --file data/sources/holyrics-songs.json` → `data/canonical/songbooks/`;
   revisar a lista de músicas em `other` (não reconhecidas como HNC ou Saltério).

### Limpeza comum (`src/shared/clean.ts`)
- Remove `<ctt>`, `<desc>`, `<span …>`, `text-force-update`, `&nbsp;`, `(RA)` final e espaços duplicados.
- Normaliza `\r\n`.
- Em texto corrido, troca quebra simples por espaço.
- Fixture: `design_handoff_gutenberg/reference/holyrics-payload-exemplo.json.txt`.

## git-crypt

**Arquivos (todos ignorados pelo git, dentro do projeto):**
- `.env` → `GUTENBERG_DATA_PASSWORD=…` (modelo em `.env.example`; a variável de ambiente, se definida, tem prioridade — útil no CI).
- `.secrets/gutenberg-data.key.gpg` → chave do git-crypt cifrada (AES-256) com essa senha.

**Comandos (`scripts/data-key.mjs`):**
- `npm run data:unlock` — decifra o `.gpg` com a senha e roda `git-crypt unlock`; não faz nada se já estiver destrancado. Roda sozinho antes do `npm run build` (`prebuild`).
- `npm run data:key` — recria o `.gpg` a partir do repositório destrancado e da senha atual (também serve para trocar a senha), e confere que ele decifra.
- A chave em claro só existe num arquivo temporário `0600`, apagado ao final.

**Em outra máquina / no build:**
1. `brew install git-crypt` (e `gpg`).
2. Clonar; copiar `.secrets/gutenberg-data.key.gpg` e criar o `.env` com a senha.
3. `npm run data:unlock` (ou direto `npm run build`).

**Backup:** guardar uma cópia do `.secrets/gutenberg-data.key.gpg` e da senha fora deste computador. Sem os dois, os dados são irrecuperáveis.

**Regras:**
- Antes de cada commit que toque `data/`: `git-crypt status -e` precisa listar os arquivos de dados
  (o teste `tests/gitcrypt.test.ts` também verifica).
- Testes (`npm test`) **não** dependem dos dados reais: usam fixtures e o seed do protótipo. O
  `data:check` detecta repositório trancado (cabeçalho `\0GITCRYPT`) e avisa, em vez de falhar.
- O SQLite gerado (`data:build`) é artefato de build: não é versionado.

## Responsabilidade de licença
ARA (© SBB), HNC e as traduções dos símbolos de fé têm direitos. A igreja é responsável por usar
os textos dentro das licenças que possui. Os dados ficam cifrados no repositório público e só
são decifrados no build do instalador da igreja.
