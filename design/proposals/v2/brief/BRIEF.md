# Pedido v2 — Gutenberg

**Para:** Claude Design · **Base:** proposta v1 (`design/proposals/v1/`) · **App real:**
`design/implemented/0.2.3/` · **Data:** 2026-10-25

O Gutenberg é um app desktop (Electron) que substitui o Holyrics numa igreja: monta a liturgia do
culto, guarda a biblioteca (Bíblia ARA, hinos, salmos, credos, Confissão e Catecismos de
Westminster) e envia telas limpas para o OBS, que transmite o culto com o texto em lower third.
A v1 foi implementada até a versão 0.2.3. Este pedido traz o que o app é hoje e o que precisa mudar.

## O que você recebe

| Onde | O quê |
| --- | --- |
| `design/implemented/0.2.3/` | Cada tela do app em 4 resoluções: `.html` (DOM real, CSS embutido) e `.png`. `NOTES.md` lista as telas, onde rolam e o que mudou desde a v1. **Comece por aqui.** |
| `design/proposals/v1/` | A proposta original (`README.md` e o protótipo `design/Gutenberg.dc.html`) |
| `brief/tokens.css` | Os tokens Broadsheet em uso no app |
| `brief/epics.md` | Os épicos E15–E19 do plano, com o contexto técnico de cada um |

Os `.html` são a fonte principal: ajuste a partir deles em vez de redesenhar do zero.

## O que pedimos

### 1. Ajustar o que existe: nenhuma página rola (E16)
O app roda em notebooks de 14–16". Toda tela tem de caber, sem rolagem, em **1920×1200, 1920×1080,
1536×864 e 1280×720**. Onde não couber, a solução é paginar (como as listas e as seções que já
existem), não rolar. Os pontos que rolam hoje estão em `NOTES.md` (capítulo da Bíblia, hino aberto,
Liturgia, Catecismo Maior e Apresentar). Aproveite para corrigir o que achar inconsistente entre as
telas, sempre dentro dos tokens.

### 2. Overlay e editor de saída (E15)
O texto no OBS ficou pequeno: a faixa usa um tamanho fixo (`obs.png`). Queremos:
- a **faixa do lower third** desenhada (texto de apoio: referência + até 2 linhas), sobre câmera,
  em 1920×1080, para Bíblia/doutrina e para hinos (hoje centralizados);
- no **editor de saída** (`connection-output-editor`): tamanho da letra (hoje "Linhas máximas"),
  margens/posição da faixa, sombra/contorno, cor e fundo da faixa, e uma **prévia 16:9** ao vivo.

### 3. Controle pelo celular (E17)
Página **mobile first** (375–430 px de largura, retrato) servida pelo Gutenberg, para um auxiliar
comandar a transmissão: culto do dia, item e tela no ar, **Anterior / Próximo / Limpar**, escolher
outro item da liturgia e enviar os lower thirds do item 4. Alvos de toque ≥ 44 px, uso com uma mão,
legível no escuro da igreja. No desktop (aba Conexão), o **pareamento** do celular por QR code/PIN
e a lista de aparelhos pareados, com revogar.

### 4. Lower thirds que não são texto de apoio (E18)
Desenhe as faixas e como o operador as escolhe e envia (Liturgia/Apresentar e celular):
- **Culto/reunião:** Culto Matutino, Culto Vespertino, EBD, Reunião de Doutrina… (lista editável);
- **Sacramentos:** Batismo e Santa Ceia do Senhor;
- **Pregação:** nome do pregador, título da pregação e texto pregado.

### 5. Acesso remoto: só a configuração (E19)
Ainda não escolhemos o serviço (Tailscale, Cloudflare Tunnel ou ngrok). Desenhe a seção
**"Acesso remoto"** da aba Conexão sem depender dele: ligar/desligar, estado (desligado, conectando,
no ar, erro), endereço público com copiar/QR code e um aviso de que a LAN continua sendo o caminho
principal.

## Restrições (não negociáveis)

- **Tokens Broadsheet** (`tokens.css`): não inventar cores, tamanhos ou espaçamentos fora deles.
- **Offline:** fontes e ícones locais, nenhuma URL externa.
- **OBS:** no máximo **2 linhas** por tela de texto, sem HTML no conteúdo.
- **Textos da interface em pt-BR, sem travessão (—).** O conteúdo (Bíblia, hinos, credos) é em português.
- **Sem rolagem** nas 4 resoluções do desktop (item 1). O celular pode rolar só a lista de itens.
- O formato dos dados enviados ao OBS (o JSON do Holyrics) não muda: campos novos entram como extras.

## O que devolver

Um pacote no formato da v1, para guardar em `design/proposals/v2/handoff/` sem edição:
- `README.md` com a especificação: telas, estados, interações, e o que mudou em relação ao app atual;
- protótipo HTML com todas as telas (desktop nas 4 resoluções, celular, overlay em 1920×1080);
- tokens novos, se houver, explicados (de preferência nenhum);
- para o item 4, uma tela por tipo de faixa com textos reais de exemplo.
