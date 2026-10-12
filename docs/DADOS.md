# Obtenção de dados — Gutenberg

Plano da E3 (ver `PLAN.md`): de onde vem cada conteúdo da biblioteca, como entra no banco
local e o que precisa ser confirmado antes de usar em produção.

> **Nada aqui é baixado automaticamente.** As URLs ficam registradas; o download acontece
> só quando a user story correspondente for executada, sempre para `data/` (fora do git).

## Princípios
1. **Código agnóstico à fonte; dado fora do git.** Importadores leem arquivos locais e gravam em
   `data/gutenberg.sqlite`. O `.gitignore` bloqueia `*.sqlite`, `data/ara*`, `tmp/` e `.env`.
2. **Licença é um portão.** Cada fonte tem uma pendência "confirmar licença" no `PLAN.md`.
3. **Desenvolvimento com dados livres.** Testes usam o seed do protótipo
   (`scripts/prototype.mjs` → `LIB0`), uma Bíblia **domínio público** no formato OpenLP e
   registros sintéticos. Nenhum texto licenciado em `tests/`.
4. **Créditos preservados.** Autor, artista e copyright vão para o banco; cada registro guarda
   a `fonte` (`holyrics-db`, `openlp:ARA`, `gist`, `ipb-pdf`, `manual`…).

## Fontes

### Bíblia ARA
- **Fonte:** arquivo SQLite no esquema **OpenLP** (`book`, `verse(book_id, chapter, verse, text)`,
  `metadata`) fornecido localmente pela igreja — ex.: `ARA.sqlite` de
  https://github.com/damarals/biblias (`inst/sql/ARA.sqlite`).
- **Como:** `npm run import:bible -- --file <ARA.sqlite> --sigla ARA` → tabela
  `biblia(livro, cap, vers, texto)`, somente leitura. `book_reference_id` (1–66) mapeado para
  as abreviações de `src/shared/collections.ts` (`BOOKS`).
- **Portão:** a ARA é © SBB. O próprio repositório damarals/biblias diz que só as versões de
  domínio público podem ser redistribuídas. A igreja confirma que sua licença cobre o uso fora
  do Holyrics. O `pt_ra.bib` do Holyrics é criptografado e **não** será aberto.
- **Dev/testes:** versão domínio público do mesmo repositório (mesmo esquema).

### Salmos genebrinos e hinos (HNC e outros) + créditos
- **Fonte:** banco do Holyrics da igreja — `tmp/Holyrics/Holyrics/files/database.db`, tabela
  `music` (246 músicas cadastradas pela própria igreja; cada registro criptografado em base64).
- **Como (descriptografia local, só a tabela `music`):**
  1. Investigar, só leitura, a classe do Holyrics que lê/grava `database.db` (decompilação
     local com CFR/jadx): algoritmo, modo, IV, origem da chave e formato do conteúdo.
     Validar contra uma letra conhecida (Salmo 133B do payload de exemplo).
  2. `scripts/import-holyrics-db.ts` lê o banco em modo somente leitura, decifra, normaliza para
     `{id, title, artist, author, copyright, note, slides[]}` e grava `data/holyrics-music.json`.
  3. A chave **não** vai para o repositório: o script lê `HOLYRICS_DB_KEY` do `.env` local.
  4. Testes com um registro **sintético** cifrado com chave de teste.
- **Classificação:**
  - `Salmo 133B` / artista "Comissão Brasileira de Salmodia" → `salmos(num, versao, versificacao, letra)`.
  - Demais → `hinos(num, titulo, autoria, letra)`; número do HNC extraído do título quando houver.
  - Cada slide limpo vira uma estrofe (separadas por linha em branco).
  - `artist`/`author`/`copyright`/`note` → créditos.
- **Plano B:** API local do Holyrics (https://github.com/holyrics/API-Server). `GetSongs` /
  `GetLyrics` retornam `slides[].text`, `artist`, `author`, `copyright` (v2.21+; a igreja usa a
  2.29.1). Exige habilitar o API Server e criar um token no PC da igreja.
  Obs.: a API **não** tem ação que devolva texto de versículo (só `ShowVerse`).
- **Escopo:** os `.bib` (Bíblias licenciadas) ficam fora.

### Confissão de Fé de Westminster (33 capítulos)
- **Fonte:** IP Aliança — https://www.ipalianca.org/simbolos-de-fe/confiss%C3%A3o-de-f%C3%A9-de-westminster
- **Como:** baixar a página uma vez para `data/sources/cfw.html`; extrair capítulos/seções →
  `cfw(cap, sec, texto)` via `clean.ts`; validar 33 capítulos e a contagem de seções contra
  `CFW_S` do protótipo. Lacunas: cadastro pela Biblioteca (Fase 4).
- **Portão:** confirmar a tradução (provavelmente a da Cultura Cristã/IPB) e a permissão de uso.

### Breve Catecismo (107 perguntas)
- **Fonte:** gist — https://gist.github.com/joaolucasl/2084125f96a1275be2de55e4fed89f0c
  (`westminster-shorter-pt-br.json`: array de `{numero, pergunta, resposta, refs}`; sem HTML).
- **Como:** `scripts/import-catechism.ts --tipo breve --file <json>` →
  `catecismo(tipo, q, pergunta, resposta, refs)`. **Numerar pela posição**: o item 81 tem a
  pergunta no campo `numero`. Validar 1–107.
- **Portão:** o gist não declara licença → confirmar que é a tradução usada no culto.

### Catecismo Maior (196 perguntas)
- **Fonte:** PDF da IPB — https://www.ipb.org.br/content/Arquivos/Catecismo_Maior_de_Westminster.pdf
- **Como:** baixar uma vez para `data/sources/`; extrair texto (`pdf-parse`/`pdftotext`);
  separar por pergunta; remover cabeçalhos/rodapés; guardar referências em `refs` quando
  possível → `catecismo(tipo='maior', …)`. Validar 1–196 e revisar à mão o que a extração quebrar.
- **Portão:** confirmar a permissão de uso no app.

### Credos — Apostólico, Niceno e Atanasiano
- **Fonte:** seção "Símbolos de fé" da IP Aliança ou a tradução que a igreja recita.
- **Como:** cadastro revisado à mão em texto simples, sem scraper:

  ```
  ## Credo Apostólico
  Creio em Deus Pai…

  ## Credo Niceno
  …
  ```

  → `credos(titulo, texto)`. Teste garante os 3 títulos e texto não vazio.
- **Portão:** versionar o seed (`data/seed/credos.txt`) só se a tradução for de domínio
  público — o Atanasiano costuma ter traduções modernas com direitos; senão fica em `data/` local.

## Formatos de texto simples (doutrina)
- **CFW:** `## 1.1` seguido do texto da seção.
- **Catecismo:** `P. 1 <pergunta>` na primeira linha, `R. <resposta>` na seguinte; perguntas
  separadas por linha em branco.
- **Credo:** `## <título>` seguido do texto.

## Limpeza comum (`src/shared/clean.ts`)
- Remove `<ctt>`, `<desc>`, `<span …>`, `text-force-update`, `&nbsp;`, `(RA)` final e espaços duplicados.
- Normaliza `\r\n`.
- Em texto corrido (Bíblia, CFW, catecismos, credos), junta quebras de linha simples, para
  não gerar telas com 3+ linhas.
- Fixture: `design_handoff_gutenberg/reference/holyrics-payload-exemplo.json.txt`.

## Checklist da igreja
- [ ] Manter cópia atualizada da pasta do Holyrics (`files/database.db`) em `tmp/Holyrics`.
- [ ] Confirmar licença da ARA (SBB) para uso fora do Holyrics; entregar o `ARA.sqlite` localmente.
- [ ] Confirmar tradução/permissão da CFW (IP Aliança), do Breve (gist) e do Maior (IPB).
- [ ] Indicar a tradução dos credos recitada no culto.
- [ ] Só se o plano B for necessário: habilitar o API Server no Holyrics e criar token com
  `GetSongs`, `GetLyrics`, `GetTexts`.
