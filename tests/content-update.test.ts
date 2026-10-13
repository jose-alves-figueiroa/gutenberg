import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'
import { fillDatabase } from '../src/main/db/build'
import { mergeSections } from '../src/main/db/content'
import { openAppDatabase } from '../src/main/db/open'
import { migrate } from '../src/main/db/schema'
import * as repo from '../src/main/library/repository'
import { addItem, createService } from '../src/main/liturgy/repository'
import { loadCanonical } from '../scripts/lib/canonical'

const SEED = loadCanonical(join(__dirname, 'fixtures', 'canonical')).data
const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

/** Builds a shipped database (like `data:build`) from the seed, optionally changed. */
function ship(dir: string, name: string, change?: (data: typeof SEED) => void) {
  const data = structuredClone(SEED)
  change?.(data)
  const file = join(dir, name)
  const db = new DatabaseSync(file)
  migrate(db)
  fillDatabase(db, data)
  db.close()
  return file
}

function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'gutenberg-content-'))
  dirs.push(dir)
  const v1 = ship(dir, 'v1.sqlite')
  const user = join(dir, 'user.sqlite')
  return { dir, v1, user }
}

const section = (id: string, chapter: string, sec: string, edited = 0) => ({
  confession_id: id,
  position: 0,
  chapter,
  chapter_title: '',
  section: sec,
  section_title: '',
  text: `${chapter}.${sec}${edited ? ' (mine)' : ''}`,
  refs: '',
  edited
})

describe('content updates keep the operator’s edits (US8.3)', () => {
  it('first run copies the shipped database; the same version changes nothing', () => {
    const { v1, user } = setup()
    const db = openAppDatabase({ file: user, seed: v1 })
    expect(db.prepare("SELECT value FROM settings WHERE key = 'content_version'").get()).toMatchObject({ value: expect.stringMatching(/^[0-9a-f]{16}$/) })
    db.close()
  })

  it('a new version refreshes the library but keeps edits, new records, services and settings', () => {
    const { dir, v1, user } = setup()
    let db = openAppDatabase({ file: user, seed: v1 })
    const creed = repo.creeds(db).find((c) => c.id === 'nicene')!
    repo.saveCreed(db, { ...creed, text: 'Creio (editado)' })
    repo.saveCatechismQuestion(db, { catechismId: 'wsc', number: 1, question: 'Pergunta editada?', answer: 'Resposta.', refs: '' })
    repo.saveConfessionSection(db, { confessionId: 'wcf', chapter: '1', section: '9', chapterTitle: 'Da Escritura Sagrada', text: 'Seção nova do operador', refs: '' })
    const created = repo.saveSong(db, { id: '', songbookId: 'hnc', number: '900', version: '', title: 'Hino do operador', versification: '', author: '', artist: '', copyright: '', lyrics: 'a' })
    repo.saveSong(db, { ...repo.song(db, 'hnc-h1')!, title: 'Castelo forte (editado)' })
    const s = createService(db, 'Domingo')
    addItem(db, s.id, { collection: 'creeds', itemRef: 'nicene', moment: 'Credo' })
    repo.saveHttpPort(db, 9090)
    db.close()

    const v2 = ship(dir, 'v2.sqlite', (data) => {
      data.creeds!.creeds.find((c) => c.id === 'apostles')!.text = 'Creio em Deus Pai (revisado)'
      data.creeds!.creeds.find((c) => c.id === 'nicene')!.text = 'Niceno revisado'
      data.catechisms.find((c) => c.id === 'wsc')!.questions[1].answer = 'Resposta revisada'
      data.confessions[0].chapters[0].sections[1].text = 'Seção 1.2 revisada'
    })
    db = openAppDatabase({ file: user, seed: v2 })
    const creeds = Object.fromEntries(repo.creeds(db).map((c) => [c.id, c.text]))
    expect(creeds.apostles).toBe('Creio em Deus Pai (revisado)')
    expect(creeds.nicene).toBe('Creio (editado)')
    expect(repo.catechismQuestion(db, 'wsc', 1)?.question).toBe('Pergunta editada?')
    expect(repo.catechismQuestion(db, 'wsc', 2)?.answer).toBe('Resposta revisada')
    expect(repo.confessionSection(db, 'wcf', '1', '2')?.text).toBe('Seção 1.2 revisada')
    expect(repo.confessionSection(db, 'wcf', '1', '9')?.text).toBe('Seção nova do operador')
    expect(repo.song(db, created.id)?.title).toBe('Hino do operador')
    expect(repo.song(db, 'hnc-h1')?.title).toBe('Castelo forte (editado)')
    expect(repo.song(db, 'hnc-h2')).not.toBeNull()
    expect(db.prepare('SELECT count(*) AS n FROM liturgy_items').get()).toEqual({ n: 1 })
    expect(repo.httpPort(db)).toBe(9090)
    db.close()

    // Opening again with the same shipped database changes nothing.
    db = openAppDatabase({ file: user, seed: v2 })
    expect(repo.creeds(db).find((c) => c.id === 'nicene')?.text).toBe('Creio (editado)')
    db.close()
  })

  it('places the operator’s new sections in reading order', () => {
    const shipped = [section('wcf', '1', '1'), section('wcf', '1', '2'), section('wcf', '2', '1')]
    const mine = [section('wcf', '1', '3', 1), section('wcf', '1', '1', 1)]
    expect(mergeSections(shipped, mine).map((r) => r.text)).toEqual(['1.1 (mine)', '1.2', '1.3 (mine)', '2.1'])
  })
})
