import { join } from 'node:path'
import { app, BrowserWindow, dialog, shell } from 'electron'
import { SETTINGS } from './db/build'
import { openAppDatabase } from './db/open'
import type { SqlDatabase } from './db/schema'
import { createServerApp } from './server/app'
import { DEFAULT_HTTP_PORT, startHttpServer } from './server/listen'

function createWindow(serverUrl: string): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: 'Gutenberg',
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

/** Database shipped with the app: packaged as a resource, or the dev build of `npm run data:build`. */
const seedDatabase = () =>
  app.isPackaged ? join(process.resourcesPath, 'gutenberg.sqlite') : join(app.getAppPath(), 'data', 'build', 'gutenberg.sqlite')

function httpPort(db: SqlDatabase): number {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(SETTINGS.httpPort) as { value: string } | undefined
  const port = Number(row?.value)
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : DEFAULT_HTTP_PORT
}

app.whenReady().then(async () => {
  let serverUrl: string
  try {
    const db = openAppDatabase({ file: join(app.getPath('userData'), 'gutenberg.sqlite'), seed: seedDatabase() })
    const port = httpPort(db)
    await startHttpServer(createServerApp(db), port)
    serverUrl = `http://127.0.0.1:${port}`
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
