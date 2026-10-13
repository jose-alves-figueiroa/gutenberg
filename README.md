# Gutenberg

Projeção da liturgia para o OBS. O Gutenberg cadastra a liturgia do culto, mantém a biblioteca
(Bíblia ARA, salmos, HNC, credos, Confissão de Westminster, catecismos) e envia telas limpas para
o OBS de outro computador da rede local, por HTTP.

## Instalar

Baixe o instalador do seu sistema na [página de versões](https://github.com/jose-alves-figueiroa/gutenberg/releases/latest):

| Sistema | Instalador |
|---|---|
| Windows 10/11 (x64) | [Gutenberg-0.1.0-win-x64.exe](https://github.com/jose-alves-figueiroa/gutenberg/releases/download/v0.1.0/Gutenberg-0.1.0-win-x64.exe) |
| macOS (Apple Silicon) | [Gutenberg-0.1.0-mac-arm64.dmg](https://github.com/jose-alves-figueiroa/gutenberg/releases/download/v0.1.0/Gutenberg-0.1.0-mac-arm64.dmg) |
| Ubuntu / Debian (x64) | [Gutenberg-0.1.0-linux-amd64.deb](https://github.com/jose-alves-figueiroa/gutenberg/releases/download/v0.1.0/Gutenberg-0.1.0-linux-amd64.deb) |
| Outras distribuições Linux (x64) | [Gutenberg-0.1.0-linux-x86_64.AppImage](https://github.com/jose-alves-figueiroa/gutenberg/releases/download/v0.1.0/Gutenberg-0.1.0-linux-x86_64.AppImage) |

### Windows
1. Execute o `.exe` e aceite o pedido de administrador.
2. Se aparecer "O Windows protegeu o computador": **Mais informações → Executar assim mesmo**.
3. O instalador cria a regra de firewall **Gutenberg**. Deixe a rede da igreja como **Privada**
   (Configurações → Rede e Internet).

### macOS
1. Abra o `.dmg` e arraste o **Gutenberg** para **Aplicativos**.
2. Na primeira abertura o macOS bloqueia o app (assinatura ad-hoc): em
   **Ajustes do Sistema → Privacidade e Segurança**, clique em **Abrir Mesmo Assim**.
   Se aparecer "está danificado":
   ```sh
   xattr -dr com.apple.quarantine /Applications/Gutenberg.app
   ```
3. Quando o macOS perguntar se o app pode aceitar conexões de entrada, clique em **Permitir**.

### Ubuntu / Debian
```sh
sudo apt install ./Gutenberg-0.1.0-linux-amd64.deb
```
Com o `ufw` ativo, a instalação libera a porta 8484/tcp. Para o AppImage:
`chmod +x Gutenberg-0.1.0-linux-x86_64.AppImage` e execute.

### Ligar ao OBS
Na aba **Conexão** do Gutenberg, copie o endereço da saída (ex.: `http://<ip>:8484/overlay/bible`)
e cole numa **Browser Source** do OBS. O passo a passo completo, com problemas comuns, está em
[docs/OBS.md](docs/OBS.md).

## Desenvolvimento

```sh
npm install
npm run dev        # app em modo desenvolvimento
npm test           # testes
npm run dist:mac   # instaladores: dist:mac, dist:win, dist:linux
```

Os textos da biblioteca ficam cifrados no repositório (ver [docs/DATA.md](docs/DATA.md)). Regras
do projeto em [AGENTS.md](AGENTS.md) e plano em [PLAN.md](PLAN.md).
