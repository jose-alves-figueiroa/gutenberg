import { describe, expect, it } from 'vitest'
import { DEFAULT_STYLE } from '@shared/payload'
import { DEFAULT_OUTPUTS, Outputs, outputFor, outputPayload, type Output } from '@shared/outputs'
import { addItem, createService } from '../src/main/liturgy/repository'
import { createPresenter } from '../src/main/present/presenter'
import { createServerApp } from '../src/main/server/app'
import { createTestApi } from './helpers/test-api'

const slide = { header: 'Hebreus 12.14', lines: ['Segui a paz com todos'] }
const slugOf = (collection: string, outputs: readonly Output[] = DEFAULT_OUTPUTS) => outputFor(collection, outputs)?.slug ?? null

describe('outputs (pure)', () => {
  it('defaults: bible, songs, doctrine, faixas', () => {
    expect(DEFAULT_OUTPUTS.map((o) => o.slug)).toEqual(['bible', 'songs', 'doctrine', 'faixas'])
    expect(Outputs.parse(DEFAULT_OUTPUTS)).toHaveLength(4)
  })

  it.each([
    ['bible:ara', 'bible'],
    ['songbook:hnc', 'songs'],
    ['songbook:psalter', 'songs'],
    ['songbook:harpa', 'songs'],
    ['creeds', 'doctrine'],
    ['confession:wcf', 'doctrine'],
    ['catechism:wlc', 'doctrine']
  ])('%s → %s', (collection, slug) => expect(slugOf(collection)).toBe(slug))

  it('an exact binding wins over a kind binding', () => {
    const outputs: Output[] = [
      { slug: 'songs', name: 'Hinos', collections: ['songbook:*'], style: DEFAULT_STYLE },
      { slug: 'psalms', name: 'Salmos', collections: ['songbook:psalter'], style: DEFAULT_STYLE }
    ]
    expect(slugOf('songbook:psalter', outputs)).toBe('psalms')
    expect(slugOf('songbook:hnc', outputs)).toBe('songs')
    expect(slugOf('bible:ara', outputs)).toBeNull()
  })

  it('validates slugs and bindings', () => {
    const o = (slug: string, collections: string[]) => ({ slug, name: slug, collections, style: DEFAULT_STYLE })
    expect(Outputs.safeParse([o('resources', [])]).success).toBe(false)
    expect(Outputs.safeParse([o('Bíblia', [])]).success).toBe(false)
    expect(Outputs.safeParse([o('a', []), o('a', [])]).success).toBe(false)
    expect(Outputs.safeParse([o('a', ['creeds']), o('b', ['creeds'])]).success).toBe(false)
    expect(Outputs.safeParse([o('a', ['hymns'])]).success).toBe(false)
    expect(Outputs.safeParse([o('bible', ['bible:*']), o('text', ['songbook:*', 'creeds', 'confession:*', 'catechism:*'])]).success).toBe(true)
  })

  it('an output gets CLEAR when the item on the air is not its own', () => {
    const [bible, songs] = DEFAULT_OUTPUTS
    expect(outputPayload({ collection: 'bible:ara', slide }, bible, DEFAULT_OUTPUTS, 3).map).toMatchObject({ type: 'BIBLE', seq: 3 })
    expect(outputPayload({ collection: 'bible:ara', slide }, songs, DEFAULT_OUTPUTS, 3).map).toMatchObject({ type: 'CLEAR', text: '', seq: 3 })
    expect(outputPayload({ collection: 'bible:ara', slide }, null, DEFAULT_OUTPUTS, 3).map).toMatchObject({ type: 'BIBLE' })
  })
})

describe('output routes under /overlay (US7.1)', () => {
  const LAN = { incoming: { socket: { remoteAddress: '192.168.0.30' } } }

  function setup() {
    const api = createTestApi()
    const s = createService(api.db, 'Domingo')
    addItem(api.db, s.id, { collection: 'songbook:psalter', itemRef: 'psalter-133B', moment: 'Salmo' })
    addItem(api.db, s.id, { collection: 'bible:ara', itemRef: 'Hb:12:14', moment: 'Leitura' })
    const presenter = createPresenter(api.db)
    const app = createServerApp(api.db, { presenter })
    const map = async (path: string) => (await (await app.request(path, {}, LAN)).json()).map
    return { ...api, presenter, app, map }
  }

  it('each output shows only its own items; /overlay/resources shows everything', async () => {
    const { presenter, map } = setup()
    expect(await map('/overlay/resources/songs')).toMatchObject({ type: 'MUSIC', valign: 'middle', $system_var_music_title: 'Salmo 133B' })
    expect(await map('/overlay/resources/bible')).toMatchObject({ type: 'CLEAR', text: '' })
    expect(await map('/overlay/resources')).toMatchObject({ type: 'MUSIC' })
    presenter.command({ type: 'go', index: 1, slide: 0 })
    expect(await map('/overlay/resources/bible')).toMatchObject({ type: 'BIBLE', header: 'Hebreus 12.14', valign: 'bottom', seq: 1 })
    expect(await map('/overlay/resources/songs')).toMatchObject({ type: 'CLEAR', seq: 1 })
  })

  it('unknown or reserved outputs → 404', async () => {
    const { app } = setup()
    for (const path of ['/overlay/resources/nope', '/overlay/nope', '/overlay/resources/nope/events', '/overlay/resources/health'])
      expect((await app.request(path, {}, LAN)).status, path).toBe(404)
  })

  it('outputs configured by the operator (settings.outputs) replace the defaults', async () => {
    const { db, map, app } = setup()
    const text = { slug: 'text', name: 'Texto', collections: ['songbook:*', 'creeds', 'confession:*', 'catechism:*'], style: DEFAULT_STYLE }
    db.prepare("INSERT INTO settings (key, value) VALUES ('outputs', ?)").run(JSON.stringify([DEFAULT_OUTPUTS[0], text]))
    expect(await map('/overlay/resources/text')).toMatchObject({ type: 'MUSIC' })
    expect((await app.request('/overlay/resources/songs', {}, LAN)).status).toBe(404)
  })

  it('the page of an output reads that output', async () => {
    const { app } = setup()
    const html = await (await app.request('/overlay/bible', {}, LAN)).text()
    expect(html).toContain("new EventSource('/overlay/resources/bible/events')")
    expect(html).toContain("fetch('/overlay/resources/bible'")
    expect(html).toContain('/api/v1/health?output=bible')
  })

  it('the SSE of an output turns CLEAR when an item of another output goes on the air', async () => {
    const { app, presenter } = setup()
    const res = await app.request('/overlay/resources/songs/events', {}, LAN)
    const reader = res.body!.getReader()
    const next = async () => JSON.parse(/data: (.*)/.exec(new TextDecoder().decode((await reader.read()).value))![1]).map
    expect(await next()).toMatchObject({ type: 'MUSIC' })
    presenter.command({ type: 'go', index: 1, slide: 0 })
    expect(await next()).toMatchObject({ type: 'CLEAR', seq: 1 })
    await reader.cancel()
  })
})
