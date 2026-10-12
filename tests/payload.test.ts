import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_STYLE, PayloadStyle, payloadType, toPayload } from '@shared/payload'
import { createPresenter } from '../src/main/present/presenter'
import { addItem, createService } from '../src/main/liturgy/repository'
import { createServerApp } from '../src/main/server/app'
import { createTestApi } from './helpers/test-api'

/** The two `{ "map" }` objects of the Holyrics example (Bible and music). */
const holyrics = readFileSync(join(__dirname, '../design_handoff_gutenberg/reference/holyrics-payload-exemplo.json.txt'), 'utf8')
  .split(/\n\s*\n(?=\{)/)
  .map((block) => JSON.parse(block) as { map: Record<string, unknown> })
const [bibleExample, musicExample] = holyrics

const HTML = /<[a-z/]|&nbsp;|text-force-update|\(RA\)/i
const slide = { header: 'Hebreus 12.15 (2/2)', lines: ['nem haja alguma raiz de amargura que, brotando,', 'vos perturbe, e, por meio dela, muitos sejam contaminados;'] }

describe('payload (US7.1)', () => {
  it('has every key of the Holyrics Bible example, plus seq and lines', () => {
    const p = toPayload({ collection: 'bible:ara', slide }, DEFAULT_STYLE, 128)
    expect(Object.keys(p.map).sort()).toEqual([...Object.keys(bibleExample.map), 'lines', 'seq'].sort())
    expect(p.map).toMatchObject({
      type: 'BIBLE',
      header: 'Hebreus 12.15 (2/2)',
      text: `${slide.lines[0]}\n${slide.lines[1]}`,
      lines: slide.lines,
      seq: 128
    })
  })

  it('uses the Holyrics example values as the default style', () => {
    const p = toPayload({ collection: 'bible:ara', slide }, DEFAULT_STYLE, 1)
    for (const [k, v] of Object.entries(bibleExample.map)) if (k !== 'header' && k !== 'text') expect(p.map[k], k).toEqual(v)
  })

  it('music: the example keys (with credits), valign middle and its row count', () => {
    const credits = { title: 'Salmo 133B', artist: 'Comissão Brasileira de Salmodia', author: '', copyright: '' }
    const p = toPayload({ collection: 'songbook:psalter', slide: { header: 'Salmo 133B', lines: ['Oh! Como é bom e agradável,', 'bem suave, sim,'] }, credits }, DEFAULT_STYLE, 2)
    expect(Object.keys(p.map).sort()).toEqual([...Object.keys(musicExample.map), 'header', 'lines', 'seq'].sort())
    for (const [k, v] of Object.entries(musicExample.map)) if (k !== 'text') expect(p.map[k], k).toEqual(v)
    expect(p.map.text).toBe('Oh! Como é bom e agradável,\nbem suave, sim,')
  })

  it('never carries HTML and at most 2 lines', () => {
    const dirty = { header: '<desc>Hebreus 12.15</desc>', lines: ['<ctt>…contaminados;</ctt>&nbsp; &nbsp;', 'b', 'c'] }
    const p = toPayload({ collection: 'bible:ara', slide: dirty }, DEFAULT_STYLE, 1)
    expect(JSON.stringify(p)).not.toMatch(HTML)
    expect(p.map.lines).toEqual(['…contaminados;', 'b'])
  })

  it('CLEAR when nothing is on the air', () => {
    expect(toPayload({ collection: null, slide: null }, DEFAULT_STYLE, 5).map).toMatchObject({ type: 'CLEAR', header: '', text: '', lines: [], seq: 5 })
  })

  it.each([
    ['bible:ara', 'BIBLE'],
    ['songbook:hnc', 'MUSIC'],
    ['creeds', 'CREED'],
    ['confession:wcf', 'CONFESSION'],
    ['catechism:wlc', 'CATECHISM']
  ])('%s → %s', (collection, type) => expect(payloadType(collection)).toBe(type))

  it('the default style is valid', () => expect(PayloadStyle.parse(DEFAULT_STYLE)).toEqual(DEFAULT_STYLE))
})

describe('public routes for OBS (US7.1)', () => {
  const LAN = { incoming: { socket: { remoteAddress: '192.168.0.30' } } }

  function setup() {
    const api = createTestApi()
    const s = createService(api.db, 'Domingo')
    addItem(api.db, s.id, { collection: 'songbook:psalter', itemRef: 'psalter-133B', moment: 'Salmo' })
    addItem(api.db, s.id, { collection: 'creeds', itemRef: 'apostles', moment: 'Credo' })
    const presenter = createPresenter(api.db)
    return { ...api, presenter, app: createServerApp(api.db, { presenter }) }
  }

  it('GET /overlay/resources answers the LAN with the screen on the air, CORS open', async () => {
    const { app } = setup()
    const res = await app.request('/overlay/resources', { headers: { Origin: 'http://obs.local' } }, LAN)
    expect(res.status).toBe(200)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    const { map } = await res.json()
    expect(map).toMatchObject({ type: 'MUSIC', header: 'Salmo 133B', $system_var_music_title: 'Salmo 133B', valign: 'middle', seq: 0 })
    expect(map.lines.length).toBeLessThanOrEqual(2)
  })

  it('local routes stay closed to the LAN and get no CORS header', async () => {
    const { app } = setup()
    const res = await app.request('/api/v1/present', { headers: { Origin: 'http://obs.local' } }, LAN)
    expect(res.status).toBe(403)
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('follows the presentation: next item, blank → CLEAR', async () => {
    const { app, presenter } = setup()
    presenter.command({ type: 'go', index: 1, slide: 0 })
    expect((await (await app.request('/overlay/resources', {}, LAN)).json()).map).toMatchObject({ type: 'CREED', header: 'Credo Apostólico', seq: 1 })
    presenter.command({ type: 'blank', blank: true })
    expect((await (await app.request('/overlay/resources', {}, LAN)).json()).map).toMatchObject({ type: 'CLEAR', text: '', seq: 2 })
  })

  it('GET /overlay/resources/events streams the current screen, then every change', async () => {
    const { app, presenter } = setup()
    const res = await app.request('/overlay/resources/events', {}, LAN)
    expect(res.headers.get('content-type')).toContain('text/event-stream')
    const reader = res.body!.getReader()
    const next = async () => {
      const { value } = await reader.read()
      const text = new TextDecoder().decode(value)
      return JSON.parse(/data: (.*)/.exec(text)![1]).map
    }
    expect(await next()).toMatchObject({ type: 'MUSIC', seq: 0 })
    presenter.command({ type: 'step', delta: 1 })
    expect(await next()).toMatchObject({ seq: 1 })
    // A library edit re-sends the screen with the same seq.
    await app.request(
      '/api/v1/library/songs',
      { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: '', songbookId: 'hnc', number: '9', version: '', title: 'Novo', versification: '', author: '', artist: '', copyright: '', lyrics: 'a' }) },
      { incoming: { socket: { remoteAddress: '127.0.0.1' } } }
    )
    expect(await next()).toMatchObject({ seq: 1 })
    await reader.cancel()
  })

  it('GET /overlay serves the Browser Source page with no external resources', async () => {
    const { app } = setup()
    const res = await app.request('/overlay', {}, LAN)
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain("new EventSource('/overlay/resources/events')")
    expect(html).toContain('/overlay/resources')
    expect(html).not.toMatch(/https?:\/\//)
  })

  it('GET /api/v1/health answers the LAN', async () => {
    const { app } = setup()
    expect((await app.request('/api/v1/health', {}, LAN)).status).toBe(200)
  })
})
