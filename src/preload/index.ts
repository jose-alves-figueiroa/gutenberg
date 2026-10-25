import { contextBridge, webFrame } from 'electron'
import { interfaceZoom } from '../shared/zoom'

// The renderer talks to the local HTTP API (src/main/server); main passes its URL as an argument.
const serverUrl = process.argv.find((a) => a.startsWith('--gutenberg-server='))?.split('=')[1] ?? ''

contextBridge.exposeInMainWorld('gutenberg', { version: '0.1.0', serverUrl })

// Interface scale (design v2): recomputed from the window size at zoom 1 on every resize.
function applyZoom(): void {
  const current = webFrame.getZoomFactor()
  const next = interfaceZoom(window.innerWidth * current, window.innerHeight * current)
  if (Math.abs(next - current) > 0.001) webFrame.setZoomFactor(next)
}
window.addEventListener('resize', applyZoom)
window.addEventListener('DOMContentLoaded', applyZoom)
