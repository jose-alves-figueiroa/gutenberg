# Épicos E15–E19 (cópia do PLAN.md em 3d0c9d7)

### E15 — Estilo do overlay configurável por saída
O operador usou o overlay no OBS e a letra do lower third ficou pequena: a página fixa o tamanho
(`#text` 5,2vh, `#header` 2,6vh em `src/main/server/overlay.ts`) e ignora o `font_max_rows` que a
saída já envia. Como vh é relativo à altura da Browser Source, uma fonte com altura menor que a
da cena, ou reduzida no canvas do OBS, também encolhe a letra.

**US15.1** Como operador, quero ajustar o tamanho da letra de cada saída pelo Gutenberg.
- [ ] O overlay usa `font_max_rows`: `font-size = 100vh / (linhas × 1,3)`; 15 linhas ≈ tamanho de hoje, e menos linhas deixam a letra maior. Header com metade do tamanho do texto
- [ ] Rever os padrões (`DEFAULT_STYLE` em `src/shared/payload.ts`): hinos usam 24 linhas, o que deixaria a letra menor que hoje
- [ ] Teste do overlay com `font_max_rows` (jsdom)

**US15.2** Como operador, quero configurar o restante do visual da saída: margens/posição da faixa, contorno/sombra e cor de fundo da faixa (hoje `background` vai no payload e é ignorado).
- [ ] Campos no editor de saída (`OutputEditor.tsx`), schema `PayloadStyle` e chaves no payload. O que um overlay do Holyrics não conhece entra como extra, como `seq`
- [ ] Prévia do overlay no editor, com a proporção da cena (16:9)

**US15.3** Documentação
- [ ] `docs/OBS.md`: Browser Source do tamanho da cena, sem redimensionar no canvas; o tamanho da letra vem de "Linhas máximas". Linha "Texto pequeno" na tabela de problemas

### E16 — Telas sem rolagem em notebooks de 14–16"
O app roda em notebooks de 14 a 16 polegadas com tela de ~1920×1080/1200 e escala do sistema de
100 a 150%, ou seja, janelas úteis entre ~1280×720 e 1920×1200. Nenhuma página pode rolar: o que
não cabe vira página (como na E9 e na E13).

**US16.1** Levantamento
- [ ] Percorrer cada aba e estado (Liturgia, Biblioteca e cada coleção, Apresentar, Conexão/Estado/Saídas/editor, atualização) nas dimensões 1920×1200, 1920×1080, 1536×864 (125%) e 1280×720 (150%), com o `npm run screenshots` (E12), e registrar aqui onde rola e quantos px

**US16.2** Paginação no lugar da rolagem
- [ ] Corrigir cada ponto do levantamento com `Pager`/`usePaging` (E12) ou cartões paginados (E13); incluir os restos registrados na E11 (Catecismo Maior) e na E13 (Estado e editor de saída)
- [ ] Teste/screenshot que falha se `document.scrollingElement` rolar nessas dimensões

### E17 — Controle mobile da transmissão
Uma página servida pelo Gutenberg, pensada primeiro para o celular, para mandar comandos à
transmissão: próximo/anterior, limpar tela, escolher item da liturgia e os lower thirds da E18.

**US17.1** Como operador auxiliar, quero controlar a transmissão pelo celular.
- [ ] Rota `/control` (HTML/CSS/JS empacotados, offline, mobile first, alvos de toque ≥ 44 px) com o culto do dia, o item e a tela no ar, e os botões Próximo/Anterior/Limpar
- [ ] Os comandos reaproveitam as rotas de apresentação, hoje `localOnly`. Precisam de autenticação (token/PIN pareado por QR code na aba Conexão), revogável
- [ ] Estado ao vivo por SSE, como o overlay
- [ ] Funciona pela LAN e pelo túnel da E19 (quando existir)

### E18 — Lower thirds de culto, sacramentos e pregação ⛔ bloqueado (aguarda o design do operador)
Faixas que não são texto de apoio:
- **Culto/reunião:** Culto Matutino, Culto Vespertino, EBD, Reunião de Doutrina etc. (lista como dado, não código)
- **Sacramentos:** Batismo e Santa Ceia do Senhor
- **Pregação:** nome do pregador, título da pregação e texto pregado

- [ ] ⛔ Design das faixas (operador)
- [ ] Modelo de dados (tipo de item da liturgia ou coleção nova), payload e overlay
- [ ] Envio pela Liturgia/Apresentar e pelo controle mobile (E17)

### E19 — Acesso fora da rede local sem IP fixo
Hoje o OBS precisa estar na mesma LAN e apontar para o IP do operador, que muda. O próprio app
deve publicar o servidor num endereço estável em Windows, macOS e Linux, de graça.

**US19.1** Decisão do túnel
- [ ] Comparar e decidir, registrando aqui: **Tailscale** (rede privada, gratuito até 3 usuários/100 dispositivos; exige instalar e entrar na conta nos dois PCs), **Cloudflare Tunnel** (`cloudflared` empacotado no app; o *quick tunnel* é grátis e sem conta, mas a URL muda a cada execução; URL fixa exige domínio próprio na Cloudflare) e **ngrok** (grátis com conta e 1 domínio fixo; limites de tráfego e página de aviso no plano gratuito, que pode atrapalhar a Browser Source). Critérios: custo zero, URL estável, empacotável nos 3 sistemas, latência, funcionar com o SSE, segurança
- [ ] Por ora a LAN continua sendo o caminho principal: o túnel é opcional

**US19.2** Integração (depois da decisão)
- [ ] Binário/serviço empacotado no `electron-builder` para os 3 sistemas, iniciado e parado pelo app; endereço público na aba Conexão
- [ ] Rotas públicas continuam só `/overlay` e `/api/v1/health`; o controle remoto (E17) só com autenticação
