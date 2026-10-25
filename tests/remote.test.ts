import { describe, expect, it } from 'vitest'
import { PIN_ATTEMPTS, PIN_TTL_MS, remoteView } from '@shared/remote'
import { createPresenter } from '../src/main/present/presenter'
import { addItem, createService } from '../src/main/liturgy/repository'
import { createServerApp } from '../src/main/server/app'
import { createRemote } from '../src/main/server/remote'
import { createTestApi } from './helpers/test-api'

const LAN = { incoming: { socket: { remoteAddress: '192.168.0.30' } } }
const LOCAL = { incoming: { socket: { remoteAddress: '127.0.0.1' } } }
const slide = (header: string, line: string) => ({ header, lines: [line, `${line}.`] })

describe('remoteView (US17.2)', () => {
  const items = [
    { moment: 'Leitura', title: 'Hebreus 12.1', slides: [slide('Hb 12.1', 'a'), slide('Hb 12.1', 'b')] },
    { moment: 'Credo', title: 'Credo Apostólico', slides: [slide('Credo', 'c')] }
  ]
  it('on the air and up next, also across items (decision 3)', () => {
    const v = remoteView({ service: { name: 'Domingo' }, items, state: { live: 0, slide: 1, blank: false } })
    expect(v.onAir).toMatchObject({ moment: 'Leitura', title: 'Hebreus 12.1', lines: ['b', 'b.'], slide: 1, slides: 2 })
    expect(v.upNext).toMatchObject({ title: 'Credo Apostólico', slide: 0 })
    expect(v.items).toEqual([{ moment: 'Leitura', title: 'Hebreus 12.1' }, { moment: 'Credo', title: 'Credo Apostólico' }])
  })
  it('nothing on the air with "Limpar tela"; nothing next at the end', () => {
    expect(remoteView({ service: null, items, state: { live: 0, slide: 0, blank: true } }).onAir).toBeNull()
    expect(remoteView({ service: null, items, state: { live: 1, slide: 0, blank: false } }).upNext).toBeNull()
  })
})

describe('pairing (US17.1)', () => {
  const setup = () => {
    let clock = 1_000_000
    const { db } = createTestApi()
    return { remote: createRemote(db, () => clock), tick: (ms: number) => (clock += ms), db }
  }

  it('a 6-digit PIN pairs once and gives a token; the PIN changes after it', () => {
    const { remote } = setup()
    const { pin } = remote.info()
    expect(pin).toMatch(/^\d{6}$/)
    const paired = remote.pair({ pin, name: 'Celular', platform: 'Android' })!
    expect(paired.token).toMatch(/^[0-9a-f]{64}$/)
    expect(remote.authenticate(paired.token)).toMatchObject({ name: 'Celular', platform: 'Android' })
    expect(remote.info().pin).not.toBe(pin)
    expect(remote.pair({ pin, name: 'Outro', platform: '' })).toBeNull()
  })

  it('the PIN expires after 5 minutes and is drawn again after wrong attempts', () => {
    const { remote, tick } = setup()
    const first = remote.info().pin
    tick(PIN_TTL_MS)
    expect(remote.info().pin).not.toBe(first)
    const pin = remote.info().pin
    const wrong = pin === '000000' ? '111111' : '000000'
    for (let i = 0; i < PIN_ATTEMPTS; i++) expect(remote.pair({ pin: wrong, name: 'x', platform: '' })).toBeNull()
    expect(remote.pair({ pin, name: 'x', platform: '' })).toBeNull()
  })

  it('one device at a time: pairing another revokes the first; revoking stops its token', () => {
    const { remote, db } = setup()
    const a = remote.pair({ pin: remote.info().pin, name: 'A', platform: '' })!
    const revoked: string[] = []
    remote.onRevoke((id) => revoked.push(id))
    const b = remote.pair({ pin: remote.info().pin, name: 'B', platform: '' })!
    expect(remote.authenticate(a.token)).toBeNull()
    expect(revoked).toEqual([a.device.id])
    expect(remote.info().devices.map((d) => d.name)).toEqual(['B'])
    // Persisted hashed: a new service on the same database still knows B, never the plain token.
    const stored = (db.prepare("SELECT value FROM settings WHERE key = 'remote_devices'").get() as { value: string }).value
    expect(stored).not.toContain(b.token)
    expect(createRemote(db).authenticate(b.token)).toMatchObject({ name: 'B' })
    remote.revoke(b.device.id)
    expect(remote.authenticate(b.token)).toBeNull()
  })
})

describe('routes (US17.1, US17.2)', () => {
  function setup() {
    const api = createTestApi()
    const s = createService(api.db, 'Domingo')
    addItem(api.db, s.id, { collection: 'creeds', itemRef: 'apostles', moment: 'Credo' })
    const presenter = createPresenter(api.db)
    const remote = createRemote(api.db)
    return { presenter, remote, app: createServerApp(api.db, { presenter, remote }) }
  }

  it('the PIN, URL and QR code are local only', async () => {
    const { app: a } = setup()
    expect((await a.request('/api/v1/remote', {}, LAN)).status).toBe(403)
    const info = await (await a.request('/api/v1/remote', {}, LOCAL)).json()
    expect(info.url).toBe('http://192.168.0.12:8484/control')
    expect(info.qr).toMatch(/^<svg/)
    const again = await (await a.request('/api/v1/remote/pin', { method: 'POST' }, LOCAL)).json()
    expect(again.pin).not.toBe(info.pin)
  })

  it('the phone pairs from the LAN, then reads the state and sends commands', async () => {
    const { app: a, remote, presenter } = setup()
    const page = await (await a.request('/control', {}, LAN)).text()
    expect(page).toContain('Parear este celular')
    expect(page).not.toMatch(/https?:\/\//)
    const post = (path: string, body: unknown, token?: string) =>
      a.request(path, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) }, LAN)
    expect((await post('/control/api/pair', { pin: '12345', name: 'x' })).status).toBe(400)
    const wrong = remote.info().pin === '000000' ? '111111' : '000000'
    expect((await post('/control/api/pair', { pin: wrong, name: 'x' })).status).toBe(403)
    const { token } = await (await post('/control/api/pair', { pin: remote.info().pin, name: 'Celular' })).json()
    expect((await a.request('/control/api/state', {}, LAN)).status).toBe(401)
    const state = await (await a.request('/control/api/state', { headers: { authorization: `Bearer ${token}` } }, LAN)).json()
    expect(state.items).toEqual([{ moment: 'Credo', title: 'Credo Apostólico' }])
    const after = await (await post('/control/api/command', { type: 'step', delta: 1 }, token)).json()
    expect(after.onAir.slide).toBe(1)
    expect(presenter.view().state.slide).toBe(1)
    // A phone may not change the service or present an ad hoc item.
    expect((await post('/control/api/command', { type: 'service', serviceId: 1 }, token)).status).toBe(400)
  })
})
