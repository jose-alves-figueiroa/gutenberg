import { join } from 'node:path'
import { app, BrowserWindow, dialog, shell } from 'electron'
import { openAppDatabase } from './db/open'
import { createLibraryApi } from './library/api'
import { registerLibraryIpc } from './library/ipc'

function createWindow(): void {
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
      sandbox: false
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

app.whenReady().then(() => {
  try {
    const db = openAppDatabase({ file: join(app.getPath('userData'), 'gutenberg.sqlite'), seed: seedDatabase() })
    registerLibraryIpc(createLibraryApi(db))
  } catch (err) {
    dialog.showErrorBox('Gutenberg', (err as Error).message)
    app.quit()
    return
  }
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
