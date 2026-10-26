/**
 * Remote control (PLAN.md → E17): the PIN shown in the Connection tab, the paired phone and the
 * routes it uses. Only one device controls at a time (decision 4 of design v2): pairing a new one
 * revokes the previous. Tokens are stored hashed (`settings.remote_devices`); a revoked device
 * needs a new PIN. Commands from the phone are the same presenter commands as the desktop's, so
 * the last one wins.
 */
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { zValidator } from '@hono/zod-validator'
import { Hono, type Context, type MiddlewareHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { streamSSE } from 'hono/streaming'
import QRCode from 'qrcode'
import type { Band } from '../../shared/bands'
import { PIN_ATTEMPTS, PIN_TTL_MS, PairBody, RemoteCommand, remoteView, type RemoteDevice } from '../../shared/remote'
import { SETTINGS } from '../db/build'
import type { SqlDatabase } from '../db/schema'
import { saveSetting } from '../library/repository'
import type { Presenter } from '../present/presenter'
import type { NetworkControl } from './connection'
import { localOnly } from './guards'
import { controlHtml } from './control'

interface StoredDevice extends RemoteDevice {
  tokenHash: string
}

export interface RemoteInfo {
  pin: string
  expiresAt: number
  devices: RemoteDevice[]
}

export interface RemoteService {
  info(): RemoteInfo
  newPin(): RemoteInfo
  /** A token for the device, or null for a wrong or expired PIN. */
  pair(body: PairBody): { token: string; device: RemoteDevice } | null
  revoke(id: string): void
  authenticate(token: string): RemoteDevice | null
  /** Called with the id of each revoked device (open streams close at once). */
  onRevoke(listener: (id: string) => void): () => void
}

const hash = (token: string) => createHash('sha256').update(token).digest('hex')
const pinOf = () => String(randomInt(0, 1_000_000)).padStart(6, '0')
/** lastSeen is saved at most this often (every command would otherwise write the settings). */
const SEEN_SAVE_MS = 60_000

export function createRemote(db: SqlDatabase, now: () => number = Date.now): RemoteService {
  const load = (): StoredDevice[] => {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(SETTINGS.remoteDevices) as { value: string } | undefined
    try {
      return row ? (JSON.parse(row.value) as StoredDevice[]) : []
    } catch {
      return []
    }
  }
  let devices = load()
  const save = () => saveSetting(db, SETTINGS.remoteDevices, JSON.stringify(devices))
  let pin = { value: pinOf(), expiresAt: now() + PIN_TTL_MS, misses: 0 }
  const draw = () => (pin = { value: pinOf(), expiresAt: now() + PIN_TTL_MS, misses: 0 })
  const fresh = () => {
    if (now() >= pin.expiresAt) draw()
    return pin
  }
  const plain = (d: StoredDevice): RemoteDevice => ({ id: d.id, name: d.name, platform: d.platform, pairedAt: d.pairedAt, lastSeen: d.lastSeen })
  const info = (): RemoteInfo => ({ pin: fresh().value, expiresAt: pin.expiresAt, devices: devices.map(plain) })
  const revoked = new Set<(id: string) => void>()
  const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))

  return {
    info,
    newPin: () => (draw(), info()),
    pair(body) {
      const current = fresh()
      if (!same(body.pin, current.value)) {
        if (++current.misses >= PIN_ATTEMPTS) draw()
        return null
      }
      draw()
      for (const old of devices) for (const l of revoked) l(old.id)
      const token = randomBytes(32).toString('hex')
      const t = now()
      const device: StoredDevice = { id: randomBytes(8).toString('hex'), name: body.name, platform: body.platform, pairedAt: t, lastSeen: t, tokenHash: hash(token) }
      devices = [device]
      save()
      return { token, device: plain(device) }
    },
    revoke(id) {
      devices = devices.filter((d) => d.id !== id)
      save()
      for (const l of revoked) l(id)
    },
    onRevoke(listener) {
      revoked.add(listener)
      return () => revoked.delete(listener)
    },
    authenticate(token) {
      const h = hash(token)
      const device = devices.find((d) => same(d.tokenHash, h))
      if (!device) return null
      const t = now()
      if (t - device.lastSeen > SEEN_SAVE_MS) {
        device.lastSeen = t
        save()
      }
      return plain(device)
    }
  }
}

/** Local routes for the Connection tab: the PIN and its QR code, the paired devices. */
export function remoteRoutes(remote: RemoteService, network: NetworkControl) {
  const controlUrl = () => `http://${network.addresses()[0] ?? '127.0.0.1'}:${network.port()}/control`
  const withQr = async (info: RemoteInfo) => {
    const url = controlUrl()
    return { ...info, url, qr: await QRCode.toString(url, { type: 'svg', margin: 1 }) }
  }
  return new Hono()
    .use(localOnly)
    .get('/', async (c) => c.json(await withQr(remote.info())))
    .post('/pin', async (c) => c.json(await withQr(remote.newPin())))
    .delete('/devices/:id', (c) => {
      remote.revoke(c.req.param('id'))
      return c.json({ ok: true })
    })
}

/** Bearer token (or `?token=` for EventSource, which cannot send headers). */
const tokenOf = (c: Context) => c.req.header('authorization')?.replace(/^Bearer\s+/i, '') || c.req.query('token') || ''

/**
 * Public on the LAN, for the phone: the page (`/control`), pairing and, with the device's token,
 * the presentation (state, live events, commands).
 */
export function controlRoutes(remote: RemoteService, presenter: Presenter, bands: () => Band[] = () => []) {
  const paired: MiddlewareHandler = async (c, next) => {
    if (!remote.authenticate(tokenOf(c))) throw new HTTPException(401, { message: 'not paired' })
    await next()
  }
  const view = () => remoteView(presenter.view(), bands())
  return new Hono()
    .get('/control', (c) => c.html(controlHtml()))
    .post('/control/api/pair', zValidator('json', PairBody), (c) => {
      const paired = remote.pair(c.req.valid('json'))
      if (!paired) throw new HTTPException(403, { message: 'wrong or expired PIN' })
      return c.json({ token: paired.token })
    })
    .get('/control/api/state', paired, (c) => c.json(view()))
    .post('/control/api/command', paired, zValidator('json', RemoteCommand), (c) => {
      const cmd = c.req.valid('json')
      if (cmd.type === 'band') {
        const band = bands()[cmd.index]
        if (!band) throw new HTTPException(404, { message: 'no such band' })
        presenter.command({ type: 'band', band })
      } else presenter.command(cmd)
      return c.json(view())
    })
    .get('/control/api/events', paired, (c) => {
      const device = remote.authenticate(tokenOf(c))!
      return streamSSE(c, async (stream) => {
        let open = true
        const send = () => (open ? stream.writeSSE({ data: JSON.stringify(view()) }) : Promise.resolve())
        const unsubscribe = presenter.subscribe(() => void send())
        // Revoked: tell the page (it goes back to pairing) and close the stream at once.
        const unrevoke = remote.onRevoke((id) => {
          if (id !== device.id || !open) return
          open = false
          void stream.writeSSE({ event: 'revoked', data: '' }).then(() => stream.abort())
        })
        const close = () => {
          open = false
          unsubscribe()
          unrevoke()
        }
        stream.onAbort(close)
        await send()
        while (open && !stream.aborted) {
          await stream.sleep(15_000)
          if (open && !stream.aborted) await stream.write(': ping\n\n')
        }
        close()
      })
    })
}
