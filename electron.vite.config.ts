import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

const shared = { '@shared': resolve(__dirname, 'src/shared') }

export default defineConfig({
  main: {
    resolve: { alias: shared },
    // macOS signing of this build (scripts/builder.mjs, PLAN.md → E14), baked in: it picks how the app updates.
    define: { 'process.env.GUTENBERG_MAC_SIGNING': JSON.stringify(process.env.GUTENBERG_MAC_SIGNING || 'adhoc') }
  },
  preload: {},
  renderer: {
    resolve: { alias: { ...shared, '@renderer': resolve(__dirname, 'src/renderer/src') } },
    plugins: [react()]
  }
})
