/** IPC for the library: one channel, allow-listed method names, arguments passed through. */
import { ipcMain } from 'electron'
import { LIBRARY_METHODS, type LibraryApi, type LibraryMethod } from '../../shared/library-api'

export const LIBRARY_CHANNEL = 'library'

export function registerLibraryIpc(api: LibraryApi): void {
  ipcMain.handle(LIBRARY_CHANNEL, (_event, method: LibraryMethod, ...args: unknown[]) => {
    if (!LIBRARY_METHODS.includes(method)) throw new Error(`unknown library method: ${String(method)}`)
    return (api[method] as (...a: unknown[]) => Promise<unknown>)(...args)
  })
}
