/**
 * Tracks the OBS clients of each output (PLAN.md → US7.2): who read the JSON, who has an SSE
 * stream open, the round trip the overlay reports, and a log of state changes.
 */
import { clientStatus, type ConnStatus, type LogEntry, type OverlayClient } from '../../shared/connection'

const MAX_LOG = 50

export interface ConnectionMonitor {
  /** A request from a client of `output` ('' = everything); `rtt` when the overlay reports one. */
  seen(output: string, ip: string, rtt?: number): void
  streamOpened(output: string, ip: string): void
  streamClosed(output: string, ip: string): void
  log(entry: Omit<LogEntry, 'time'>): void
  /** Clients (state changes are logged on the way) and the log, newest first. */
  snapshot(): { clients: OverlayClient[]; log: LogEntry[]; now: number }
}

/** `::ffff:192.168.0.30` → `192.168.0.30`. */
export const plainIp = (ip: string): string => ip.replace(/^::ffff:/, '')

export function createConnectionMonitor(clock: () => number = Date.now): ConnectionMonitor {
  const clients = new Map<string, OverlayClient>()
  const states = new Map<string, ConnStatus>()
  const entries: LogEntry[] = []
  const key = (output: string, ip: string) => `${output}\u0000${ip}`

  const log = (entry: Omit<LogEntry, 'time'>) => {
    entries.unshift({ time: clock(), ...entry })
    entries.length = Math.min(entries.length, MAX_LOG)
  }

  const client = (output: string, rawIp: string): OverlayClient => {
    const ip = plainIp(rawIp)
    let c = clients.get(key(output, ip))
    if (!c) {
      c = { output, ip, lastSeen: clock(), rtt: null, streams: 0 }
      clients.set(key(output, ip), c)
    }
    return c
  }

  /** Logs every client whose state changed since the last evaluation. */
  const evaluate = () => {
    const now = clock()
    for (const [k, c] of clients) {
      const status = clientStatus(c, now)
      const before = states.get(k) ?? 'offline'
      if (status === before) continue
      states.set(k, status)
      const base = { output: c.output, ip: c.ip }
      if (status === 'online') log({ kind: 'connected', ...base })
      else if (status === 'unstable') log({ kind: 'unstable', ...base, ms: c.rtt ?? undefined })
      else log({ kind: 'lost', ...base })
    }
  }

  return {
    seen(output, ip, rtt) {
      const c = client(output, ip)
      c.lastSeen = clock()
      if (rtt !== undefined && rtt > 0) c.rtt = rtt
      evaluate()
    },
    streamOpened(output, ip) {
      const c = client(output, ip)
      c.streams++
      c.lastSeen = clock()
      evaluate()
    },
    streamClosed(output, ip) {
      const c = client(output, ip)
      c.streams = Math.max(0, c.streams - 1)
    },
    log,
    snapshot() {
      evaluate()
      return { clients: [...clients.values()].map((c) => ({ ...c })), log: [...entries], now: clock() }
    }
  }
}
