import { describe, expect, it } from 'vitest'
import { connectionStatus, type OverlayClient } from '@shared/connection'
import { DEFAULT_OUTPUTS } from '@shared/outputs'
import { createConnectionMonitor } from '../src/main/server/monitor'
import { createServerApp } from '../src/main/server/app'
import type { NetworkControl } from '../src/main/server/connection'
import { createTestApi } from './helpers/test-api'

const client = (patch: Partial<OverlayClient>): OverlayClient => ({ output: 'bible', ip: '10.0.0.5', lastSeen: 0, rtt: null, streams: 0, ...patch })

describe('connection status (pure)', () => {
  it('online, unstable (> 500 ms), offline (3 missed health calls)', () => {
    expect(connectionStatus([client({ lastSeen: 1000, rtt: 18 })], 2000)).toBe('online')
    expect(connectionStatus([client({ lastSeen: 1000, rtt: 640 })], 2000)).toBe('unstable')
    expect(connectionStatus([client({ lastSeen: 1000, rtt: 18 })], 1000 + 6001)).toBe('offline')
    expect(connectionStatus([client({ lastSeen: 1000, rtt: 18 })], 1000 + 6000)).toBe('online')
    expect(connectionStatus([], 0)).toBe('offline')
  })

  it('one fast client is enough; an open stream alone does not count', () => {
    expect(connectionStatus([client({ lastSeen: 1000, rtt: 900 }), client({ ip: 'b', lastSeen: 1000, rtt: 20 })], 1500)).toBe('online')
    expect(connectionStatus([client({ lastSeen: 0, streams: 1 })], 60_000)).toBe('offline')
  })
})

describe('connection monitor', () => {
  it('logs connected, unstable and lost per output and client', () => {
    let now = 0
    const m = createConnectionMonitor(() => now)
    m.seen('bible', '::ffff:10.0.0.5', 18)
    now = 2000
    m.seen('bible', '10.0.0.5', 700)
    now = 20_000
    const { clients, log } = m.snapshot()
    expect(clients).toEqual([{ output: 'bible', ip: '10.0.0.5', lastSeen: 2000, rtt: 700, streams: 0 }])
    expect(log.map((e) => [e.kind, e.output, e.ip])).toEqual([
      ['lost', 'bible', '10.0.0.5'],
      ['unstable', 'bible', '10.0.0.5'],
      ['connected', 'bible', '10.0.0.5']
    ])
  })

  it('counts SSE streams', () => {
    const m = createConnectionMonitor(() => 0)
    m.streamOpened('songs', '10.0.0.6')
    m.streamOpened('songs', '10.0.0.6')
    m.streamClosed('songs', '10.0.0.6')
    expect(m.snapshot().clients[0]).toMatchObject({ output: 'songs', streams: 1 })
  })
})

describe('connection routes (US7.2)', () => {
  const LAN = { incoming: { socket: { remoteAddress: '::ffff:10.0.0.5' } } }
  const LOCAL = { incoming: { socket: { remoteAddress: '127.0.0.1' } } }

  function setup(network?: NetworkControl) {
    const api = createTestApi()
    const app = createServerApp(api.db, network ? { network } : {})
    const call = async (method: string, path: string, body?: unknown, env = LOCAL) => {
      const res = await app.request(
        path,
        body === undefined ? { method } : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
        env
      )
      return { status: res.status, body: await res.json() }
    }
    return { ...api, app, call }
  }

  it('reports each output with its clients, the address and the port', async () => {
    const { call, app } = setup()
    await app.request('/api/v1/health?output=bible&rtt=18', {}, LAN)
    await app.request('/overlay/resources', {}, LAN)
    const { body } = await call('GET', '/api/v1/connection')
    expect(body).toMatchObject({ status: 'online', rtt: 18, addresses: ['192.168.0.12'], port: 8484 })
    expect(body.outputs.map((o: { slug: string; status: string }) => [o.slug, o.status])).toEqual([
      ['bible', 'online'],
      ['songs', 'offline'],
      ['doctrine', 'offline'],
      ['faixas', 'offline']
    ])
    expect(body.outputs[0].clients).toEqual([{ ip: '10.0.0.5', rtt: 18, streams: 0, status: 'online' }])
    expect(body.all.clients).toHaveLength(1)
    expect(body.log[0]).toMatchObject({ kind: 'connected' })
  })

  it('is local only', async () => {
    const { call } = setup()
    expect((await call('GET', '/api/v1/connection', undefined, LAN)).status).toBe(403)
  })

  it('saves the outputs the operator sets up (validated)', async () => {
    const { call, app } = setup()
    const text = { slug: 'text', name: 'Texto', collections: ['songbook:*', 'creeds', 'confession:*', 'catechism:*'], style: DEFAULT_OUTPUTS[0].style }
    expect((await call('PUT', '/api/v1/connection/outputs', [DEFAULT_OUTPUTS[0], text])).status).toBe(200)
    expect((await call('GET', '/api/v1/connection')).body.outputs.map((o: { slug: string }) => o.slug)).toEqual(['bible', 'text'])
    expect((await app.request('/overlay/resources/text', {}, LAN)).status).toBe(200)
    expect((await call('PUT', '/api/v1/connection/outputs', [text, { ...text, name: 'Outra' }])).status).toBe(400)
    expect((await call('PUT', '/api/v1/connection/outputs', [{ ...text, slug: 'health' }])).status).toBe(400)
  })

  it('changes the port through the network control and logs it; a busy port is reported', async () => {
    let port = 8484
    const network: NetworkControl = {
      addresses: () => ['192.168.0.12'],
      port: () => port,
      setPort: async (p) => {
        if (p === 9000) throw new Error('EADDRINUSE')
        port = p
      }
    }
    const { call } = setup(network)
    expect((await call('POST', '/api/v1/connection/port', { port: 8585 })).body).toEqual({ ok: true, port: 8585 })
    const busy = await call('POST', '/api/v1/connection/port', { port: 9000 })
    expect(busy).toEqual({ status: 409, body: { error: 'EADDRINUSE' } })
    expect((await call('POST', '/api/v1/connection/port', { port: 80 })).status).toBe(400)
    const { body } = await call('GET', '/api/v1/connection')
    expect(body.port).toBe(8585)
    expect(body.log.slice(0, 2).map((e: { kind: string; port: number }) => [e.kind, e.port])).toEqual([
      ['portError', 9000],
      ['port', 8585]
    ])
  })

  it('Testar re-sends the screen and reports the overlays that answer', async () => {
    const { call, app } = setup()
    expect((await call('POST', '/api/v1/connection/test')).body).toEqual({ clients: 0, rtt: null })
    await app.request('/api/v1/health?output=songs&rtt=25', {}, LAN)
    expect((await call('POST', '/api/v1/connection/test')).body).toEqual({ clients: 1, rtt: 25 })
  })

  it('the default port is saved in settings by the static network control', async () => {
    const { call, db } = setup()
    await call('POST', '/api/v1/connection/port', { port: 8686 })
    expect(db.prepare("SELECT value FROM settings WHERE key = 'http_port'").get()).toEqual({ value: '8686' })
  })
})
