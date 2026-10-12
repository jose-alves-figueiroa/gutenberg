import { describe, expect, it } from 'vitest'
import { createPresenter } from '../src/main/present/presenter'
import { INITIAL_PRESENTATION, applyCommand, clampPosition, type PresentationState } from '@shared/presentation'
import { createTestApi } from './helpers/test-api'

const at = (live: number, slide: number, patch: Partial<PresentationState> = {}): PresentationState => ({
  ...INITIAL_PRESENTATION,
  live,
  slide,
  ...patch
})
const pos = (s: PresentationState) => [s.live, s.slide]

describe('presentation commands (pure)', () => {
  const counts = [2, 3, 1]

  it('step moves screen by screen and crosses item boundaries', () => {
    expect(pos(applyCommand(at(0, 0), { type: 'step', delta: 1 }, counts))).toEqual([0, 1])
    expect(pos(applyCommand(at(0, 1), { type: 'step', delta: 1 }, counts))).toEqual([1, 0])
    expect(pos(applyCommand(at(1, 0), { type: 'step', delta: -1 }, counts))).toEqual([0, 1])
  })

  it('step stops at both ends of the liturgy', () => {
    expect(pos(applyCommand(at(2, 0), { type: 'step', delta: 1 }, counts))).toEqual([2, 0])
    expect(pos(applyCommand(at(0, 0), { type: 'step', delta: -1 }, counts))).toEqual([0, 0])
  })

  it('stepping back into an item without screens lands on screen 0', () => {
    expect(pos(applyCommand(at(1, 0), { type: 'step', delta: -1 }, [0, 2]))).toEqual([0, 0])
  })

  it('go puts a screen on the air and clears the blank screen', () => {
    const s = applyCommand(at(0, 0, { blank: true }), { type: 'go', index: 1, slide: 2 }, counts)
    expect([s.live, s.slide, s.blank]).toEqual([1, 2, false])
    expect(pos(applyCommand(at(0, 0), { type: 'go', index: 9, slide: 9 }, counts))).toEqual([2, 0])
  })

  it('blank keeps the position', () => {
    const s = applyCommand(at(1, 2), { type: 'blank', blank: true }, counts)
    expect([s.live, s.slide, s.blank]).toEqual([1, 2, true])
  })

  it('an ad hoc item goes on the air on top; dropping it keeps the live item', () => {
    const adhoc = applyCommand(at(1, 2), { type: 'adhoc', collection: 'creeds', itemRef: 'apostles' }, counts)
    expect(adhoc.adhoc).toEqual({ collection: 'creeds', itemRef: 'apostles' })
    expect(pos(adhoc)).toEqual([0, 0])
    const moved = applyCommand(adhoc, { type: 'go', index: 2, slide: 1 }, [1, ...counts])
    expect(pos(applyCommand(moved, { type: 'dropAdhoc' }, [1, ...counts]))).toEqual([1, 1])
    expect(applyCommand(adhoc, { type: 'dropAdhoc' }, [1, ...counts])).toMatchObject({ adhoc: null, live: 0, slide: 0 })
  })

  it('presenting a service starts from its first screen without the ad hoc item', () => {
    const s = applyCommand(at(2, 0, { adhoc: { collection: 'creeds', itemRef: 'nicene' } }), { type: 'service', serviceId: 7 }, counts)
    expect(s).toMatchObject({ serviceId: 7, adhoc: null, live: 0, slide: 0, blank: false })
  })

  it('every command bumps seq', () => {
    let s = INITIAL_PRESENTATION
    for (const cmd of [{ type: 'step', delta: 1 }, { type: 'blank', blank: true }, { type: 'go', index: 0, slide: 0 }] as const)
      s = applyCommand(s, cmd, counts)
    expect(s.seq).toBe(3)
  })

  it('clampPosition keeps the position inside an edited liturgy', () => {
    expect(pos(clampPosition(at(4, 5), counts))).toEqual([2, 0])
    expect(pos(clampPosition(at(1, 9), counts))).toEqual([1, 2])
    expect(pos(clampPosition(at(3, 1), []))).toEqual([0, 0])
  })
})

describe('presenter (main process)', () => {
  function setup() {
    const { db, app } = createTestApi()
    const call = async (method: string, path: string, body?: unknown, remote = '127.0.0.1') => {
      const res = await app.request(
        `/api/v1${path}`,
        body === undefined ? { method } : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
        { incoming: { socket: { remoteAddress: remote } } }
      )
      return { status: res.status, body: await res.json() }
    }
    return { db, call }
  }

  async function withService(call: ReturnType<typeof setup>['call']) {
    const { body: s } = await call('POST', '/liturgy/services', { name: 'Culto' })
    await call('POST', `/liturgy/services/${s.id}/items`, { collection: 'catechism:wsc', itemRef: '1', moment: 'Catecismo' })
    await call('POST', `/liturgy/services/${s.id}/items`, { collection: 'creeds', itemRef: 'apostles', moment: 'Confissão de fé' })
    return s.id as number
  }

  it('shows the first service with resolved items and the screen on the air', async () => {
    const { call } = setup()
    await withService(call)
    const { body } = await call('GET', '/present')
    expect(body.service.name).toBe('Culto')
    expect(body.items.map((i: { moment: string; title: string }) => [i.moment, i.title])).toEqual([
      ['Catecismo', 'Breve Catecismo · P. 1'],
      ['Confissão de fé', 'Credo Apostólico']
    ])
    expect(body.onAir).toMatchObject({ item: 0, slide: 0, header: expect.stringContaining('P. 1') })
  })

  it('next crosses into the following item; blank hides the screen', async () => {
    const { call } = setup()
    await withService(call)
    await call('POST', '/present/command', { type: 'step', delta: 1 })
    const { body } = await call('POST', '/present/command', { type: 'step', delta: 1 })
    expect(body.onAir).toMatchObject({ item: 1, slide: 0, header: 'Credo Apostólico' })
    const blank = await call('POST', '/present/command', { type: 'blank', blank: true })
    expect(blank.body.onAir).toBeNull()
    expect(blank.body.state).toMatchObject({ blank: true, live: 1, seq: 3 })
  })

  it('an ad hoc item comes first and does not change the saved liturgy', async () => {
    const { call } = setup()
    const id = await withService(call)
    const { body } = await call('POST', '/present/command', { type: 'adhoc', collection: 'bible:ara', itemRef: 'Hb:12:14' })
    expect(body.items[0]).toMatchObject({ adhoc: true, title: 'Hebreus 12.14' })
    expect(body.onAir.header).toContain('Hebreus 12.14')
    expect((await call('GET', `/liturgy/services/${id}`)).body.items).toHaveLength(2)
  })

  it('persists the state on disk (settings) across restarts', async () => {
    const { db, call } = setup()
    await withService(call)
    await call('POST', '/present/command', { type: 'go', index: 1, slide: 2 })
    expect(createPresenter(db).view().state).toMatchObject({ live: 1, slide: 2, seq: 1 })
  })

  it('ignores a corrupt stored state', () => {
    const { db } = setup()
    db.prepare("INSERT INTO settings (key, value) VALUES ('presentation_state', '{oops')").run()
    expect(createPresenter(db).view().state).toEqual(INITIAL_PRESENTATION)
  })

  it('notifies subscribers after each command', () => {
    const { db } = setup()
    const p = createPresenter(db)
    const seen: number[] = []
    p.subscribe((v) => seen.push(v.state.seq))
    p.command({ type: 'blank', blank: true })
    p.command({ type: 'blank', blank: false })
    expect(seen).toEqual([1, 2])
  })

  it('validates commands and is local only', async () => {
    const { call } = setup()
    expect((await call('POST', '/present/command', { type: 'step', delta: 2 })).status).toBe(400)
    expect((await call('POST', '/present/command', { type: 'adhoc', collection: 'hymns', itemRef: 'x' })).status).toBe(400)
    expect((await call('GET', '/present', undefined, '192.168.0.30')).status).toBe(403)
  })
})
