# Handoff: Gutenberg — projeção de liturgia para OBS

## Overview
Gutenberg substitui o Holyrics na igreja. É um app desktop (Electron) usado por **um operador** num computador; um **segundo computador roda o OBS** e recebe o texto via rede local (Wi-Fi). O app cobre três rotinas:
1. **Cadastrar a liturgia** de cada culto (ordem dos itens).
2. **Manter a biblioteca** — corrigir/cadastrar salmos genebrinos, hinos do HNC, credos, Confissão de Westminster (CFW), Breve Catecismo e Catecismo Maior. A Bíblia ARA é somente leitura.
3. **Apresentar** — enviar tela a tela para o OBS como lower third (faixa inferior sobre a câmera). A composição visual (câmera, faixa, fonte) fica no OBS; o Gutenberg só envia **dados limpos**.

Problemas que motivaram o projeto: o Holyrics envia HTML misturado no texto (`<ctt>`, `&nbsp;`, `<span style=...>`, ver `reference/holyrics-payload-exemplo.json.txt`), textos longos (CFW, catecismo) quebram mal na tela, e a rede Wi-Fi é instável.

## About the Design Files
Os arquivos em `design/` são **referências de design feitas em HTML** — um protótipo navegável mostrando aparência e comportamento, **não código de produção**. A tarefa é **recriar esse design** num app Electron real (sugestão: Electron + Vite + React + TypeScript, SQLite via `better-sqlite3`). Para abrir o protótipo: sirva a pasta `design/` com um servidor estático (`npx serve design`) e abra `Gutenberg.dc.html`. Toda a lógica do protótipo (dados de exemplo, algoritmo de quebra, busca rápida, navegação) está na classe `Component` no fim desse arquivo — leia-a como especificação.

## Fidelity
**Alta fidelidade.** Cores, tipografia, espaçamentos e estados são finais (design system "Broadsheet", `design/_ds/.../styles.css`). Recrie com fidelidade.

## Arquitetura recomendada
```
[PC do operador: Gutenberg (Electron)]  --Wi-Fi-->  [PC do OBS: obs-websocket :4455]
                                                         |
                                                 Browser Source "overlay.html"
                                                 (local no PC do OBS, conecta em ws://localhost:4455)
```
- Gutenberg conecta ao **obs-websocket v5** (já embutido no OBS 28+) no IP do PC do OBS, porta configurável (padrão 4455). Use `obs-websocket-js`.
- Envia cada tela via `BroadcastCustomEvent` com o payload abaixo.
- O **overlay** é um HTML estático instalado no PC do OBS como Browser Source. Ele mesmo conecta em `ws://localhost:4455` (local, sem Wi-Fi), escuta os eventos e desenha a faixa. **Se o Wi-Fi cair, o overlay continua mostrando o último texto.**
- Ao reconectar, o Gutenberg **reenvia o estado atual** (último `seq`). O overlay ignora `seq` menor que o último recebido.
- IP do OBS: descoberto automaticamente (mDNS/broadcast UDP ou configurado uma vez em arquivo de config pelo técnico). **Na UI o IP é só exibido; o operador só pode mudar a porta.** Não há troca de rota de rede na UI.

### Payload (substitui o JSON do Holyrics)
```json
{
  "v": 1,
  "seq": 128,
  "type": "BIBLE | MUSIC | CREED | CONFESSION | CATECHISM | CLEAR",
  "header": "Hebreus 12.15 (2/3)",
  "lines": ["nem haja alguma raiz de amargura que,", "brotando, vos perturbe,"],
  "meta": { "collection": "biblia", "itemId": "bib-Hb-12-14-15", "slide": 2 }
}
```
Sem HTML, sem `&nbsp;`. No máximo 2 linhas. Estilo (fonte, cor, alinhamento) é responsabilidade do overlay/OBS.

## Screens / Views
O layout é uma página de fluxo único: a nav fica no topo, e cada aba ocupa a área abaixo dela. O conteúdo fica alinhado à esquerda, com espaço livre à direita. As seções são separadas **por espaço em branco**, sem bordas nem caixas.

### Nav (sempre visível)
- **Marca:** "Gutenberg", 22px, 600, `letter-spacing:-0.02em`.
- **Abas:** Liturgia · Biblioteca · Apresentar · Conexão. Cada aba tem ícone Phosphor duotone 18px e texto 15px, com padding 8×12. A aba ativa tem fundo `color-mix(accent 12%)` e texto `--color-accent-700`.
- **Busca rápida:** campo de comando, flex `1 1 280px`, máx. 440px, fundo `--color-surface` e borda `--color-divider`. Detalhes em Interações.
- **Status da conexão:** bolinha de 9px (accent = ok, neutral-500 = instável, accent-2 = sem resposta), rótulo e o texto "192.168.0.12 · 18 ms". Clicar abre a aba Conexão.

### Liturgia
- **Grid:** `minmax(190px,240px) | 1fr`, gap 40px.
- **Coluna esquerda:** lista de cultos (nome + "N itens"), com o selecionado em tint de accent, e o botão ghost "+ Novo culto".
- **Coluna principal (máx. 880px):**
  - **Cabeçalho:** kicker "LITURGIA", o nome do culto em h2 34px e o botão primário "Apresentar este culto".
  - **Linhas da liturgia:** grid `28px | minmax(110px,180px) | 1fr | auto`. As colunas são: nº, **Momento** (input editável e transparente, ex.: "Adoração", "Leitura"), título com "coleção · N telas", e os botões ↑ ↓ ✕.
  - **"Adicionar à liturgia":** chips de coleção agrupados como **Bíblia** | **Hinário e salmos** (HNC, Salmos genebrinos) | **Doutrina** (Credos, CFW, Breve Catecismo, Catecismo Maior). Abaixo, um campo de busca e os resultados em grid `auto-fill minmax(240px,1fr)`.
  - **Bíblia no picker:** ao digitar um livro, a lista mostra os livros; com uma referência completa (`hb 12.14-15`), aparece "Adicionar Hebreus 12.14–15".

### Biblioteca (hierárquica)
- **Grid:** `minmax(170px,210px) | 1fr`.
- **Coluna esquerda:** coleções em 3 grupos, com a **Bíblia sempre no topo** em qualquer menu: Bíblia → Hinário e salmos → Doutrina.
- **Área principal:** breadcrumb clicável (`Bíblia › Hebreus › Capítulo 12`), título h2 32px e uma dica de 14px.
- **Navegação por coleção:**
  - **Bíblia:** Livro (grid de nomes, separado em AT/NT) → Capítulo (grid de números) → Versículos (lista). Para escolher um trecho, clique no 1º e depois no último versículo; o trecho fica destacado em `--color-accent-200`. Somente leitura.
  - **CFW:** Capítulo (lista dos 33 títulos + "k de N seções") → Seção (grid de números) → Editor (texto corrido).
  - **Catecismos:** grid com as perguntas 1–107 (Breve) ou 1–196 (Maior) → Editor (pergunta + resposta).
  - **Salmos:** grid 1–150 → Versões (133A, 133B…, mais o botão "Nova versão") → Editor (nº, versão, versificação, letra por estrofes).
  - **HNC e Credos:** lista → Editor.
- **Estados nos grids:**
  - **Cadastrado:** fundo `--color-surface`, texto `--color-text`.
  - **Não cadastrado:** fundo transparente, texto `--color-neutral-600`. Clicar cria o registro vazio e abre o editor; é assim que se cadastram perguntas e seções que faltam.
- **Folha (item escolhido):**
  - **Prévia:** "Como fica na transmissão · N telas", em grid de cartões `minmax(210px,1fr)` com cabeçalho e texto.
  - **Barra sticky:** "Apresentar agora" (primário), "Adicionar à liturgia" e, à direita, Descartar / Salvar. Os dois ficam desabilitados sem alterações. Salvar mostra "Salvo — vale para todas as liturgias".

### Apresentar
- **Grid:** `minmax(200px,260px) | 1fr`.
- **Coluna esquerda:** itens da liturgia, cada um com Momento (caps 11px), título 16px/600 e coleção. Um item vindo da busca rápida entra no topo como **"Avulso"**, com botão ✕ para tirar.
- **Área principal:**
  - **Cabeçalho:** "Momento · Coleção", o título em h2 34px e o botão "Limpar tela" / "Mostrar texto".
  - **Cartões de tela:** grid `auto-fill minmax(230px,1fr)`, gap 15px, min-height 96px. Fundo `--color-surface`; a tela no ar fica em `--color-accent-200` com a marca "NO AR" em `--color-accent-2-700`, e a próxima recebe "A SEGUIR". Texto 18px, line-height 1.4, `white-space:pre-line`.
  - **Barra inferior sticky:** "Anterior" (secundário, 56px de altura) e "Próximo" (primário, flex 1), com a 1ª linha da próxima tela em 12px. No fim de um item, Próximo passa para o próximo item da liturgia.
- **Sem pré-visualização da câmera:** isso já existe no OBS.

### Conexão
Duas colunas, com `auto-fit minmax(300px,1fr)`.
- **Esquerda:** o estado em h2 (Conectado / Conexão instável / Sem resposta), uma nota e uma lista de definições: Endereço IP, Porta, Latência e Último envio.
- **Direita:**
  - IP exibido em 20px/600, sem edição.
  - Campo **Porta**, o único editável: só números, até 5 dígitos.
  - Botões **Reconectar** e **Testar**.
  - Nota de rodapé.
  - **Registro de eventos**, com hora e mensagem.

## Interações & comportamento
### Busca rápida (estilo Holyrics), na nav, em qualquer aba
- **Livro:** digitar `1` lista 1Sm, 1Rs, 1Cr, 1Co, 1Ts, 1Tm, 1Pe, 1Jo, e `1c` lista 1Cr e 1Co. Os livros são comparados pela abreviação ou pelo nome, sem acento e sem diferenciar maiúsculas. ↑↓ escolhe e Enter confirma o livro.
- **Capítulo e versículo:** depois do livro, ele vira uma tag dentro do campo e o placeholder muda para "capítulo.versículo". Aceita `13`, `13.4` ou `13.4-7` (também `:`). **Enter apresenta.** Backspace com o campo vazio volta ao livro, e Esc cancela.
- **Referência direta:** digitar `hb 12.14-15` e Enter apresenta direto.
- **Prefixos de doutrina e cânticos:** `bc 1` (Breve Catecismo), `cm 1` (Catecismo Maior), `cfw 1.1`, `sg 133` (salmo genebrino), `hnc <nº/título>`, `credo <nome>`.
- **Ao apresentar:** o item entra como "Avulso" no topo da Apresentação, já no ar na tela 1, sem alterar a liturgia salva.
- **Ordem dos resultados:** a Bíblia aparece sempre primeiro.

### Quebra automática de telas — crítico
Implementar exatamente como `autobreak()` no protótipo. O limite padrão é de 96 caracteres por tela, ajustável de 60 a 160; deve virar uma configuração.
1. Uma linha em branco no texto **força** uma quebra.
2. Um segmento que cabe no limite vira uma tela só.
3. Um segmento maior é dividido em frases nas pausas (`, ; : . ! ?`). Uma frase que sozinha passe do limite é dividida em pedaços equilibrados por palavras.
4. As frases são agrupadas, em ordem, até o limite.
5. Se a última tela ficar com menos de 30% do limite e couber junto da anterior (até 120% do limite), as duas se juntam.
6. Cada tela vira **2 linhas equilibradas**: a quebra fica no espaço mais perto do meio, com preferência para depois de vírgula, ponto e vírgula ou dois-pontos. A tela só não é quebrada se for curta, com até 55% do limite.
7. Cânticos (Salmos/HNC) **não** usam a quebra automática: cada estrofe é uma tela.

**Cabeçalhos por coleção:**
- **Bíblia:** `Hebreus 12.15`, mais ` (i/n)` quando um versículo ocupa várias telas.
- **CFW:** `CFW 1.1`.
- **Catecismo:** `Breve Catecismo · P. 1 · pergunta` na pergunta e `Breve Catecismo · P. 1` nas telas da resposta.
- **Credo:** o nome do credo.
- **Salmo:** `Salmo 133B`.

### Outros
- **Limpar tela:** envia `type: CLEAR`, e o botão alterna para "Mostrar texto".
- **Estados de interação:** hover em tint de accent (`--color-accent-100`). Foco com `outline 2px var(--color-accent)` e `offset 2px`. Itens desabilitados ficam com 45% de opacidade.
- **Responsivo:** é uma janela desktop com largura mínima recomendada de 1100px; abaixo disso as colunas devem empilhar.

## State management e dados
- **Banco local (SQLite):** tabelas `cultos`, `liturgia_itens(culto_id, ordem, momento, colecao, item_ref)`, `salmos(num, versao, versificacao, letra)`, `hinos(num, titulo, autoria, letra)`, `credos`, `cfw(cap, sec, texto)`, `catecismo(tipo, q, pergunta, resposta)`. A Bíblia ARA fica numa tabela à parte, somente leitura (`livro, cap, vers, texto`). **Atenção:** a ARA é protegida por direitos da SBB, e o texto deve vir da licença que a igreja já possui.
- **Referência estável:** `item_ref` é estável (para a Bíblia, `Hb:12:14-15`). Editar um item da biblioteca vale para todas as liturgias.
- **Estado de apresentação:** `{cultoId, adhoc?, liveIdx, slideIdx, blank, seq}`, persistido no disco para sobreviver a um reinício no meio do culto.
- **Conexão:** `{status, latencyMs, lastSentSeq, log[]}`. Ping a cada 2 s; mais de 500 ms conta como instável, e 3 falhas seguidas como sem resposta. A reconexão é automática, com backoff (1 s, 2 s, 4 s, máx. 8 s).
- **Importação inicial:** escrever um script que lê o banco de dados ou a exportação do Holyrics, se disponível, e limpa o HTML (`<ctt>`, `<desc>`, `&nbsp;`, `<span>`).

## Design tokens (Broadsheet)
- **Cores:**
  - Base: `--color-bg #f3f2f2` · `--color-surface #eae9e9` · `--color-text #201e1d`.
  - Accent: `--color-accent #0088b0` (100 `#e9f8ff`, 200 `#cbeeff`, 600 `#1186ac`, 700 `#006786`, 800 `#004961`).
  - Accent 2: `--color-accent-2 #d6006c` (700 `#aa0b56`).
  - Neutros: neutral-500 `#9b9797`, 600 `#7d7979`, 700 `#605d5d`, 800 `#444141`.
  - Divisor: `--color-divider` = texto a 16%.
- **Tipografia:** Source Serif 4 em tudo (400, 600, itálico 400), sem sans-serif. Corpo em 15px, line-height 1.55. h2 34/32px, h3 25px, h4 20px, h6 13px em caixa alta com tracking 0.08em.
- **Espaçamento:** 5, 10, 15, 20, 30, 40px (`--space-1/2/3/4/6/8`).
- **Raio:** 1, 2, 4px. **Sombras:** `--shadow-md 0 3px 10px rgba(45,43,43,.16)`, usada no dropdown da busca.
- **Componentes:** `.btn` (primário, secundário, ghost, ícone), `.input`, `.field`, `.tag`, `.seg`, `.nav`. Ver `styles.css`.
- **Ícones:** Phosphor, peso **duotone** (`@phosphor-icons/web` ou `@phosphor-icons/react`).

## Assets
Não há imagens. Os ícones são Phosphor duotone e a fonte é Source Serif 4 (Google Fonts); empacote os dois localmente, porque o app precisa funcionar offline.

## Files
- `design/Gutenberg.dc.html`: o protótipo completo. A lógica e os dados de exemplo estão na classe `Component`.
- `design/support.js`: o runtime que faz o protótipo abrir no navegador. Não é para produção.
- `design/_ds/.../styles.css`: tokens e componentes do design system.
- `reference/holyrics-payload-exemplo.json.txt`: exemplo do JSON que o Holyrics envia hoje e que deve ser substituído.

## Plano de implementação sugerido (fases)
1. **Base:** Electron, Vite, React e TypeScript, com tokens e fontes locais, a nav e as 4 abas vazias.
2. **Dados:** SQLite com o schema acima, seed com os dados do protótipo e importação da ARA.
3. **Quebra de telas:** `autobreak` com testes unitários, usando os textos da CFW 1.1 e de Hb 12.15 como casos.
4. **Biblioteca:** navegação hierárquica e editores.
5. **Liturgia:** CRUD dos cultos e o picker agrupado.
6. **Apresentar e busca rápida.**
7. **Conexão:** obs-websocket, o overlay HTML para o OBS, reenvio do estado, a aba Conexão e o registro de eventos.
8. **Empacotamento:** `electron-builder` para Windows e a instalação do overlay no PC do OBS.
