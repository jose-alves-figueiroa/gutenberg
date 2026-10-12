# Dados — Gutenberg

Plano detalhado da E3 (resumo em `PLAN.md`). **Requisito funcional:** o Gutenberg sai com estes dados completos:

| Conteúdo | Completo quando |
|---|---|
| **Bíblia ARA** | 66 livros, todos os capítulos e versículos |
| **Músicas do Holyrics** (salmos genebrinos, HNC e demais) | as 246 músicas cadastradas pela igreja, com letra e créditos |
| **Símbolos de fé de Westminster** | CFW (33 capítulos, todas as seções), Breve Catecismo (107), Catecismo Maior (196) |
| **Credos** | Apostólico, Niceno e Atanasiano |

Convenção: **formato, chaves, nomes de arquivo, comandos e tabelas em inglês**; o **conteúdo** (títulos,
textos, nomes dos livros) em português.

## Progresso

Legenda: `[ ]` a fazer · `[~]` em execução · `[x]` feito

### E3 — Dados

**US3.0** Como mantenedor, quero os dados versionados e cifrados, para o repositório público não expor os textos.
- [x] git-crypt: `init`, `.gitattributes` (`data/canonical/**`)
- [x] Chave exportada, cifrada com `GUTENBERG_DATA_PASSWORD` em `.secrets/` (ignorado); `npm run data:key` / `data:unlock` (também no `prebuild`)
- [x] Teste `tests/gitcrypt.test.ts`: falha se algum arquivo de `data/canonical/` estiver em claro no git
- [x] Renomear `data/canonical/.verificacao.json` → `.gitcrypt-check.json` com o schema em inglês
- [ ] Backup de `.secrets/gutenberg-data.key.gpg` e da senha fora deste computador (mantenedor)

**US3.1** Como desenvolvedor, quero um formato interno próprio, para não depender do esquema de nenhuma fonte.
- [ ] `src/shared/data-model.ts`: tipos + validadores de `BibleBook`, `Song`, `Confession`, `Catechism`, `Creeds` (`format: 1`)
- [ ] Alinhar os tipos de `src/shared/slides.ts` ao data-model (hoje `pergunta`/`resposta`/`cap`/`sec`)
- [ ] `src/shared/clean.ts`: remove `<ctt>`, `<desc>`, `<span>`, `text-force-update`, `&nbsp;`, `(RA)`; junta quebras simples de texto corrido; testes com o payload real do Holyrics
- [ ] `npm run data:build`: `data/canonical/` → SQLite do app (schema abaixo); migrações
- [ ] `npm run data:check`: completude (tabela do requisito); avisa quando o repo está trancado (`\0GITCRYPT`)
- [ ] Seed do protótipo (`LIB0`) no formato interno, para desenvolvimento e testes
- [ ] Limite de caracteres por tela persistido como configuração

**US3.2** Como operador, quero a Bíblia ARA completa, para apresentar qualquer leitura.
- [ ] `translate:bible`: OpenLP SQLite → `data/canonical/bible/ara/` (testes com fixture OpenLP sintética)
- [ ] Obter o `ARA.sqlite` (github.com/damarals/biblias) em `data/sources/`
- [ ] Traduzir e conferir: 66 livros; Hb 12.14–15 igual ao protótipo

**US3.3** Como operador, quero as músicas que a igreja cadastrou no Holyrics, com os créditos.
- [ ] Investigar (só leitura) o formato da tabela `music` de `database.db`
- [ ] `translate:songs`: decifra só `music` (chave em `HOLYRICS_DB_KEY`, fora do git) → `data/canonical/songs/`
- [ ] Classificar salmo × hino; estrofes limpas; créditos (autor, artista, copyright)
- [ ] Testes com registro sintético cifrado com chave de teste
- [ ] Conferir: 246 músicas; Salmo 133B igual ao payload de exemplo
- [ ] Plano B (só se a descriptografia não for viável): API local do Holyrics (`GetSongs`/`GetLyrics`)

**US3.4** Como operador, quero os símbolos de fé de Westminster completos, para apresentar doutrina.
- [ ] `translate:confession`: página da IP Aliança → `westminster/confession.json`; valida 33 capítulos e seções
- [ ] `translate:shorter`: gist JSON → `westminster/shorter-catechism.json`; numera pela posição (item 81 defeituoso); valida 1–107
- [ ] `translate:larger`: PDF da IPB → `westminster/larger-catechism.json`; valida 1–196; revisão manual

**US3.5** Como operador, quero os três credos, para a confissão de fé no culto.
- [ ] Texto revisado à mão (tradução recitada no culto) em `data/sources/creeds.txt`
- [ ] `translate:creeds` → `creeds.json` com Apostólico, Niceno e Atanasiano

## Arquitetura

```
fontes externas            tradutores                   formato interno (versionado, cifrado)        app
────────────────           ─────────────                ──────────────────────────────────────      ───────────────
ARA.sqlite (OpenLP)   ──▶  translate:bible      ──┐
database.db Holyrics  ──▶  translate:songs      ──┤
página IP Aliança     ──▶  translate:confession ──┼──▶  data/canonical/**  (git-crypt)  ──▶ data:build ──▶ SQLite
gist (JSON)           ──▶  translate:shorter    ──┤                                           (empacotado no
PDF IPB               ──▶  translate:larger     ──┤                                            instalador)
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
cuida das telas.

```
data/canonical/
  .gitcrypt-check.json
  bible/ara/
    meta.json                     { format, code: "ARA", name, source }
    01-Gn.json … 66-Ap.json
  songs/
    psalms/133B.json …
    hymns/<slug>.json …
  westminster/
    confession.json
    shorter-catechism.json
    larger-catechism.json
  creeds.json
```

**Bible book** (`bible/ara/58-Hb.json`):
```json
{ "format": 1, "book": "Hb", "name": "Hebreus", "order": 58, "testament": "NT",
  "chapters": [ ["v1", "v2", "…"], ["…"] ] }
```
`chapters[c-1][v-1]` é o texto do versículo `c.v`. Abreviações e nomes vêm de `BOOKS`
(`src/shared/collections.ts`).

**Song** (`songs/psalms/133B.json`, `songs/hymns/castelo-forte.json`):
```json
{ "format": 1, "id": "psalm-133B", "kind": "psalm", "number": "133", "version": "B",
  "title": "Salmo 133B", "versification": "",
  "credits": { "author": "", "artist": "Comissão Brasileira de Salmodia", "copyright": "" },
  "stanzas": [ ["Oh! Como é bom e agradável,", "bem suave, sim,"], ["…"] ],
  "source": { "name": "holyrics-db", "id": "1674772445640" } }
```
Hinos usam `"kind": "hymn"`; `number` = número do HNC quando houver.

**Confession** (`westminster/confession.json`):
```json
{ "format": 1,
  "chapters": [ { "chapter": 1, "title": "Da Escritura Sagrada",
                  "sections": [ { "section": 1, "text": "Ainda que a luz da natureza…" } ] } ],
  "source": { "name": "ipalianca" } }
```

**Catechism** (`westminster/shorter-catechism.json`, `larger-catechism.json`):
```json
{ "format": 1, "kind": "shorter",
  "questions": [ { "number": 1, "question": "Qual é o fim principal do homem?",
                   "answer": "O fim principal do homem é glorificar a Deus, e gozá-lo para sempre.",
                   "refs": "Rm 11.36; 1Co 10.31; …" } ],
  "source": { "name": "gist" } }
```
`kind`: `shorter` (Breve) ou `larger` (Maior).

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
README do handoff).

| Tabela | Colunas |
|---|---|
| `bible_verses` | `version`, `book`, `chapter`, `verse`, `text` (somente leitura) |
| `songs` | `id`, `kind` (`psalm`/`hymn`), `number`, `version`, `title`, `versification`, `author`, `artist`, `copyright`, `lyrics`, `source` |
| `confession_sections` | `chapter`, `section`, `chapter_title`, `text`, `source` |
| `catechism_questions` | `kind` (`shorter`/`larger`), `number`, `question`, `answer`, `refs`, `source` |
| `creeds` | `id`, `title`, `text`, `source` |
| `services` | `id`, `name` (cultos — E5) |
| `liturgy_items` | `service_id`, `position`, `moment`, `collection`, `item_ref` (E5) |
| `settings` | `key`, `value` (ex.: limite de caracteres por tela) |

`songs.lyrics` guarda as estrofes separadas por linha em branco (o formato que `slidesOf` já usa).

## Tradutores (fonte → formato interno)

| Comando | Fonte | Tradução |
|---|---|---|
| `translate:bible -- --file data/sources/ARA.sqlite` | OpenLP SQLite (ex.: `ARA.sqlite` de github.com/damarals/biblias) | `book.book_reference_id` 1–66 → `BOOKS`; `verse(chapter, verse, text)` → `chapters`; limpa o texto |
| `translate:songs -- --db tmp/Holyrics/Holyrics/files/database.db` | Banco do Holyrics da igreja, tabela `music` (246 registros cifrados) | Decifra localmente (ver abaixo) → classifica psalm × hymn → estrofes limpas + créditos |
| `translate:confession -- --file data/sources/confession.html` | https://www.ipalianca.org/simbolos-de-fe/confiss%C3%A3o-de-f%C3%A9-de-westminster | Capítulos/seções; valida 33 capítulos e a contagem de seções (`CFW_S` do protótipo) |
| `translate:shorter -- --file data/sources/shorter-catechism.json` | https://gist.github.com/joaolucasl/2084125f96a1275be2de55e4fed89f0c | `{numero, pergunta, resposta, refs}` → `questions`; **numera pela posição** (o item 81 tem a pergunta no campo `numero`); valida 1–107 |
| `translate:larger -- --file data/sources/larger-catechism.pdf` | https://www.ipb.org.br/content/Arquivos/Catecismo_Maior_de_Westminster.pdf | Extrai texto do PDF, separa perguntas, remove cabeçalhos/rodapés, guarda refs; valida 1–196; revisão manual do que quebrar |
| `translate:creeds -- --file data/sources/creeds.txt` | Texto revisado à mão (`## Credo Apostólico` + texto) — fonte: seção "Símbolos de fé" da IP Aliança ou a tradução recitada no culto | Exatamente os 3 credos |

As fontes só são baixadas quando a user story correspondente for executada.

### Músicas do Holyrics — descriptografia
Escopo: **somente** a tabela `music` de `files/database.db` (conteúdo cadastrado pela igreja).
1. Investigar, só leitura, a classe do Holyrics que lê/grava `database.db` (decompilação local com
   CFR/jadx): algoritmo, modo, IV, origem da chave, formato do conteúdo decifrado. Validar contra o
   Salmo 133B do payload de exemplo.
2. O tradutor lê o banco em modo somente leitura, decifra e gera `data/canonical/songs/**`.
3. A chave do Holyrics fica em `.env` local (`HOLYRICS_DB_KEY`), fora do git.
4. Testes com registro sintético cifrado com chave de teste.
5. Plano B: API local do Holyrics (`GetSongs` / `GetLyrics` devolvem `slides[].text`, `artist`,
   `author`, `copyright`).

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
