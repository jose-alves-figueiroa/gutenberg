<p align="center">
  <img src="build/icons/256x256.png" alt="Gutenberg" width="128" height="128">
</p>

<h1 align="center">Gutenberg</h1>

<p align="center">
  <a href="https://github.com/jose-alves-figueiroa/gutenberg/releases/latest"><img alt="Versão" src="https://img.shields.io/github/package-json/v/jose-alves-figueiroa/gutenberg?label=vers%C3%A3o&color=201e1d"></a>
  <img alt="Windows | macOS | Linux" src="https://img.shields.io/badge/plataformas-Windows%20%7C%20macOS%20%7C%20Linux-201e1d">
  <img alt="Electron" src="https://img.shields.io/github/package-json/dependency-version/jose-alves-figueiroa/gutenberg/dev/electron?label=Electron&color=47848F&logo=electron&logoColor=white">
  <img alt="React" src="https://img.shields.io/github/package-json/dependency-version/jose-alves-figueiroa/gutenberg/react?label=React&color=61DAFB&logo=react&logoColor=black">
  <img alt="TypeScript" src="https://img.shields.io/github/package-json/dependency-version/jose-alves-figueiroa/gutenberg/dev/typescript?label=TypeScript&color=3178C6&logo=typescript&logoColor=white">
  <a href="https://claude.com/claude-code"><img alt="Made with Claude Code" src="https://img.shields.io/badge/Made%20with-Claude%20Code-D97757?logo=claude&logoColor=white"></a>
</p>

Projeção da liturgia para o OBS. O Gutenberg cadastra a liturgia do culto, mantém a biblioteca
(Bíblia ARA, salmos, HNC, credos, Confissão de Westminster, catecismos) e envia telas limpas para
o OBS de outro computador da rede local, por HTTP. Feito para a [IP Aliança](https://www.ipalianca.org/).

## Instalar

Baixe o instalador do seu sistema na **[página de versões](https://github.com/jose-alves-figueiroa/gutenberg/releases/latest)**,
em **Assets**:

| Sistema | Arquivo |
|---|---|
| Windows 10/11 (x64) | `Gutenberg-<versão>-win-x64.exe` |
| macOS (Apple Silicon) | `Gutenberg-<versão>-mac-arm64.dmg` |
| Ubuntu / Debian (x64) | `Gutenberg-<versão>-linux-amd64.deb` |
| Outras distribuições Linux (x64) | `Gutenberg-<versão>-linux-x86_64.AppImage` |

Depois de instalado, o Gutenberg se atualiza sozinho no Windows e no Linux (instala ao fechar o
app); no macOS, avisa quando há versão nova.

Versões anteriores: [todas as versões](https://github.com/jose-alves-figueiroa/gutenberg/releases).

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
sudo apt install ./Gutenberg-<versão>-linux-amd64.deb
```
Com o `ufw` ativo, a instalação libera a porta 8484/tcp. Para o AppImage:
`chmod +x Gutenberg-<versão>-linux-x86_64.AppImage` e execute.

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
