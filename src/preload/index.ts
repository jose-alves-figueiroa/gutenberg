import { contextBridge } from 'electron'

// Main ↔ renderer bridge. Empty in phase 1; data (E3) and connection (E7) expose their APIs here.
contextBridge.exposeInMainWorld('gutenberg', { version: '0.1.0' })
