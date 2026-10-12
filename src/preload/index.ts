import { contextBridge } from 'electron'

// Ponte main ↔ renderer. Vazia na Fase 1; a Fase 2 (dados) e a Fase 7 (conexão) expõem APIs aqui.
contextBridge.exposeInMainWorld('gutenberg', { version: '0.1.0' })
