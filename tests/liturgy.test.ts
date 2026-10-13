import { describe, expect, it } from 'vitest'
import { createTestApi } from './helpers/test-api'

const LOCAL = { incoming: { socket: { remoteAddress: '127.0.0.1' } } }
const LAN = { incoming: { socket: { remoteAddress: '192.168.0.30' } } }

function setup() {
  const { app, db } = createTestApi()
  const call = async (method: string, path: string, body?: unknown, env = LOCAL) => {
    const res = await app.request(
      `/api/v1${path}`,
      body === undefined ? { method } : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      env
    )
    return { status: res.status, body: res.headers.get('content-type')?.includes('json') ? await res.json() : null }
  }
  return { db, call }
}

describe('item resolution (stable item_ref)', () => {
  const { call } = setup()
  const resolve = (collection: string, itemRef: string) =>
    call('GET', `/library/resolve?collection=${encodeURIComponent(collection)}&itemRef=${encodeURIComponent(itemRef)}`)

  it.each([
    ['bible:ara', 'Hb:12:14-15', 'Hebreus 12.14–15', 'Bíblia ARA', 3],
    ['bible:ara', 'Hb:12:14', 'Hebreus 12.14', 'Bíblia ARA', 1],
    ['songbook:psalter', 'psalter-133B', 'Salmo 133B', 'Salmos genebrinos', 4],
    ['songbook:hnc', 'hnc-h1', 'Castelo forte', 'Hinário Novo Cântico', 2],
    ['confession:wcf', '1.1', 'CFW 1.1 — Da Escritura Sagrada', 'Confissão de Westminster', 4],
    ['catechism:wsc', '1', 'Breve Catecismo · P. 1', 'Breve Catecismo', 2],
    ['creeds', 'apostles', 'Credo Apostólico', 'Credos', 7]
  ])('%s %s → %s', async (collection, itemRef, title, label, screens) => {
    const { status, body } = await resolve(collection, itemRef)
    expect(status).toBe(200)
    expect({ title: body.title, label: body.collectionLabel, screens: body.slides.length, missing: body.missing }).toEqual({
      title,
      label,
      screens,
      missing: false
    })
  })

  it('a reference to a removed record resolves as "(item removido)"', async () => {
    expect((await resolve('songbook:hnc', 'hnc-999')).body).toMatchObject({ title: '(item removido)', missing: true, slides: [] })
    expect((await resolve('bible:ara', 'Gn:1:1')).body).toMatchObject({ title: 'Gênesis 1.1', missing: true })
  })

  it('validates the collection reference', async () => {
    expect((await resolve('hymns', 'x')).status).toBe(400)
  })
})

describe('services and items (US5.2)', () => {
  it('create, list with counts, add, edit moment, move, remove, rename, delete', async () => {
    const { call } = setup()
    const created = await call('POST', '/liturgy/services', { name: 'Domingo 12/10 · manhã' })
    expect(created.status).toBe(201)
    const id = created.body.id
    const add = (collection: string, itemRef: string, moment = '') => call('POST', `/liturgy/services/${id}/items`, { collection, itemRef, moment })
    expect((await add('songbook:psalter', 'psalter-133B', 'Adoração')).body).toEqual({ position: 1 })
    await add('bible:ara', 'Hb:12:14-15', 'Leitura')
    await add('creeds', 'apostles')
    expect((await call('GET', '/liturgy/services')).body).toEqual([{ id, name: 'Domingo 12/10 · manhã', count: 3 }])

    const items = async () => ((await call('GET', `/liturgy/services/${id}`)).body.items as { position: number; title: string; moment: string; screens: number }[])
    expect((await items()).map((i) => [i.position, i.moment, i.title, i.screens])).toEqual([
      [1, 'Adoração', 'Salmo 133B', 4],
      [2, 'Leitura', 'Hebreus 12.14–15', 3],
      [3, '', 'Credo Apostólico', 7]
    ])

    await call('PATCH', `/liturgy/services/${id}/items/3`, { moment: 'Confissão de fé' })
    await call('POST', `/liturgy/services/${id}/items/3/move`, { delta: -1 })
    await call('POST', `/liturgy/services/${id}/items/1/move`, { delta: -1 }) // already first: no-op
    expect((await items()).map((i) => i.title)).toEqual(['Salmo 133B', 'Credo Apostólico', 'Hebreus 12.14–15'])
    expect((await items())[1].moment).toBe('Confissão de fé')

    await call('DELETE', `/liturgy/services/${id}/items/1`)
    expect((await items()).map((i) => [i.position, i.title])).toEqual([
      [1, 'Credo Apostólico'],
      [2, 'Hebreus 12.14–15']
    ])

    await call('PATCH', `/liturgy/services/${id}`, { name: 'Domingo 12/10 · noite' })
    expect((await call('GET', `/liturgy/services/${id}`)).body.name).toBe('Domingo 12/10 · noite')
    expect((await call('DELETE', `/liturgy/services/${id}`)).status).toBe(200)
    expect((await call('GET', '/liturgy/services')).body).toEqual([])
    expect((await call('GET', `/liturgy/services/${id}`)).status).toBe(404)
  })

  it('validates input and reports unknown services or items', async () => {
    const { call } = setup()
    expect((await call('POST', '/liturgy/services', { name: '  ' })).status).toBe(400)
    const { id } = (await call('POST', '/liturgy/services', { name: 'Culto' })).body
    expect((await call('POST', `/liturgy/services/${id}/items`, { collection: 'nope', itemRef: 'x' })).status).toBe(400)
    expect((await call('POST', `/liturgy/services/${id}/items/1/move`, { delta: 2 })).status).toBe(400)
    expect((await call('PATCH', `/liturgy/services/${id}/items/9`, { moment: 'x' })).status).toBe(404)
    expect((await call('POST', '/liturgy/services/999/items', { collection: 'creeds', itemRef: 'nicene' })).status).toBe(404)
  })

  it('is local only', async () => {
    const { call } = setup()
    expect((await call('GET', '/liturgy/services', undefined, LAN)).status).toBe(403)
  })
})

describe('picker search (US5.3)', () => {
  const { call } = setup()
  const search = async (collection: string, q: string) =>
    ((await call('GET', `/library/search?collection=${encodeURIComponent(collection)}&q=${encodeURIComponent(q)}`)).body as { itemRef: string; title: string }[])

  it('songbooks by number or title', async () => {
    expect((await search('songbook:psalter', '133')).map((r) => r.title)).toEqual(['Salmo 133A', 'Salmo 133B'])
    expect((await search('songbook:hnc', 'castelo')).map((r) => r.itemRef)).toEqual(['hnc-h1'])
    expect(await search('songbook:psalter', '')).toHaveLength(5)
  })

  it('songbooks: number with version, exact number first', async () => {
    expect((await search('songbook:psalter', '133b')).map((r) => r.title)).toEqual(['Salmo 133B'])
    expect((await search('songbook:psalter', '1')).map((r) => r.title)[0]).toBe('Salmo 1')
    expect((await search('songbook:psalter', '1')).map((r) => r.title).slice(1).sort()).toEqual(['Salmo 100', 'Salmo 133A', 'Salmo 133B'])
  })

  it('catechisms by exact number or question text', async () => {
    expect((await search('catechism:wsc', '2')).map((r) => r.itemRef)).toEqual(['2'])
    expect((await search('catechism:wsc', 'fim principal')).map((r) => r.itemRef)).toEqual(['1'])
  })

  it('confessions by section, chapter or title; creeds by title', async () => {
    expect((await search('confession:wcf', '1.2')).map((r) => r.itemRef)).toEqual(['1.2'])
    expect((await search('confession:wcf', '1')).map((r) => r.itemRef)).toEqual(['1.1', '1.2'])
    expect((await search('confession:wcf', 'escritura')).map((r) => r.title)).toEqual(['CFW 1.1 — Da Escritura Sagrada', 'CFW 1.2 — Da Escritura Sagrada'])
    expect((await search('creeds', 'apost')).map((r) => r.itemRef)).toEqual(['apostles'])
  })
})
