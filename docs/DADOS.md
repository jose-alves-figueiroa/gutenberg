# Dados — Gutenberg

Plano da E3 (ver `PLAN.md`). **Requisito funcional:** o Gutenberg sai com estes dados completos:

| Conteúdo | Completo quando |
|---|---|
| **Bíblia ARA** | 66 livros, todos os capítulos e versículos |
| **Músicas do Holyrics** (salmos genebrinos, HNC e demais) | as 246 músicas cadastradas pela igreja, com letra e créditos |
| **Símbolos de fé de Westminster** | CFW (33 capítulos, todas as seções), Breve Catecismo (107), Catecismo Maior (196) |
| **Credos** | Apostólico, Niceno e Atanasiano |

## Arquitetura

```
fontes externas            tradutores                  formato interno (versionado, cifrado)        app
────────────────           ─────────────               ──────────────────────────────────────      ───────────────
ARA.sqlite (OpenLP)   ──▶  translate:biblia    ──┐
database.db Holyrics  ──▶  translate:musicas   ──┤
página IP Aliança     ──▶  translate:cfw       ──┼──▶  data/canonical/**  (git-crypt)  ──▶ data:build ──▶ SQLite
gist (JSON)           ──▶  translate:breve     ──┤                                           (empacotado no
PDF IPB               ──▶  translate:maior     ──┤                                            instalador)
texto revisado à mão  ──▶  translate:credos    ──┘
```

1. **Formato interno próprio.** Não replicamos o esquema de nenhuma fonte (nem OpenLP, nem Holyrics):
   cada fonte é **traduzida** para o nosso modelo, definido em `src/shared/data-model.ts`.
2. **Versionado e cifrado.** `data/canonical/**` vai para o git cifrado com **git-crypt**: no GitHub
   (repositório público) só aparecem bytes cifrados; em claro após `git-crypt unlock`.
3. **Fontes brutas fora do git.** O que é baixado ou copiado (`tmp/Holyrics`, `data/sources/`) fica
   ignorado; só a tradução canônica é versionada.
4. **Build gera o banco.** `npm run data:build` lê `data/canonical/` e gera o SQLite do app;
   `npm run data:check` valida a completude da tabela acima.
5. **Créditos e origem.** Todo registro guarda `origem` (`fonte` + id original) e, nas músicas,
   autor, artista e copyright.

## Formato interno (`data/canonical/`)

Todos os arquivos são JSON UTF-8, com `"formato": 1` no topo, texto já limpo (sem HTML).

```
data/canonical/
  biblia/ara/
    meta.json              { formato, sigla: "ARA", nome, origem }
    01-Gn.json … 66-Ap.json
  musicas/
    salmos/133B.json …
    hinos/<slug>.json …
  westminster/
    cfw.json
    breve.json
    maior.json
  credos.json
```

**Livro da Bíblia** (`biblia/ara/58-Hb.json`):
```json
{ "formato": 1, "livro": "Hb", "nome": "Hebreus", "ordem": 58, "testamento": "NT",
  "capitulos": [ ["v1", "v2", "…"], ["…"] ] }
```
`capitulos[c-1][v-1]` é o texto do versículo `c.v`. As abreviações e nomes vêm de `BOOKS`
(`src/shared/collections.ts`).

**Música** (`musicas/salmos/133B.json`, `musicas/hinos/castelo-forte.json`):
```json
{ "formato": 1, "id": "salmo-133B", "tipo": "salmo", "num": "133", "versao": "B",
  "titulo": "Salmo 133B", "versificacao": "",
  "creditos": { "autor": "", "artista": "Comissão Brasileira de Salmodia", "copyright": "" },
  "estrofes": [ ["Oh! Como é bom e agradável,", "bem suave, sim,"], ["…"] ],
  "origem": { "fonte": "holyrics-db", "id": "1674772445640" } }
```
Hinos usam `"tipo": "hino"`, `num` = número do HNC quando houver.

**CFW** (`westminster/cfw.json`):
```json
{ "formato": 1, "capitulos": [ { "cap": 1, "titulo": "Da Escritura Sagrada",
  "secoes": [ { "sec": 1, "texto": "Ainda que a luz da natureza…" } ] } ],
  "origem": { "fonte": "ipalianca" } }
```

**Catecismos** (`westminster/breve.json`, `maior.json`):
```json
{ "formato": 1, "tipo": "breve",
  "perguntas": [ { "q": 1, "pergunta": "Qual é o fim principal do homem?",
                   "resposta": "O fim principal do homem é glorificar a Deus, e gozá-lo para sempre.",
                   "refs": "Rm 11.36; 1Co 10.31; …" } ],
  "origem": { "fonte": "gist" } }
```

**Credos** (`credos.json`):
```json
{ "formato": 1, "credos": [ { "id": "apostolico", "titulo": "Credo Apostólico", "texto": "…" },
                            { "id": "niceno", "titulo": "Credo Niceno", "texto": "…" },
                            { "id": "atanasiano", "titulo": "Credo Atanasiano", "texto": "…" } ] }
```

Texto corrido (versículo, seção, resposta, credo) usa linha em branco entre parágrafos e **nenhuma**
quebra simples — o `autobreak` cuida das telas.

## Tradutores (fonte → formato interno)

| Comando | Fonte | Tradução |
|---|---|---|
| `translate:biblia -- --file <ARA.sqlite>` | OpenLP SQLite (ex.: `ARA.sqlite` de github.com/damarals/biblias) | `book.book_reference_id` 1–66 → `BOOKS`; `verse(chapter, verse, text)` → `capitulos`; limpa o texto |
| `translate:musicas -- --db tmp/Holyrics/Holyrics/files/database.db` | Banco do Holyrics da igreja, tabela `music` (246 registros cifrados) | Decifra localmente (ver abaixo) → classifica salmo × hino → estrofes limpas + créditos |
| `translate:cfw -- --file data/sources/cfw.html` | https://www.ipalianca.org/simbolos-de-fe/confiss%C3%A3o-de-f%C3%A9-de-westminster | Capítulos/seções; valida 33 capítulos e a contagem de seções (`CFW_S` do protótipo) |
| `translate:breve -- --file <json>` | https://gist.github.com/joaolucasl/2084125f96a1275be2de55e4fed89f0c | `{numero, pergunta, resposta, refs}` → `perguntas`; **numera pela posição** (o item 81 tem a pergunta no campo `numero`); valida 1–107 |
| `translate:maior -- --file data/sources/maior.pdf` | https://www.ipb.org.br/content/Arquivos/Catecismo_Maior_de_Westminster.pdf | Extrai texto do PDF, separa perguntas, remove cabeçalhos/rodapés, guarda refs; valida 1–196; revisão manual do que quebrar |
| `translate:credos -- --file data/sources/credos.txt` | Texto revisado à mão (`## Credo Apostólico` + texto) — fonte: seção "Símbolos de fé" da IP Aliança ou a tradução recitada no culto | Exatamente os 3 credos |

As fontes só são baixadas quando a user story correspondente for executada.

### Músicas do Holyrics — descriptografia
Escopo: **somente** a tabela `music` de `files/database.db` (conteúdo cadastrado pela igreja).
1. Investigar, só leitura, a classe do Holyrics que lê/grava `database.db` (decompilação local com
   CFR/jadx): algoritmo, modo, IV, origem da chave, formato do conteúdo decifrado. Validar contra o
   Salmo 133B do payload de exemplo.
2. O tradutor lê o banco em modo somente leitura, decifra e gera `data/canonical/musicas/**`.
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

**Configuração inicial (já feita):** `git-crypt init`, `.gitattributes` com `data/canonical/** filter=git-crypt diff=git-crypt`, `npm run data:key`.

**Backup:** guardar uma cópia do `.secrets/gutenberg-data.key.gpg` e da senha fora deste computador. Sem os dois, os dados são irrecuperáveis.

**Regras:**
- Antes de cada commit que toque `data/`: `git-crypt status -e` precisa listar os arquivos de dados.
- Testes (`npm test`) **não** dependem dos dados reais: usam fixtures e o seed do protótipo. O
  `data:check` detecta repositório trancado (cabeçalho `\0GITCRYPT`) e avisa, em vez de falhar.
- O SQLite gerado (`data:build`) é artefato de build: não é versionado.

## Responsabilidade de licença
ARA (© SBB), HNC e as traduções dos símbolos de fé têm direitos. A igreja é responsável por usar
os textos dentro das licenças que possui. Os dados ficam cifrados no repositório público e só
são decifrados no build do instalador da igreja.

## Checklist
- [x] git-crypt inicializado; chave em `.secrets/` cifrada com a senha do `.env`
- [ ] Backup de `.secrets/gutenberg-data.key.gpg` e da senha fora deste computador
- [ ] `ARA.sqlite` (OpenLP) disponível localmente
- [ ] Cópia atualizada da pasta do Holyrics em `tmp/Holyrics`
- [ ] Texto dos 3 credos revisado (tradução recitada no culto)
