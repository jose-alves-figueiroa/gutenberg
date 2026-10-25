# Handoff v2: Gutenberg

## Overview
O Gutenberg é um app desktop (Electron) que substitui o Holyrics na igreja. Ele monta a liturgia, guarda a biblioteca (Bíblia ARA, HNC, Salmos genebrinos, Credos, Confissão e Catecismos de Westminster) e serve ao OBS telas limpas como lower third, por HTTP (`/overlay/<saída>`).

A v2 parte do app 0.2.3 e do pedido `proposals/v2/brief/BRIEF.md`. Ela traz:
- **(E16)** nenhuma tela rola em 1920×1200, 1920×1080, 1536×864 e 1280×720;
- **(E15)** overlay maior e configurável, com prévia 16:9;
- **(E17)** controle pelo celular;
- **(E18)** faixas de culto, sacramento e pregação;
- **(E19)** acesso de fora da rede da igreja, só a configuração.

## About the Design Files
Os arquivos em `design/` são **referências de design em HTML**: protótipos que mostram aparência e comportamento, **não código de produção**. A tarefa é recriar o design no app existente (Electron + React), com os padrões que ele já usa (`Pager`/`usePaging`, `OutputEditor.tsx`, `overlay.ts`, `payload.ts`).

| Arquivo | O quê |
| --- | --- |
| `design/GutenbergV2.dc.html` | Protótipo navegável. No topo, escolha a tela e a resolução. As abas, sub-abas, paginadores e controles do editor de saída funcionam. |
| `design/GutenbergV2Folha.dc.html` | Folha estática: 17 telas de desktop × 4 resoluções, 3 de celular e 6 de overlay. |
| `design/GutenbergOverlay.dc.html` | O desenho do overlay. É o mesmo componente das prévias do app, e é a especificação de `overlay.ts`. |
| `design/support.js`, `design/_ds/` | Runtime do protótipo e o design system. Não são para produção. |

Para abrir, sirva `design/` (`npx serve design`) e abra `GutenbergV2.dc.html`. Os ícones vêm do unpkg só no protótipo; o app continua com Phosphor duotone local.

## Fidelity
**Alta fidelidade.** Cores, tipografia, espaçamentos e estados são finais.
- **Interface:** usa só `brief/tokens.css`, sem nenhum token novo.
- **Overlay:** tem cores livres, decisão do operador.
- **Nomes de exemplo:** os de culto, pregador e título são marcadores; os reais vêm da Biblioteca › Faixas.

---

## Regras gerais

### Escala da interface
A interface é desenhada para uma **área lógica de 1440×810** e ampliada por igual em telas maiores:
`zoom = limitar(min(largura / 1440, altura / 810), 1, 1,333)`. No Electron, isso é `webContents.setZoomFactor(zoom)`, recalculado no `resize`.

| Janela | Zoom | Área lógica |
| --- | --- | --- |
| 1920×1200 | 1,333 | 1440×900 |
| 1920×1080 | 1,333 | 1440×810 |
| 1536×864 | 1,067 | 1440×810 |
| 1280×720 | 1 | 1280×720 |

### Sem rolagem
- **Altura fixa:** a área do app tem `altura lógica − 72` (nav). O padding é 20 px em cima e embaixo e 30 px dos lados.
- **Sem rolagem interna:** cada tela é grid ou flex com `min-height: 0`, e nenhum `overflow: auto`.
- **Paginação:** listas e grades paginam pela altura disponível: `por página = floor(espaço / altura da linha)`. As alturas são fixas para a conta ser exata:

| Elemento | Altura |
| --- | --- |
| Linha de lista | 44 px |
| Item da liturgia | 60 px |
| Item do Apresentar | 70 px |
| Cartão de tela | 140 px |
| Cartão de faixa | 112 px |
| Cartão de saída | 200 px |
| Célula de catecismo | 38 px (54 de largura) |

- **Paginador:**
  - `‹ Página x de y ›`, com texto em 13 px e botões ghost de 32 px.
  - A seta inativa fica com 35 % de opacidade.
  - Fica ancorado no rodapé da coluna (`margin-top: auto`) e some quando há uma página só.
- **Seções:** para conteúdo numerado (versículos, perguntas), uma faixa de botões `1–13 · 14–24 · 25–29`.
  - Cada botão tem 32 px de altura e borda `--color-divider`.
  - A seção ativa tem fundo `--color-accent-100` e não tem borda.
- **Teste:** deve falhar quando `document.scrollingElement.scrollHeight > clientHeight` em qualquer tela listada abaixo, nas 4 resoluções.

### Textos
pt-BR e **sem travessão (—)**. O traço meia-risca (–) aparece só em intervalos de referência (`12.14–15`). Os separadores são `·` e `›`.

### Nav (todas as telas de desktop)
- **Altura:** 72 px.
- **Itens, da esquerda para a direita:**
  - **Marca:** "Gutenberg", 22 px, peso 600.
  - **Abas:** Liturgia · Biblioteca · Apresentar · Conexão, com ícone de 18 px e texto de 15 px. A aba ativa tem fundo de accent a 12 % e texto `accent-700`.
  - **Busca rápida:** com `flex: 0 1 440px` e mínimo de 160 px. O placeholder é "Apresentar rápido: 1co · hb 12.14 · bc 1 · cfw 1.1". O comportamento é o mesmo da v1.
  - **Estado do OBS:** bolinha de 9 px, "OBS conectado" e "192.168.1.6 · 3 ms".

---

## Telas

### Liturgia (`liturgia`, `liturgia-pregacao`)
Três colunas: **Cultos** (200 px) | **Itens** (1fr) | **coluna de ação** (340 px), com espaço de 40 px entre elas.

- **Cultos:**
  - Cada culto tem nome em 15 px/600 e "N itens" em 12 px. O selecionado fica em tint de accent.
  - A lista pagina, e abaixo fica o botão ghost "+ Novo culto".
- **Itens:**
  - **Cabeçalho (90 px):** kicker "LITURGIA", o nome do culto em h2 34 px, o ghost "Excluir culto" e o primário "Apresentar este culto".
  - **Linhas (60 px):** colunas `28px | 100–150px | 1fr | auto`. Mostram nº, Momento (editável), título (17 px/600) com "coleção · N telas" e os botões ↑ ↓ ✕.
  - **Estados:** a seta ↑ do primeiro item e a ↓ do último ficam a 35 %. O paginador aparece quando os itens não cabem; em 720p, 8 itens viram 2 páginas.
- **Coluna de ação:** segmentado **Adicionar item | Pregação**.
  - **Adicionar item:**
    - **Coleções:** chips em três grupos, sempre com a Bíblia no topo: BÍBLIA (Bíblia ARA) · HINÁRIO E SALMOS (HNC, Salmos genebrinos) · DOUTRINA (Credos, CFW, Breve Catecismo, Catecismo Maior).
    - **Busca:** campo com placeholder conforme a coleção, por exemplo "Referência, ex.: hb 12.14-15".
    - **Resultados:** linhas de 36 px com ⊕; clicar adiciona ao fim da liturgia.
  - **Pregação** (`liturgia-pregacao`):
    - **Campos:** Pregador (lista de Biblioteca › Faixas › Pregadores), Título da pregação e Texto pregado.
    - **Prévia** da faixa de pregação, com 340 px.
    - **Nota:** "A faixa sai em Apresentar › Faixas. Os pregadores ficam em Biblioteca › Faixas."

### Biblioteca: estrutura comum
- **Duas colunas:** a lateral com 210 px e o conteúdo.
- **Lateral, em quatro grupos e nesta ordem:**
  - BÍBLIA (Bíblia ARA 66);
  - HINÁRIO E SALMOS (HNC, Salmos genebrinos);
  - DOUTRINA (Credos, CFW, Breve Catecismo, Catecismo Maior);
  - **FAIXAS** (Cultos e reuniões, Sacramentos, Pregadores).
- **Estados da lateral:** o item ativo é accent sólido com texto `--color-bg`, e o hover é `accent-100`.
- **Cabeçalho do conteúdo (178 px), de cima para baixo:**
  - Busca da coleção, com 42 px e máximo de 420 px. Com texto digitado, a borda fica accent.
  - Trilha de 24 px: os níveis anteriores em `accent-700`, o atual em texto normal.
  - Título em h2 32 px, com a dica em 14 px muted.
  - Ação secundária à direita, quando houver ("Novo hino", "Novo credo", "Novo culto ou reunião").

### Biblioteca › Bíblia › livros (`bib-livros`)
- **Grupos:** "ANTIGO TESTAMENTO" e "NOVO TESTAMENTO", com os **66 livros** em grade `auto-fill minmax(124px,1fr)`.
- **Células:** 32 px, fundo `--color-surface`, texto 14 px.
- **Interação:** clicar abre os capítulos.

### Biblioteca › Bíblia › capítulo (`bib-cap`, Hebreus 12 com 12.14–15 selecionado)
Duas colunas: versículos (1fr) e transmissão (340 px).
- **Seções:**
  - **Cálculo:** pela altura. Cada versículo ocupa `12 + 24 × ceil(caracteres / caracteres por linha)` px, e os caracteres por linha são `(largura da coluna − 52) / 8,4`.
  - **Abertura:** a seção que contém a seleção abre primeiro.
- **Versículo:** número em 13 px/600 `accent-700`, texto em 16/24 px.
  - **Selecionado:** fundo `accent-200`.
  - **Sem texto:** `neutral-700`.
- **Seleção:** um clique marca o primeiro versículo; um clique em outro estende o trecho; um clique fora de um trecho já marcado recomeça. A dica diz "Clique no primeiro versículo e depois no último, para um trecho".
- **Coluna "Como fica na transmissão · N telas":**
  - **Cartões (78 px):** cabeçalho de 10 px em caixa alta (`Hebreus 12.15 (2/3)`) e as **2 linhas reais** do OBS, uma por bloco, com reticências se passarem.
  - **Paginação:** os cartões paginam.
  - **Rodapé:** "Apresentar agora" (primário) e "Adicionar à liturgia" (secundário).

### Biblioteca › busca na coleção (`bib-busca`, Salmos genebrinos, "133")
- **Busca ativa:** borda accent.
- **Cabeçalho:** a trilha é "Salmos genebrinos › Busca", o título "Busca: 133" e a dica "2 resultados em Salmos genebrinos".
- **Resultados:** linhas de 44 px com nº (133A, 133B), título e versificação. Paginam.

### Biblioteca › Hinário Novo Cântico (`hinario`)
- **Linhas (44 px):** nº ou **s/nº** em `neutral-600`, título e autoria. Paginam.
- **Ação:** "Novo hino".

### Biblioteca › hino aberto (`hino`, Castelo forte)
Duas colunas: editor (1fr) e prévia (300 px), com uma barra de 52 px embaixo que ocupa a largura toda.
- **Editor:**
  - **Campos:** Número (90 px, placeholder "s/nº"), Título e Autoria, numa linha.
  - **Letra:** textarea com `flex: 1` que ocupa toda a altura restante e não redimensiona. O rótulo é "Letra: cada estrofe vira telas de 2 versos (separe as estrofes com linha em branco)".
- **Prévia:** "COMO FICA NA TRANSMISSÃO · N TELAS", em cartões de 78 px que paginam, e a nota "Estrofes definem as telas · 2 versos por tela".
- **Barra:** "Apresentar agora" e "Adicionar à liturgia". À direita, "Descartar" e "Salvar", desabilitados (45 %) sem alteração.

### Biblioteca › Confissão de Westminster (`cfw`)
- **Linhas (44 px):** os 33 capítulos, com nº, título e "k de N seções". Os capítulos sem nenhuma seção ficam com o título em `neutral-700`. Paginam.
- **Interação:** clicar abre as seções, que seguem como no app.

### Biblioteca › Catecismo Maior (`catecismo`) e Breve Catecismo
- **Grade:** células de 54×38 px, com `colunas = (largura + 4) / 58` (máx. 20) e `linhas = (altura − 42) / 42`.
- **Seções:** o que não cabe vira seções. Em 1280×720 ficam `1–144 · 145–196`.
- **Estados:** a pergunta cadastrada tem fundo `--color-surface`; a não cadastrada tem texto `neutral-600` e clicar nela cria a pergunta.

### Biblioteca › Credos (`credos`)
- **Linhas:** título e número de telas, ou "[texto a cadastrar]".
- **Ação:** "Novo credo".

### Biblioteca › Faixas › Cultos e reuniões (`faixas-lib`)
Duas colunas: lista (1fr) e prévia (de 340 a 520 px).
- **Lista:** linhas com "Nome na faixa", "Linha de apoio (opcional)" e ✕. A linha selecionada fica em `accent-100`.
- **Linha de apoio vazia:** a caixa "Sem linha de apoio, usar a data do culto" vem marcada.
- **Prévia:** "PRÉVIA · SAÍDA FAIXAS", mais os botões Salvar e Descartar.
- **Outras listas:** Sacramentos (Batismo, Santa Ceia do Senhor, com a linha de apoio editável, por exemplo "1 Coríntios 11.23–26") e Pregadores (só o nome) usam o mesmo layout.

### Apresentar (`apresentar`, `apr-faixas`)
Duas colunas: itens (250 px) e área principal.

- **Itens:**
  - **Kicker:** o nome do culto.
  - **Item (70 px):** Momento em 11 px caixa alta, título em 16/600 e coleção. O item no ar tem tint de accent e a marca "NO AR" em `accent-2-700`.
  - **Paginação:** os itens paginam.
- **Cabeçalho (90 px):** kicker e título. À direita, o segmentado **Liturgia | Faixas** e o botão "Limpar tela".
- **Modo Liturgia:**
  - **Grade de telas:**
    - **Tamanho:** `colunas = max(2, (largura + 15) / 255)`, com cartões de 140 px. Pagina, e em 720p o Credo fica com 6 + 2.
    - **Cartão:** cabeçalho com a posição (`Credo Apostólico · 1/8`) e a marca de estado. Cada linha do OBS é um bloco de 17 px.
    - **Estados:** no ar = fundo `accent-200` e "NO AR" em `accent-2-700`; a seguir = "A SEGUIR" em `accent-700`; as demais = `--color-surface`.
  - **Interação:** clicar num cartão põe a tela no ar.
  - **Rodapé fixo:**
    - **Anterior:** secundário, 56 px.
    - **Próximo:** primário, flex 1, com a 1ª linha da próxima tela em 12 px.
- **Modo Faixas** (`apr-faixas`):
  - **Cartões (112 px):** tipo (CULTO, SACRAMENTO, PREGAÇÃO), título em 17/600 e a linha de apoio em itálico. O estado aparece à direita: "NO AR" ou "ENVIAR".
  - **Interação:** clicar envia a faixa para a saída Faixas, e ela fica no ar até outra faixa ou "Tirar faixa".
  - **Nota:** "Clique numa faixa para enviá-la. As faixas saem na saída Faixas e não mudam a tela da liturgia que está no ar."
  - **Rodapé:** "Tirar faixa".

### Conexão: sub-abas
Estado · Saídas `4` · Controle remoto `2`. São botões com `inline-flex` e `nowrap`; a sub-aba ativa tem fundo `accent-100`, e as outras, borda `--color-divider`.

### Conexão › Estado (`con-estado`)
Duas colunas, com largura máxima de 1100 px.
- **Esquerda:**
  - Kicker "COMPUTADOR DO OBS" e o estado em h2 ("Conectado").
  - A nota "Os textos chegam ao OBS limpos: só referência e linhas, sem HTML."
  - A lista: Endereço IP · Latência · Último envio · **Versão** ("0.2.3 · atualização desligada nesta versão de desenvolvimento").
- **Direita:**
  - "Endereço deste computador" em 20 px/600 e a **Porta**, o único campo editável.
  - Os botões Reconectar e Testar.
  - A nota sobre o IP.
  - **Registro**, com hora e mensagem, paginado.

### Conexão › Saídas (`con-saidas`)
- **Topo:** a nota "Cada saída é uma Browser Source no OBS, do tamanho da cena, e mostra só as coleções ligadas a ela; nas outras, a tela fica limpa." e os botões "+ Nova saída" e "Restaurar saídas padrão".
- **Cartões:** em 2 colunas, com 200 px.
  - **Conteúdo:** bolinha, nome, `/slug` e estado, depois a URL com copiar, as coleções e um resumo do estilo ("Faixa inferior · 12 linhas · fundo 78%").
  - **Botões:** Editar e Remover.
  - **Paginação:** os cartões paginam.
- **Saídas padrão:** Bíblia `/bible` · Salmos e hinos `/songs` · Doutrina `/doctrine` · **Faixas `/faixas`** (nova).

### Conexão › editor de saída (`con-editor`)
Duas colunas: formulário (500 px) e prévia (o resto, até 960 px).
- **Topo do formulário:** Nome e Endereço (/overlay/...), lado a lado.
- **Segmentado Coleções | Letra | Faixa:**
  - **Coleções:** caixas de seleção em 2 colunas. "Todas as Bíblias" marcada desabilita a Bíblia ARA, que aparece como incluída em `neutral-600`. Inclui "Faixas de culto".
  - **Letra:**
    - **Estilo:** Fonte (Source Serif 4), Cor (seletor) e Negrito.
    - **Alinhamento:** Esquerda | Centro | Direita.
    - **Linhas máximas, textos (Bíblia e doutrina):** rótulo "12 linhas · letra de 69 px", com controle deslizante de 6 a 20.
    - **Linhas máximas, músicas:** rótulo "10 linhas · letra de 83 px", com o mesmo controle.
    - **Nota:** "Quantas linhas caberiam na altura da cena. Menos linhas, letra maior. A tela continua com no máximo 2 linhas; o cabeçalho tem metade do tamanho."
  - **Faixa:**
    - **Fundo:** cor, com Opacidade do fundo de 0 a 100 %.
    - **Largura:** Faixa inteira | Ajustada ao texto.
    - **Margem lateral:** 0 a 20 %.
    - **Distância da base:** 0 a 20 %.
    - **Contorno da letra:** Nenhum | Fino | Grosso.
    - **Sombra.**
- **Rodapé:** "Salvar saída" e "Cancelar".
- **Prévia:**
  - **Título:** "PRÉVIA AO VIVO · CENA 1920×1080", com o segmentado de exemplo Bíblia | Hino.
  - **Overlay:** atualiza a cada mudança.
  - **Legenda com a conta:** "Textos: 12 linhas máximas, letra de 69 px e cabeçalho de 35 px na cena."

### Conexão › Controle remoto (`con-celular`)
Uma tela só, para controlar a transmissão de outro aparelho. Duas colunas.
- **Parear um aparelho:**
  - **Texto:** "Aponte a câmera do celular ou tablet para o código e digite o PIN para controlar a transmissão."
  - **QR:** de 220 px, com a URL `/control`.
  - **PIN:** 6 dígitos em 44 px/600 (`482 913`), "Vale por 5 minutos" e "Gerar outro PIN".
  - **URL local:** `http://192.168.1.6:8484/control`.
- **Aparelhos pareados:**
  - **Linhas:** ícone, nome, "Android · visto agora" e **Revogar**.
  - **Nota:** "Revogar desconecta o aparelho na hora. Para voltar, ele precisa de um PIN novo."
- **Fora da rede da igreja (E19):**
  - **Chave:** segmentado Desligado | Ligado, com o estado ao lado.
  - **Detalhes:** a nota do estado e o endereço público (`…/control`) com Copiar.
  - **Aviso fixo:** "A rede da igreja continua sendo o caminho principal. Ligado, o QR ao lado passa a abrir o endereço público; o PIN continua obrigatório."
  - **Estados:**

  | Estado | Título | Nota | Endereço |
  | --- | --- | --- | --- |
  | Desligado | Desligado | O Gutenberg só responde na rede da igreja. | esmaecido |
  | Conectando | Conectando… | Publicando o endereço. Leva alguns segundos. | esmaecido |
  | No ar | No ar (`accent-700`) | Os aparelhos pareados também controlam de fora da rede da igreja. | ativo |
  | Erro | Não foi possível publicar (`accent-2-700`) | Sem resposta do serviço. Confira a internet e tente de novo; a rede da igreja continua funcionando. | esmaecido |

### Celular (`/control`, 390×844, funciona de 375 a 430 px)
- **Tema escuro com tokens:** fundo `neutral-900`, texto `neutral-100`, secundário `neutral-400`, marcas de "no ar" em `accent-2-300`.
- **Toque:** todos os alvos têm 44 px ou mais.

#### Parear (`m-parear`)
- **Textos:** a marca, "Parear este celular" (30 px) e "Digite o PIN que aparece no Gutenberg, em Conexão › Controle remoto."
- **PIN:** 6 caixas de 60 px. A caixa ativa tem borda `accent-400`.
- **Teclado numérico próprio:** 3×4, com teclas de 60 px e ⌫.
- **Botão:** "Parear", primário, com 56 px.
- **Estados:** com o PIN errado, as caixas ficam com borda `accent-2-400` e aparece "PIN incorreto ou vencido". Pareado, o aparelho vai para o Controle.

#### Controle (`m-controle`, `m-faixas`)
- **Cabeçalho (56 px):** marca e estado do OBS.
- **No ar:**
  - Kicker "NO AR · CONFISSÃO DE FÉ · TELA 1 DE 8", o título em 22/600 e as 2 linhas em 17 px.
  - Na aba Faixas, mostra "FAIXA NO AR" e a faixa.
- **Abas:** Itens | Faixas, com 44 px.
- **Lista:** é a **única área que rola**, com linhas de no mínimo 60 px.
  - **Itens:** tocar troca o item e põe a tela 1 no ar.
  - **Faixas:** tocar envia a faixa.
- **Rodapé fixo, na zona do polegar:**
  - **Itens:** **Anterior** (72 px, 1/3), **Próximo** (72 px, 2/3, primário) e **Limpar tela** (52 px, largura toda).
  - **Faixas:** só **Tirar faixa**.

### Overlay no OBS (`o-*`, 1920×1080)
Câmera simulada por `#4a4747`. A Browser Source tem o **tamanho da cena**.
- **Fonte:** Source Serif 4, local.
- **Tamanho da letra:** `font-size = altura / (linhas máximas × 1,3)`, ou seja `100vh / (linhas × 1,3)`. O cabeçalho tem metade desse tamanho, com 80 % de opacidade.
- **Textos (`o-biblia`, `o-doutrina`):**
  - **Posição:** faixa na base, com `left/right = margem lateral` (6 %) e `bottom = distância da base` (5 %).
  - **Fundo:** `#141212` a 78 %.
  - **Espaçamento interno:** `0,35em 0,7em`.
  - **Linhas:** no máximo 2, `nowrap`.
  - **Exemplos:** "Hebreus 12.15 (2/3) / nem haja alguma raiz de amargura que, / brotando, vos perturbe," e "Breve Catecismo · P. 1 / O fim principal do homem é glorificar a Deus, / e gozá-lo para sempre."
- **Hino (`o-hino`):** a mesma faixa, **centralizada na vertical**, com 10 linhas máximas (83 px).
- **Faixas (`o-culto`, `o-sacramento`, `o-pregacao`):**
  - **Posição:** bloco à esquerda, na base.
  - **Tipo:** 26 px, caixa alta, tracking 0,14em, `#8fd8f0`.
  - **Título:** 64 px/600.
  - **Linha de apoio:** 36 px, itálico.
  - **Exemplos:**
    - "CULTO / Culto Matutino / Domingo, 12 de outubro";
    - "SACRAMENTO / Santa Ceia do Senhor / 1 Coríntios 11.23–26";
    - "PREGAÇÃO / Rev. Ashbel Green Simonton / “A graça que educa” · Tito 2.11–14".
- **Opções vindas da saída:** cor, negrito, alinhamento, contorno (fino 1,5 px, grosso 3 px), sombra (`0 3px 14px rgba(0,0,0,.65)`) e largura (inteira ou ajustada).

---

## O que muda em relação ao app atual (0.2.3)

| Tela | Muda |
| --- | --- |
| Todas | Zoom da interface para preencher 1920×1080/1200. Nenhuma página rola. |
| Liturgia | "Adicionar à liturgia" sai de baixo dos itens e vai para a 3ª coluna, com o segmentado **Adicionar item / Pregação** (novo). Os itens paginam. Rolava 120 px em 720p. |
| Bíblia › livros | Mostra os 66 livros, e não só os que têm texto no seed. |
| Bíblia › capítulo | Seções pela altura, para qualquer capítulo, e não só acima de 30 versículos. A seção da seleção abre primeiro. A prévia e as ações vão para uma coluna à direita, com a prévia paginada. Rolava de 219 a 408 px. |
| Busca na coleção | Ganha trilha, título "Busca: 133" e contagem de resultados. |
| Hinário | O "·" vira **s/nº** esmaecido. |
| Hino aberto | Editor e prévia lado a lado; a textarea ocupa a altura que sobra. As ações ficam numa barra fixa. Rolava de 173 a 317 px. |
| CFW | Lista os 33 capítulos, e os capítulos sem seções ficam esmaecidos. Pagina. |
| Catecismo Maior | Grade calculada e seções `1–144 · 145–196`. Rolava 135 px em 720p. |
| Biblioteca › Faixas | **Nova:** Cultos e reuniões, Sacramentos e Pregadores. |
| Apresentar | Telas e itens paginam. O cartão mostra as 2 linhas reais e a posição (1/8). Novo segmentado **Liturgia / Faixas**. Rolava 29 px em 720p. |
| Conexão | As sub-abas passam a ser Estado · Saídas · **Controle remoto**. A versão vai para a lista do Estado. |
| Saídas | Nova saída padrão **Faixas** (`/faixas`). O cartão mostra o resumo do estilo. |
| Editor de saída | Organizado em segmentado (Coleções / Letra / Faixa). "Linhas máximas" separado para textos e músicas, com o resultado em px. Campos novos de faixa. **Prévia 16:9 ao vivo**. |
| Controle remoto | **Nova:** pareamento por QR + PIN, aparelhos com Revogar e "Fora da rede da igreja". |
| Celular | **Nova** rota `/control`. |
| Overlay | Source Serif 4 no lugar de Open Sans. A letra vem de `font_max_rows` (12 linhas = 69 px, antes fixa em 56 px). `background` passa a ser usado. Faixas de culto, sacramento e pregação. |

**Payload:** o formato do Holyrics não muda, e os campos novos entram como extras:
- **Faixa:** `band_opacity`, `band_margin_x`, `band_margin_y`, `band_width`.
- **Texto:** `text_stroke`, `text_shadow`.
- **Faixas de culto:** `kind` (`culto`, `sacramento`, `pregacao`), `kicker`, `title`, `subtitle`.

**`DEFAULT_STYLE`:** textos com 12 linhas e músicas com **10** (hoje 24, o que deixaria a letra menor).

---

## Decisões e dúvidas

### Decidido com o operador
- **Fonte do overlay:** Source Serif 4, a mesma da interface.
- **Cores do overlay:** livres; a regra de "só tokens" vale só para a interface.
- **Hinos:** continuam centralizados, só que maiores.
- **Tamanho da letra:** continua "Linhas máximas", com rótulo em px e prévia.
- **Faixas de culto, sacramento e pregação:** painel à parte, enviado a qualquer momento, fora da ordem da liturgia. Os nomes são configuráveis.
- **Pareamento:** QR + PIN.
- **Celular e acesso remoto:** juntos numa tela só, **Controle remoto**, porque a ação é a mesma (controlar de outro aparelho).
- **Celular:** Anterior/Próximo/Limpar, troca de item, faixas e pareamento.

### Decidido no design (pode ser revisto)
- **Zoom:** fator 1,333 em 1920. Se parecer grande demais, o teto pode baixar para 1,2 (área lógica de 1600×900).
- **Saída Faixas:** as faixas usam uma Browser Source própria, para aparecer junto de um versículo. O custo é uma fonte a mais no OBS.
- **Celular escuro:** o único lugar com superfície escura (o design system prefere papel claro), por legibilidade no escuro da igreja.
- **Pregação:** os dados ficam por culto (Liturgia › Pregação), e os pregadores são uma lista na Biblioteca.
- **Linha de apoio da faixa de culto:** quando vazia, usa a data do culto.
- **Padrões:** 12 linhas para textos e 10 para músicas, margem lateral de 6 %, base de 5 % e fundo a 78 %.

### Em aberto
1. **Faixa e texto ao mesmo tempo:** quando uma faixa e uma tela de texto estiverem no ar, as duas aparecem na base e podem se sobrepor. Há duas saídas:
   - a faixa sobe automaticamente acima do lower third de texto;
   - enviar uma faixa limpa o texto, e o inverso.

   Hoje o desenho supõe que o operador não usa as duas juntas.
2. **Tempo da faixa:** a faixa deve sair sozinha depois de N segundos (por exemplo 10 s) ou só por "Tirar faixa"?
3. **Celular e "a seguir":** o celular deve mostrar também a próxima tela, e não só a que está no ar?
4. **Vários aparelhos:** podem controlar ao mesmo tempo, ou vale o último comando?
5. **Serviço do acesso remoto** (E19): Tailscale, Cloudflare Tunnel ou ngrok. Com Cloudflare quick tunnel, a URL muda a cada execução, e o QR precisa ser gerado de novo.
6. **Seções do CFW e catecismos:** as perguntas e seções não cadastradas aparecem esmaecidas e abrem o editor ao clicar. Confirmar se o operador quer isso também nos capítulos da CFW.
7. **Teclado:** a v1 tinha atalhos (←/→ e Esc para limpar). Manter e documentar no celular? Hoje não há atalhos lá.
