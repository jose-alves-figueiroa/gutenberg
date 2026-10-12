import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterAll, describe, expect, it } from 'vitest'
import { fillDatabase, SETTINGS } from '../src/main/db/build'
import { migrate, MIGRATIONS } from '../src/main/db/schema'
import { BOOKS } from '@shared/collections'
import { BOOK_CHAPTERS, checkCompleteness, REQUIRED, WCF_SECTIONS } from '@shared/requirements'
import { validateCatechism, validateConfession, validateCreeds, validateSong } from '@shared/validate'
import { isLocked, loadCanonical } from '../scripts/lib/canonical'
import { loadPrototype } from '../scripts/prototype.mjs'

const SEED = join(__dirname, 'fixtures', 'canonical')
const proto = loadPrototype()
const tmp = mkdtempSync(join(tmpdir(), 'gutenberg-test-'))
afterAll(() => rmSync(tmp, { recursive: true, force: true }))

describe('requirements', () => {
  it('chapter counts match the prototype for all 66 books', () => {
    expect(BOOK_CHAPTERS).toEqual(proto.CH)
    expect(Object.keys(BOOK_CHAPTERS)).toEqual(BOOKS.map(([abbrev]) => abbrev))
  })

  it('WCF section counts match the prototype except chapter 31 (American revision), catechism sizes match', () => {
    const expected = [...proto.CFW_S]
    expected[31] = 4 // 1647 text has 5 sections; the American revision adopted by the IPB has 4
    expect([0, ...WCF_SECTIONS]).toEqual(expected)
    expect(WCF_SECTIONS).toHaveLength(33)
    expect(REQUIRED.catechisms).toEqual({ wsc: proto.CAT_N.breve, wlc: proto.CAT_N.maior })
  })
})

describe('validators', () => {
  const song = {
    format: 1, id: 'psalter-133B', songbook: 'psalter', number: '133', version: 'B', title: 'Salmo 133B', versification: '',
    credits: { author: '', artist: '', copyright: '' }, stanzas: [['a', 'b']], source: { name: 'test' }
  }

  it('accept a valid song and reject HTML, empty stanzas and missing credits', () => {
    expect(validateSong(song)).toEqual([])
    expect(validateSong({ ...song, stanzas: [['a&nbsp;b']] }).join()).toMatch(/HTML/)
    expect(validateSong({ ...song, stanzas: [[]] }).join()).toMatch(/non-empty lines/)
    expect(validateSong({ ...song, credits: {} }).join()).toMatch(/credits/)
    expect(validateSong({ ...song, format: 2 }).join()).toMatch(/format/)
  })

  it('confession: label ids, duplicates and single line breaks', () => {
    const doc = (sections: unknown[]) => ({
      format: 1, id: 'dort', title: 'Cânones de Dort', shortTitle: 'Dort', prefix: 'dort',
      chapters: [{ id: '3/4', title: 'III/IV', sections }], source: { name: 'test' }
    })
    expect(validateConfession(doc([{ id: '1', text: 'a' }, { id: 'R1', text: 'b' }]))).toEqual([])
    expect(validateConfession(doc([{ id: '1', text: 'a' }, { id: '1', text: 'b' }])).join()).toMatch(/duplicate/)
    expect(validateConfession(doc([{ id: '1', text: 'linha\nquebrada' }])).join()).toMatch(/single line break/)
  })

  it('catechism: numbering must be 1..n in order', () => {
    const cat = (numbers: number[]) => ({
      format: 1, id: 'wsc', title: 'Breve', shortTitle: 'Breve', prefix: 'bc', source: { name: 'test' },
      questions: numbers.map((number) => ({ number, question: 'P?', answer: 'R.' }))
    })
    expect(validateCatechism(cat([1, 2, 3]))).toEqual([])
    expect(validateCatechism(cat([1, 3])).join()).toMatch(/question 2 is numbered 3/)
  })

  it('creeds: only the three known ids, no duplicates', () => {
    const creeds = (ids: string[]) => ({ format: 1, source: { name: 'test' }, creeds: ids.map((id) => ({ id, title: id, text: 'Creio.' })) })
    expect(validateCreeds(creeds(['apostles', 'nicene', 'athanasian']))).toEqual([])
    expect(validateCreeds(creeds(['apostles', 'apostles'])).join()).toMatch(/duplicate/)
    expect(validateCreeds(creeds(['heidelberg'])).join()).toMatch(/unknown creed/)
  })
})

describe('canonical seed (prototype library)', () => {
  const { data, problems } = loadCanonical(SEED)

  it('loads without structural problems', () => {
    expect(problems).toEqual([])
    expect(data.bibles[0].books[0].book).toBe('Hb')
    expect(data.songbooks.map((s) => s.songbook.id)).toEqual(['hnc', 'psalter'])
  })

  it('keeps Hb 12.15 and Salmo 133B identical to the prototype', () => {
    expect(data.bibles[0].books[0].chapters[11][14]).toBe((proto.LIB0.biblia[0] as { verses: { t: string }[] }).verses[1].t)
    const s133b = data.songbooks.find((s) => s.songbook.id === 'psalter')!.songs.find((s) => s.version === 'B' && s.number === '133')!
    expect(s133b.stanzas[0]).toEqual(['Oh! Como é bom e agradável,', 'bem suave, sim,'])
  })

  it('is reported as incomplete against the requirement', () => {
    const gaps = checkCompleteness(data)
    expect(gaps.filter((g) => g.area === 'bible')).toHaveLength(65)
    expect(gaps).toContainEqual({ area: 'songs', problem: `7 of ${REQUIRED.songCount} songs` })
    expect(gaps).toContainEqual({ area: 'catechisms', problem: 'wsc: 3 of 107 questions' })
    expect(gaps).toContainEqual({ area: 'creeds', problem: 'missing creed athanasian' })
  })
})

describe('git-crypt detection', () => {
  it('flags a folder whose probe file is still encrypted', () => {
    const dir = join(tmp, 'locked')
    mkdirSync(dir)
    writeFileSync(join(dir, '.gitcrypt-check.json'), Buffer.concat([Buffer.from('\0GITCRYPT\0'), Buffer.from([1, 2, 3])]))
    expect(isLocked(dir)).toBe(true)
    expect(() => loadCanonical(dir)).toThrow(/data:unlock/)
    expect(isLocked(SEED)).toBe(false)
  })
})

describe('database build', () => {
  const db = new DatabaseSync(join(tmp, 'app.sqlite'))
  db.exec('PRAGMA foreign_keys = ON')

  it('migrates to the latest version, idempotently', () => {
    expect(migrate(db)).toBe(MIGRATIONS.length)
    expect(migrate(db)).toBe(MIGRATIONS.length)
    expect(db.prepare('PRAGMA user_version').get()).toEqual({ user_version: MIGRATIONS.length })
  })

  it('fills every content table from the seed', () => {
    const counts = fillDatabase(db, loadCanonical(SEED).data)
    expect(counts).toEqual({ verses: 41, songs: 7, confessionSections: 2, catechismQuestions: 4, creeds: 2 })
    expect(db.prepare("SELECT text FROM bible_verses WHERE version='ARA' AND book='Hb' AND chapter=12 AND verse=14").get()).toEqual({
      text: 'Segui a paz com todos e a santificação, sem a qual ninguém verá o Senhor,'
    })
    expect(db.prepare("SELECT songbook_id, number, version, lyrics FROM songs WHERE id='psalter-133B'").get()).toMatchObject({
      songbook_id: 'psalter', number: '133', version: 'B', lyrics: expect.stringMatching(/^Oh! Como é bom e agradável,\nbem suave, sim,\n\n/)
    })
    expect(db.prepare("SELECT chapter, section, chapter_title FROM confession_sections WHERE confession_id='wcf' AND position=1").get()).toEqual({
      chapter: '1', section: '1', chapter_title: 'Da Escritura Sagrada'
    })
    expect(db.prepare("SELECT short_title FROM catechisms WHERE id='wsc'").get()).toEqual({ short_title: 'Breve Catecismo' })
  })

  it('stores the default per-screen limit and keeps user settings on rebuild', () => {
    expect(db.prepare('SELECT value FROM settings WHERE key = ?').get(SETTINGS.screenCharLimit)).toEqual({ value: '96' })
    db.prepare('UPDATE settings SET value = ? WHERE key = ?').run('120', SETTINGS.screenCharLimit)
    db.prepare("INSERT INTO services (name) VALUES ('Domingo')").run()
    fillDatabase(db, loadCanonical(SEED).data)
    expect(db.prepare('SELECT value FROM settings WHERE key = ?').get(SETTINGS.screenCharLimit)).toEqual({ value: '120' })
    expect(db.prepare('SELECT count(*) AS n FROM services').get()).toEqual({ n: 1 })
    expect(db.prepare('SELECT count(*) AS n FROM songs').get()).toEqual({ n: 7 })
  })
})
