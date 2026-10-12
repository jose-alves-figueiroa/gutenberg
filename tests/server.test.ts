import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterAll, describe, expect, it } from 'vitest'
import { fillDatabase } from '../src/main/db/build'
import { openAppDatabase } from '../src/main/db/open'
import { migrate } from '../src/main/db/schema'
import { createServerApp } from '../src/main/server/app'
import { loadCanonical } from '../scripts/lib/canonical'

const tmp = mkdtempSync(join(tmpdir(), 'gutenberg-server-'))
afterAll(() => rmSync(tmp, { recursive: true, force: true }))

/** The shipped database, built from the prototype seed. */
const seedFile = join(tmp, 'seed.sqlite')
{
  const db = new DatabaseSync(seedFile)
  migrate(db)
  fillDatabase(db, loadCanonical(join(__dirname, 'fixtures', 'canonical')).data)
  db.close()
}

describe('openAppDatabase', () => {
  it('copies the shipped database on first run and keeps the operator copy afterwards', () => {
    const file = join(tmp, 'user', 'gutenberg.sqlite')
    const db = openAppDatabase({ file, seed: seedFile })
    db.prepare("UPDATE creeds SET title = 'Editado' WHERE id = 'apostles'").run()
    db.close()
    const again = openAppDatabase({ file, seed: seedFile })
    expect(again.prepare("SELECT title FROM creeds WHERE id = 'apostles'").get()).toEqual({ title: 'Editado' })
    again.close()
  })

  it('explains how to build the database when it is missing', () => {
    expect(() => openAppDatabase({ file: join(tmp, 'x', 'db.sqlite'), seed: join(tmp, 'none.sqlite') })).toThrow(/data:build/)
  })
})

describe('HTTP API — library (local only)', () => {
  const db = openAppDatabase({ file: join(tmp, 'api', 'gutenberg.sqlite'), seed: seedFile })
  const app = createServerApp(db)
  const local = { incoming: { socket: { remoteAddress: '127.0.0.1' } } }
  const lan = { incoming: { socket: { remoteAddress: '192.168.0.30' } } }
  const get = (path: string, env = local) => app.request(`/api/v1/library${path}`, {}, env)
  const put = (path: string, body: unknown) =>
    app.request(`/api/v1/library${path}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, local)

  it('refuses calls from the LAN and calls without a known origin', async () => {
    expect((await get('/collections', lan)).status).toBe(403)
    expect((await app.request('/api/v1/library/collections')).status).toBe(403)
  })

  it('lists collections with counts, Bible first', async () => {
    const res = await get('/collections')
    expect(res.status).toBe(200)
    expect(((await res.json()) as { kind: string; id: string; count: number }[]).map((c) => [c.kind, c.id, c.count])).toEqual([
      ['bible', 'ara', 1],
      ['songbook', 'hnc', 2],
      ['songbook', 'psalter', 5],
      ['creeds', 'creeds', 2],
      ['confession', 'wcf', 2],
      ['catechism', 'wsc', 3],
      ['catechism', 'wlc', 1]
    ])
  })

  it('Bible: books and a chapter, read only', async () => {
    expect(await (await get('/bible/ara/books')).json()).toEqual([{ book: 'Hb', name: 'Hebreus', testament: 'NT', chapters: 13 }])
    const verses = (await (await get('/bible/ara/Hb/12')).json()) as { number: number; text: string }[]
    expect(verses).toHaveLength(29)
    expect(verses[13]).toEqual({ number: 14, text: 'Segui a paz com todos e a santificação, sem a qual ninguém verá o Senhor,' })
    expect((await put('/bible/ara/Hb/12', {})).status).toBe(404)
  })

  it('validates parameters and bodies (400) and reports missing records (404)', async () => {
    expect((await get('/bible/ara/Hb/0')).status).toBe(400)
    expect((await get('/catechisms/wsc/abc')).status).toBe(400)
    expect((await put('/creeds/apostles', { title: '' })).status).toBe(400)
    expect((await get('/catechisms/wsc/50')).status).toBe(404)
    expect((await get('/catechisms/heidelberg')).status).toBe(404)
  })

  it('confession: chapters with expected counts; new sections are inserted in order', async () => {
    const chapters = async () => (await (await get('/confessions/wcf/chapters')).json()) as { chapter: string; sections: string[]; expected: number }[]
    expect((await chapters())[0]).toMatchObject({ chapter: '1', sections: ['1', '2'], expected: 10 })
    const body = { chapterTitle: 'Da Escritura Sagrada', text: 'Seção nova.', refs: '' }
    expect((await put('/confessions/wcf/1/5', body)).status).toBe(200)
    expect((await put('/confessions/wcf/1/3', body)).status).toBe(200)
    expect((await put('/confessions/wcf/1/1', { ...body, text: 'Editada.' })).status).toBe(200)
    expect((await chapters())[0].sections).toEqual(['1', '2', '3', '5'])
    expect(await (await get('/confessions/wcf/1/1')).json()).toMatchObject({ text: 'Editada.' })
  })

  it('catechism: index sized by the requirement; create and update questions', async () => {
    const index = (await (await get('/catechisms/wsc')).json()) as { size: number; questions: unknown[] }
    expect([index.size, index.questions.length]).toEqual([107, 3])
    expect((await put('/catechisms/wsc/4', { question: 'P?', answer: 'R.', refs: '' })).status).toBe(200)
    expect(await (await get('/catechisms/wsc/4')).json()).toEqual({ catechismId: 'wsc', number: 4, question: 'P?', answer: 'R.', refs: '' })
  })

  it('songs: songbook listing in numeric order; create gets an id, update keeps it', async () => {
    const { info, songs } = (await (await get('/songbooks/psalter')).json()) as { info: { itemLabel: string }; songs: { number: string; version: string }[] }
    expect(info.itemLabel).toBe('Salmo')
    expect(songs.map((s) => s.number + s.version)).toEqual(['1', '23', '100', '133A', '133B'])
    const draft = { id: '', songbookId: 'psalter', number: '150', version: 'A', title: 'Salmo 150A', versification: '', author: '', artist: '', copyright: '', lyrics: 'Aleluia!' }
    const created = (await (await put('/songs', draft)).json()) as { id: string }
    expect(created.id).toBe('psalter-150A')
    await put('/songs', { ...draft, id: created.id, lyrics: 'Aleluia! Louvai.' })
    expect(await (await get('/songs/psalter-150A')).json()).toMatchObject({ lyrics: 'Aleluia! Louvai.' })
    expect((await get('/songs/nope')).status).toBe(404)
  })

  it('creeds: list and save', async () => {
    expect((await put('/creeds/athanasian', { title: 'Credo de Atanásio', text: 'Todo aquele…' })).status).toBe(200)
    expect(((await (await get('/creeds')).json()) as { id: string }[]).map((c) => c.id)).toEqual(['apostles', 'nicene', 'athanasian'])
  })

  it('keeps edits in the operator database', () => {
    expect(db.prepare("SELECT text FROM confession_sections WHERE confession_id='wcf' AND chapter='1' AND section='1'").get()).toEqual({ text: 'Editada.' })
  })
})
