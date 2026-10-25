# Implementado — Gutenberg 0.2.3

Gerado com `npm run design:implemented` a partir do seed do protótipo (os mesmos dados de exemplo
da v1, nunca a biblioteca real). Cada tela tem o `.png` e o `.html` (DOM renderizado, CSS embutido,
sem scripts, fontes em `assets/`). As medidas de rolagem estão em `scroll.json`.

Resoluções: notebooks de 14–16" com tela de 1920×1200 ou 1920×1080 e escala do sistema de 100%,
125% (1536×864) e 150% (1280×720). Viewport emulado: o tamanho é o da área do app.

## Telas

| Arquivo | Tela |
| --- | --- |
| `liturgy` | Liturgia: cultos recentes (paginados) e o culto aberto com seus itens |
| `library-bible-books` | Biblioteca → Bíblia: escolha do livro |
| `library-bible-chapter` | Hebreus 12 com o trecho 1–3 selecionado e a prévia "Como fica na transmissão" |
| `library-search` | Busca na coleção (Salmos genebrinos, "133") |
| `library-songbook` | Lista do hinário (paginada) |
| `library-song` | Hino aberto: edição da letra e prévia das telas |
| `library-confession` | Confissão de Westminster: capítulos |
| `library-catechism` | Catecismo Maior: grade de perguntas |
| `library-creeds` | Credos |
| `present` | Apresentar: itens do culto, seções, telas, no ar / a seguir, Anterior/Próximo/Limpar |
| `connection` | Conexão → Estado: OBS, endereço e porta, atualização, registro |
| `connection-outputs` | Conexão → Saídas: uma Browser Source por saída, em cartões |
| `connection-output-editor` | Editor de saída: coleções, fonte, cor, alinhamento, "Linhas máximas" |
| `obs.png` | O overlay numa cena 1920×1080 (câmera simulada por um degradê) |

## Onde a página rola hoje (px)

| Tela | 1920×1200 | 1920×1080 | 1536×864 | 1280×720 |
| --- | --- | --- | --- | --- |
| `library-bible-chapter` | 408 | 267 | 219 | 219 |
| `library-song` | — | — | 173 | 317 |
| `liturgy` | — | — | — | 120 |
| `library-catechism` | — | — | — | 135 |
| `present` | — | — | — | 29 |

Nenhuma caixa interna rola e nada rola na horizontal. O capítulo da Bíblia só vira seções acima de
30 versículos (E11); Hb 12 tem 29 e por isso rola.

## Diferenças em relação à v1

- **OBS por HTTP, não obs-websocket.** O Gutenberg serve a página da Browser Source
  (`/overlay/<saída>`) e o JSON no formato do Holyrics. O desenho da faixa é dessa página.
- **Saídas.** Cada saída é uma URL ligada a um conjunto de coleções (ex.: Bíblia como lower third,
  hinos centralizados), com estilo próprio (fonte, cor, negrito, alinhamento, "Linhas máximas").
- **Sem rolagem:** listas paginadas pela altura da janela (hinários, CFW, cultos recentes, registro);
  itens longos em **seções** com uma faixa para pular (capítulos > 30 versículos, Sl 119 uma letra
  por seção, hinos por estrofe).
- **Busca na coleção** aberta da Biblioteca (número, título ou referência), além da busca rápida da nav.
- **Conexão em duas páginas** (Estado e Saídas), com a seção de atualização do app.
- **Overlay:** letra fixa em 5,2% da altura da fonte (`#text`) e 2,6% no cabeçalho; ignora
  "Linhas máximas" e a cor de fundo (`PLAN.md` → E15). No OBS a letra fica pequena.
