/**
 * Interface scale (design v2 → Regras gerais → Escala da interface): the app is laid out for a
 * logical area of 1440×810 and enlarged evenly on bigger windows, never shrunk, up to 1.333
 * (1920×1080 → 1440×810; 1920×1200 → 1440×900; 1280×720 stays 1:1).
 */
export const LOGICAL_WIDTH = 1440
export const LOGICAL_HEIGHT = 810
export const MAX_ZOOM = 1.333

export function interfaceZoom(width: number, height: number): number {
  const zoom = Math.min(width / LOGICAL_WIDTH, height / LOGICAL_HEIGHT)
  return Math.min(MAX_ZOOM, Math.max(1, Math.round(zoom * 1000) / 1000))
}
