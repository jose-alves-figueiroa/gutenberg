# Instalar o Gutenberg e ligar ao OBS

O Gutenberg roda no computador do operador. O OBS, em outro computador da mesma rede, lê os textos
pelo endereço HTTP do Gutenberg: uma **Browser Source** por saída (Bíblia, Salmos e hinos,
Doutrina, ou as saídas que você criar na aba Conexão).

```
PC do operador (Gutenberg)  ── rede local ──▶  PC do OBS (Browser Source)
http://<ip-do-operador>:8484/overlay/bible
```

## 1. Gerar os instaladores (mantenedor)

Os textos da biblioteca ficam cifrados no repositório; o instalador leva o banco gerado a partir
deles. **O instalador contém os textos em claro** — não publique os arquivos em lugar público.

```sh
npm run data:unlock      # senha em .env (GUTENBERG_DATA_PASSWORD)
npm run data:build       # data/build/gutenberg.sqlite
npm run dist:mac         # release/<versão>/Gutenberg-<versão>-mac-arm64.dmg
npm run dist:win         # release/<versão>/Gutenberg-<versão>-win-x64.exe
npm run dist:linux       # release/<versão>/Gutenberg-<versão>-linux-amd64.deb (+ AppImage)
```

Os três saem de um Mac. Também há o workflow manual **installers** no GitHub Actions
(`Actions → installers → Run workflow`), que precisa dos segredos `GUTENBERG_DATA_PASSWORD` e
`GUTENBERG_DATA_KEY_GPG` (o resultado de `base64 -i .secrets/gutenberg-data.key.gpg`). Os
instaladores ficam 3 dias como artefatos do workflow.

## 2. Instalar no computador do operador

### Windows
1. Execute `Gutenberg-<versão>-win-x64.exe` e aceite o pedido de administrador.
2. O Windows pode avisar "O Windows protegeu o computador" (instalador sem certificado):
   **Mais informações → Executar assim mesmo**.
3. O instalador cria a regra de firewall **Gutenberg** (entrada, redes privadas e de domínio), válida
   para qualquer porta. A rede da igreja deve estar como **Privada** em
   Configurações → Rede e Internet. A desinstalação remove a regra.

### macOS (Apple Silicon)
1. Abra o `.dmg` e arraste o Gutenberg para **Aplicativos**.
2. Na primeira vez, o macOS bloqueia o app (sem conta de desenvolvedor da Apple, ele tem assinatura
   ad-hoc). Abra **Ajustes do Sistema → Privacidade e Segurança** e clique em
   **Abrir Mesmo Assim** ao lado de "Gutenberg". Se aparecer "está danificado", rode
   `xattr -dr com.apple.quarantine /Applications/Gutenberg.app`.
3. Quando o macOS perguntar se o Gutenberg pode **aceitar conexões de entrada**, clique em
   **Permitir**. Para conferir: `/usr/libexec/ApplicationFirewall/socketfilterfw --getappblocked /Applications/Gutenberg.app`.

### Ubuntu / Debian
```sh
sudo apt install ./Gutenberg-<versão>-linux-amd64.deb
```
Se o `ufw` estiver ativo, a instalação libera a porta 8484/tcp (e a desinstalação fecha). Se trocar
a porta na aba Conexão: `sudo ufw allow <porta>/tcp`. Sem instalar: `chmod +x` no AppImage e execute.

## 3. Configurar o OBS (no outro computador)

1. No Gutenberg, abra a aba **Conexão**. Em **Saídas**, cada saída mostra dois endereços com botão
   de copiar:
   - `http://<ip>:<porta>/overlay/<saída>` — a página para o OBS;
   - `http://<ip>:<porta>/overlay/resources/<saída>` — o JSON da tela (formato do Holyrics).
2. No OBS: **Fontes → + → Navegador (Browser Source)**, uma por saída:
   - **URL:** o endereço `/overlay/<saída>`;
   - **Largura/Altura:** a da cena (ex.: 1920 × 1080);
   - marque **Atualizar o navegador quando a cena ficar ativa**.
   O fundo é transparente: posicione e recorte a fonte como a faixa da transmissão.
3. Quem já usa um overlay próprio que lê o JSON do Holyrics só troca o endereço para
   `/overlay/resources/<saída>` (ou `/overlay/resources`, com tudo numa só fonte).
4. Volte ao Gutenberg: a bolinha da barra fica **OBS conectado** quando a página do OBS responde.
   **Testar** reenvia a tela e informa quantos overlays responderam.

Cada saída só mostra as coleções dela: quando entra um hino, a fonte da Bíblia fica limpa.

## 4. Problemas comuns

| Sintoma | O que fazer |
|---|---|
| "OBS sem resposta" | Os dois computadores estão na mesma rede? Abra a URL do overlay no navegador do PC do OBS. Confira o firewall (seção 2). |
| A página abre, mas não muda | Veja se o item no ar pertence a essa saída (aba Conexão → coleções da saída). |
| "Conexão instável" | Resposta acima de 500 ms: rede Wi-Fi fraca. Prefira cabo no PC do operador. |
| Porta ocupada | Troque a porta na aba Conexão e atualize a URL no OBS. |
| A rede caiu no meio do culto | O OBS mantém o último texto; quando a rede volta, a página reconecta sozinha. |

## 5. Atualizações

Instale a versão nova por cima. O banco do operador (cultos, liturgias, saídas, edições da
biblioteca) fica na pasta de dados do usuário e é mantido. Se a versão nova trouxer textos
revisados, eles entram na biblioteca **sem apagar o que o operador editou ou criou**.
