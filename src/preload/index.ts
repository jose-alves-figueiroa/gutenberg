import { contextBridge } from 'electron'

// The renderer talks to the local HTTP API (src/main/server); main passes its URL as an argument.
const serverUrl = process.argv.find((a) => a.startsWith('--gutenberg-server='))?.split('=')[1] ?? ''

contextBridge.exposeInMainWorld('gutenberg', { version: '0.1.0', serverUrl })
