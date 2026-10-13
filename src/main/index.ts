import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { networkInterfaces } from 'node:os'
import { join } from 'node:path'
import { app, BrowserWindow, dialog, shell } from 'electron'
import { openAppDatabase } from './db/open'
import { httpPort, saveHttpPort } from './library/repository'
import { createServerApp } from './server/app'
import type { NetworkControl } from './server/connection'
import { startHttpServer } from './server/listen'

function createWindow(serverUrl: string): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: 'Gutenberg',
    icon: resourcePath('icon.png', 'resources/icon.png'),
    backgroundColor: '#f3f2f2',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // The preload exposes this URL to the renderer (window.gutenberg.serverUrl).
      additionalArguments: [`--gutenberg-server=${serverUrl}`]
    }
  })

  win.on('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
}

/** A file shipped with the app: an extra resource when packaged, the repository file in dev. */
const resourcePath = (packaged: string, dev: string) =>
  app.isPackaged ? join(process.resourcesPath, packaged) : join(app.getAppPath(), dev)

/** Database shipped with the app: packaged as a resource, or the dev build of `npm run data:build`. */
const seedDatabase = () => resourcePath('gutenberg.sqlite', 'data/build/gutenberg.sqlite')

/** IPv4 addresses of this computer on the LAN (shown in the Connection tab). */
const lanAddresses = (): string[] =>
  Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i!.address)

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve())
    // Open SSE streams would keep the old port busy.
    server.closeAllConnections()
  })
}

app.whenReady().then(async () => {
  let serverUrl: string
  try {
    const db = openAppDatabase({ file: join(app.getPath('userData'), 'gutenberg.sqlite'), seed: seedDatabase() })
    // Two listeners on one app: the UI talks to a fixed loopback port, so changing the LAN port
    // (Connection tab) restarts only the server OBS uses.
    let lan: Server | null = null
    let lanPort = httpPort(db)
    const network: NetworkControl = {
      addresses: lanAddresses,
      port: () => lanPort,
      async setPort(port) {
        if (port === lanPort && lan) return
        const next = (await startHttpServer(server, port)) as Server
        if (lan) await closeServer(lan)
        lan = next
        lanPort = port
        saveHttpPort(db, port)
      }
    }
    const server = createServerApp(db, { network })
    const ui = (await startHttpServer(server, 0, '127.0.0.1')) as Server
    serverUrl = `http://127.0.0.1:${(ui.address() as AddressInfo).port}`
    try {
      lan = (await startHttpServer(server, lanPort)) as Server
    } catch (err) {
      // The UI still works; the Connection tab shows the port and lets the operator change it.
      console.error(`LAN server on port ${lanPort}: ${(err as Error).message}`)
    }
  } catch (err) {
    dialog.showErrorBox('Gutenberg', (err as Error).message)
    app.quit()
    return
  }
  createWindow(serverUrl)
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(serverUrl)
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
