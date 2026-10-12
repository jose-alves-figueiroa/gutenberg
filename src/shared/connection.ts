/**
 * Connection state with OBS (PLAN.md → US7.2). OBS pulls from Gutenberg over HTTP, so the state
 * comes from the overlay clients: the overlay calls `/api/v1/health` every 2 s and reports the
 * round trip of its previous call; consumers of the JSON count as seen when they read it.
 */
export type ConnStatus = 'online' | 'unstable' | 'offline'

export const HEALTH_INTERVAL_MS = 2_000
/** Round trip above this → "Conexão instável". */
export const UNSTABLE_RTT_MS = 500
/** Missed health calls in a row → "Sem resposta". */
export const MAX_MISSES = 3

export interface OverlayClient {
  /** Output slug; empty for the routes without output (everything). */
  output: string
  ip: string
  /** Last request from this client (ms since epoch). */
  lastSeen: number
  /** Round trip reported by the overlay; null before the first measure (or for JSON consumers). */
  rtt: number | null
  /** Open SSE streams from this client. */
  streams: number
}

/**
 * Alive: seen within the last 3 health intervals. An open SSE stream alone does not count — a
 * dropped network can leave it open on this side for minutes.
 */
export const isAlive = (c: OverlayClient, now: number): boolean => now - c.lastSeen <= MAX_MISSES * HEALTH_INTERVAL_MS

export function clientStatus(c: OverlayClient, now: number): ConnStatus {
  if (!isAlive(c, now)) return 'offline'
  return c.rtt !== null && c.rtt > UNSTABLE_RTT_MS ? 'unstable' : 'online'
}

/** Online when some alive client answers within 500 ms; unstable when all are slower; else offline. */
export function connectionStatus(clients: readonly OverlayClient[], now: number): ConnStatus {
  const states = clients.map((c) => clientStatus(c, now))
  if (states.includes('online')) return 'online'
  return states.includes('unstable') ? 'unstable' : 'offline'
}

/** Best (lowest) round trip among alive clients. */
export function bestRtt(clients: readonly OverlayClient[], now: number): number | null {
  const rtts = clients.filter((c) => isAlive(c, now) && c.rtt !== null).map((c) => c.rtt!)
  return rtts.length ? Math.min(...rtts) : null
}

export type LogKind = 'connected' | 'unstable' | 'lost' | 'test' | 'port' | 'portError'

export interface LogEntry {
  time: number
  kind: LogKind
  output?: string
  ip?: string
  ms?: number
  port?: number
  clients?: number
}
