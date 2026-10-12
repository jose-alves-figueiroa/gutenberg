import { contextBridge, ipcRenderer } from 'electron'
import { LIBRARY_METHODS, type LibraryApi } from '../shared/library-api'

// Main ↔ renderer bridge. The library API is a typed proxy over one allow-listed IPC channel.
const library = Object.fromEntries(
  LIBRARY_METHODS.map((method) => [method, (...args: unknown[]) => ipcRenderer.invoke('library', method, ...args)])
) as unknown as LibraryApi

contextBridge.exposeInMainWorld('gutenberg', { version: '0.1.0', library })
