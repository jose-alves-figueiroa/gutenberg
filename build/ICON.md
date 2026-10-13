# Ícone Gutenberg (1b — tipo móvel)

- **`icon-1024.png`**: fonte principal.
  - **Electron:** use em `build/icon.png`. O `electron-builder` gera o `.ico` (Windows) e o `.icns` (macOS) a partir dele.
- **`icon-512.png` e `icon-256.png`**: para o Linux e para o instalador.
- **`icon-64.png`, `icon-32.png` e `icon-16.png`**: para a barra de tarefas, a bandeja e o favicon. Os tamanhos abaixo de 32 px usam a versão ampliada do G.

**Configuração (`package.json`):**
```json
"build": { "icon": "build/icon.png" }
```
**Janela (main process):**
```js
new BrowserWindow({ icon: path.join(__dirname, 'build/icon-256.png') })
```

**Cores:**
- Papel `#f3f2f2`
- Tipo `#d7d3d3`
- G `#201e1d`
- Entalhe `#0088b0`
