/**
 * Local routes of the Connection tab (PLAN.md → US7.2): state of each output's OBS clients,
 * the outputs themselves (set up by the operator), the LAN port, "Testar" and the event log.
 */
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { bestRtt, clientStatus, connectionStatus, type OverlayClient } from '../../shared/connection'
import { Outputs } from '../../shared/outputs'
import { SETTINGS } from '../db/build'
import type { SqlDatabase } from '../db/schema'
import { saveSetting } from '../library/repository'
import { outputs, type Presenter } from '../present/presenter'
import { localOnly } from './guards'
import type { ConnectionMonitor } from './monitor'

export interface NetworkControl {
  /** IPv4 addresses of this computer on the LAN. */
  addresses(): string[]
  port(): number
  /** Restarts the LAN server on `port` and saves it; rejects (keeping the old port) on failure. */
  setPort(port: number): Promise<void>
}

const PortBody = z.object({ port: z.number().int().min(1024).max(65535) })

export function connectionRoutes(db: SqlDatabase, presenter: Presenter, monitor: ConnectionMonitor, network: NetworkControl) {
  let lastSent: { time: number; header: string | null } | null = null
  presenter.subscribe((v) => {
    lastSent = { time: Date.now(), header: v.onAir?.header ?? null }
  })

  const view = (c: OverlayClient, now: number) => ({ ip: c.ip, rtt: c.rtt, streams: c.streams, status: clientStatus(c, now) })

  return new Hono()
    .use(localOnly)
    .get('/', (c) => {
      const { clients, log, now } = monitor.snapshot()
      const of = (slug: string) => clients.filter((x) => x.output === slug)
      return c.json({
        status: connectionStatus(clients, now),
        rtt: bestRtt(clients, now),
        addresses: network.addresses(),
        port: network.port(),
        outputs: outputs(db).map((o) => ({
          ...o,
          status: connectionStatus(of(o.slug), now),
          clients: of(o.slug).map((x) => view(x, now))
        })),
        /** Clients of the routes without output (everything). */
        all: { status: connectionStatus(of(''), now), clients: of('').map((x) => view(x, now)) },
        lastSent,
        log
      })
    })
    .put('/outputs', zValidator('json', Outputs), (c) => {
      saveSetting(db, SETTINGS.outputs, JSON.stringify(c.req.valid('json')))
      presenter.notify()
      return c.json({ ok: true })
    })
    .post('/port', zValidator('json', PortBody), async (c) => {
      const { port } = c.req.valid('json')
      try {
        await network.setPort(port)
      } catch (err) {
        monitor.log({ kind: 'portError', port })
        throw new HTTPException(409, { message: (err as Error).message })
      }
      monitor.log({ kind: 'port', port })
      return c.json({ ok: true, port })
    })
    .post('/test', (c) => {
      presenter.notify()
      const { clients, now } = monitor.snapshot()
      const alive = clients.filter((x) => clientStatus(x, now) !== 'offline')
      const ms = bestRtt(clients, now)
      monitor.log({ kind: 'test', clients: alive.length, ...(ms !== null ? { ms } : {}) })
      return c.json({ clients: alive.length, rtt: ms })
    })
}
