# Origem do handoff v2

Escrito por nós; o resto desta pasta é do Claude Design.

- **Fonte:** artefato https://claude.ai/artifact/L3vDrXQsHohAhHj5EXmiDf, lido em 2026-10-25.
- **Formato recebido:** uma página empacotada (bundler do Claude Design) com os arquivos dentro.
  Não veio `README.md` de especificação.

## Como foi extraído

| Arquivo | Origem |
| --- | --- |
| `design/GutenbergV2.dc.html` | Protótipo navegável: escolha da tela e da resolução. Byte a byte como veio. |
| `design/GutenbergOverlay.dc.html` | Overlay 1920×1080 (texto de apoio e faixas). Byte a byte como veio. |
| `design/GutenbergV2Folha.dc.html` | A página principal do artefato: todas as telas numa folha. Reconstruída do template do bundle: os identificadores internos viraram `./support.js` e os arquivos de `_ds/`, o CSS do design system embutido voltou a ser o link para `_ds/.../styles.css`, e o selo do Claude Design foi retirado. Nenhuma tela mudou. |
| `design/support.js`, `design/_ds/` | Idênticos aos da v1 (conferido byte a byte; o `styles.css` difere só porque o bundle trocou o `@import` do Google Fonts pelas fontes embutidas). Copiados da v1. |

Os ícones (Phosphor duotone) vêm do unpkg, como no protótipo da v1. No app, os ícones são o
`@phosphor-icons/react` local, com o mesmo peso.

## Para abrir

Sirva a pasta `design/` por HTTP (o `support.js` carrega as telas com `fetch`), por exemplo
`npx serve design/proposals/v2/handoff/design`, e abra `GutenbergV2Folha.dc.html` ou
`GutenbergV2.dc.html`.
