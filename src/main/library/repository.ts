/**
 * Library queries and edits over the app database (schema: src/main/db/schema.ts). Synchronous and
 * driver-agnostic (`SqlDatabase`); the HTTP routes in src/main/server expose it.
 */
import { BOOKS, DEFAULT_COLLECTIONS, GROUPS, groupOf } from '../../shared/collections'
import type {
  BibleBookSummary,
  CatechismIndex,
  CatechismQuestionRecord,
  CollectionSummary,
  ConfessionChapterSummary,
  ConfessionSectionRecord,
  CreedRecord,
  SongRecord,
  SongSummary,
  SongbookInfo,
  VerseRecord
} from '../../shared/library-schemas'
import { REQUIRED } from '../../shared/requirements'
import { DEFAULT_MAX, clampMax } from '../../shared/autobreak'
import { DEFAULT_HTTP_PORT, SETTINGS } from '../db/build'
import type { SqlDatabase } from '../db/schema'

type Row = Record<string, string | number | null>
const all = <T>(db: SqlDatabase, sql: string, ...params: (string | number)[]) => db.prepare(sql).all(...params) as T[]
const get = <T>(db: SqlDatabase, sql: string, ...params: (string | number)[]) => (db.prepare(sql).get(...params) as T | undefined) ?? null

const BOOK_NAME = new Map(BOOKS.map(([abbrev, name]) => [abbrev, name]))
const BOOK_ORDER = new Map(BOOKS.map(([abbrev], i) => [abbrev, i + 1]))
const EDITED = 'edited'

/** A document that does not exist (→ HTTP 404). */
export class NotFoundError extends Error {}

export function collections(db: SqlDatabase): CollectionSummary[] {
  const out: CollectionSummary[] = []
  for (const v of all<Row>(db, 'SELECT code, name FROM bible_versions ORDER BY code')) {
    const n = get<{ n: number }>(db, 'SELECT count(DISTINCT book) AS n FROM bible_verses WHERE version = ?', v.code as string)
    out.push({ kind: 'bible', id: String(v.code).toLowerCase(), title: `Bíblia ${v.code}`, shortTitle: String(v.code), prefix: '', count: n?.n ?? 0 })
  }
  const docs = (kind: CollectionSummary['kind'], table: string, items: string, fk: string) =>
    all<Row>(
      db,
      `SELECT d.id, d.title, d.short_title, d.prefix, (SELECT count(*) FROM ${items} i WHERE i.${fk} = d.id) AS n
       FROM ${table} d ORDER BY d.rowid`
    ).map((r) => ({ kind, id: String(r.id), title: String(r.title), shortTitle: String(r.short_title), prefix: String(r.prefix), count: Number(r.n) }))
  out.push(...docs('songbook', 'songbooks', 'songs', 'songbook_id'))
  const creeds = get<{ n: number }>(db, 'SELECT count(*) AS n FROM creeds')
  if (creeds && creeds.n > 0) out.push({ kind: 'creeds', id: 'creeds', title: 'Credos', shortTitle: 'Credo', prefix: 'credo', count: creeds.n })
  out.push(...docs('confession', 'confessions', 'confession_sections', 'confession_id'))
  out.push(...docs('catechism', 'catechisms', 'catechism_questions', 'catechism_id'))
  // Menu order: groups (Bible first), then the shipped order; other documents last in their group.
  const known = (c: CollectionSummary) => {
    const i = DEFAULT_COLLECTIONS.findIndex((d) => d.kind === c.kind && d.id === c.id)
    return i < 0 ? DEFAULT_COLLECTIONS.length : i
  }
  return out
    .map((c, i) => ({ c, i }))
    .sort((a, b) => GROUPS.indexOf(groupOf(a.c.kind)) - GROUPS.indexOf(groupOf(b.c.kind)) || known(a.c) - known(b.c) || a.i - b.i)
    .map(({ c }) => c)
}

/** `ara` / `ARA` → the stored version code. */
const versionCode = (version: string) => version.toUpperCase()

export function bibleBooks(db: SqlDatabase, version: string): BibleBookSummary[] {
  return all<{ book: string; chapters: number }>(
    db,
    'SELECT book, max(chapter) AS chapters FROM bible_verses WHERE version = ? GROUP BY book',
    versionCode(version)
  )
    .map((r) => {
      const order = BOOK_ORDER.get(r.book) ?? 99
      return { book: r.book, name: BOOK_NAME.get(r.book) ?? r.book, testament: order <= 39 ? 'OT' : 'NT', chapters: r.chapters, order } as const
    })
    .sort((a, b) => a.order - b.order)
    .map((b) => ({ book: b.book, name: b.name, testament: b.testament, chapters: b.chapters }))
}

export function bibleChapter(db: SqlDatabase, version: string, book: string, chapter: number): VerseRecord[] {
  return all<{ verse: number; text: string }>(
    db,
    'SELECT verse, text FROM bible_verses WHERE version = ? AND book = ? AND chapter = ? ORDER BY verse',
    versionCode(version),
    book,
    chapter
  ).map((r) => ({ number: r.verse, text: r.text }))
}

export function confessionChapters(db: SqlDatabase, confessionId: string): ConfessionChapterSummary[] {
  const rows = all<{ chapter: string; chapter_title: string; section: string }>(
    db,
    'SELECT chapter, chapter_title, section FROM confession_sections WHERE confession_id = ? ORDER BY position',
    confessionId
  )
  const chapters = new Map<string, ConfessionChapterSummary>()
  for (const r of rows) {
    const c = chapters.get(r.chapter) ?? { chapter: r.chapter, title: r.chapter_title, sections: [], expected: null }
    c.sections.push(r.section)
    chapters.set(r.chapter, c)
  }
  if (confessionId === REQUIRED.confession.id)
    for (const c of chapters.values()) c.expected = REQUIRED.confession.sections[Number(c.chapter) - 1] ?? null
  return [...chapters.values()]
}

export function confessionSection(db: SqlDatabase, confessionId: string, chapter: string, section: string): ConfessionSectionRecord | null {
  const r = get<Row>(
    db,
    'SELECT chapter, chapter_title, section, text, refs FROM confession_sections WHERE confession_id = ? AND chapter = ? AND section = ?',
    confessionId,
    chapter,
    section
  )
  return r
    ? { confessionId, chapter: String(r.chapter), chapterTitle: String(r.chapter_title), section: String(r.section), text: String(r.text), refs: String(r.refs) }
    : null
}

/** Updates a section, or inserts it in order (after the chapter's last section with a lower number). */
export function saveConfessionSection(db: SqlDatabase, s: ConfessionSectionRecord): void {
  const updated = db
    .prepare('UPDATE confession_sections SET text = ?, refs = ?, edited = 1 WHERE confession_id = ? AND chapter = ? AND section = ?')
    .run(s.text, s.refs, s.confessionId, s.chapter, s.section) as { changes: number }
  if (Number(updated.changes) > 0) return
  const before = get<{ position: number }>(
    db,
    `SELECT max(position) AS position FROM confession_sections
     WHERE confession_id = ? AND (CAST(chapter AS INTEGER) < ? OR (chapter = ? AND CAST(section AS INTEGER) < ?))`,
    s.confessionId,
    Number(s.chapter),
    s.chapter,
    Number(s.section)
  )
  const position = (before?.position ?? 0) + 1
  db.exec('BEGIN')
  try {
    // Two steps keep (confession_id, position) unique while shifting.
    db.prepare('UPDATE confession_sections SET position = -position - 1 WHERE confession_id = ? AND position >= ?').run(s.confessionId, position)
    db.prepare('UPDATE confession_sections SET position = -position WHERE confession_id = ? AND position < 0').run(s.confessionId)
    db.prepare(
      `INSERT INTO confession_sections (confession_id, position, chapter, chapter_title, section, section_title, text, refs, edited)
       VALUES (?, ?, ?, ?, ?, '', ?, ?, 1)`
    ).run(s.confessionId, position, s.chapter, s.chapterTitle, s.section, s.text, s.refs)
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

export function catechism(db: SqlDatabase, catechismId: string): CatechismIndex {
  const doc = get<Row>(db, 'SELECT id, title, short_title FROM catechisms WHERE id = ?', catechismId)
  if (!doc) throw new NotFoundError(`unknown catechism ${catechismId}`)
  const questions = all<{ number: number; question: string }>(
    db,
    'SELECT number, question FROM catechism_questions WHERE catechism_id = ? ORDER BY number',
    catechismId
  )
  const size = REQUIRED.catechisms[catechismId] ?? Math.max(0, ...questions.map((q) => q.number))
  return { id: catechismId, title: String(doc.title), shortTitle: String(doc.short_title), size, questions }
}

export function catechismQuestion(db: SqlDatabase, catechismId: string, number: number): CatechismQuestionRecord | null {
  const r = get<Row>(db, 'SELECT question, answer, refs FROM catechism_questions WHERE catechism_id = ? AND number = ?', catechismId, number)
  return r ? { catechismId, number, question: String(r.question), answer: String(r.answer), refs: String(r.refs) } : null
}

export function saveCatechismQuestion(db: SqlDatabase, q: CatechismQuestionRecord): void {
  db.prepare(
    `INSERT INTO catechism_questions (catechism_id, number, question, answer, refs, edited) VALUES (?, ?, ?, ?, ?, 1)
     ON CONFLICT (catechism_id, number) DO UPDATE SET question = excluded.question, answer = excluded.answer, refs = excluded.refs, edited = 1`
  ).run(q.catechismId, q.number, q.question, q.answer, q.refs)
}

export function songbook(db: SqlDatabase, songbookId: string): { info: SongbookInfo; songs: SongSummary[] } {
  const b = get<Row>(db, 'SELECT id, title, short_title, prefix, item_label FROM songbooks WHERE id = ?', songbookId)
  if (!b) throw new NotFoundError(`unknown songbook ${songbookId}`)
  const songs = all<Row>(db, 'SELECT id, number, version, title, author, lyrics FROM songs WHERE songbook_id = ?', songbookId)
    .map((r) => ({
      id: String(r.id),
      number: String(r.number),
      version: String(r.version),
      title: String(r.title),
      author: String(r.author),
      firstLine: String(r.lyrics).split('\n')[0] ?? ''
    }))
    .sort(
      (a, b) =>
        (parseFloat(a.number) || Infinity) - (parseFloat(b.number) || Infinity) ||
        a.number.localeCompare(b.number, 'pt-BR', { numeric: true }) ||
        a.version.localeCompare(b.version) ||
        a.title.localeCompare(b.title, 'pt-BR')
    )
  return {
    info: { id: String(b.id), title: String(b.title), shortTitle: String(b.short_title), prefix: String(b.prefix), itemLabel: String(b.item_label) },
    songs
  }
}

export function song(db: SqlDatabase, songId: string): SongRecord | null {
  const r = get<Row>(db, 'SELECT * FROM songs WHERE id = ?', songId)
  if (!r) return null
  return {
    id: String(r.id),
    songbookId: String(r.songbook_id),
    number: String(r.number),
    version: String(r.version),
    title: String(r.title),
    versification: String(r.versification),
    author: String(r.author),
    artist: String(r.artist),
    copyright: String(r.copyright),
    lyrics: String(r.lyrics)
  }
}

export function saveSong(db: SqlDatabase, s: SongRecord): SongRecord {
  let id = s.id
  if (!id) {
    const base = `${s.songbookId}-${s.number ? `${s.number}${s.version}` : 'novo'}`
    id = base
    for (let n = 2; get(db, 'SELECT 1 FROM songs WHERE id = ?', id); n++) id = `${base}-${n}`
  }
  db.prepare(
    `INSERT INTO songs (id, songbook_id, number, version, title, versification, author, artist, copyright, lyrics, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET number = excluded.number, version = excluded.version, title = excluded.title,
       versification = excluded.versification, author = excluded.author, artist = excluded.artist,
       copyright = excluded.copyright, lyrics = excluded.lyrics, source = excluded.source`
  ).run(id, s.songbookId, s.number, s.version, s.title, s.versification, s.author, s.artist, s.copyright, s.lyrics, EDITED)
  return { ...s, id }
}

export function creeds(db: SqlDatabase): CreedRecord[] {
  return all<CreedRecord>(db, 'SELECT id, title, text FROM creeds ORDER BY rowid')
}

export function saveCreed(db: SqlDatabase, c: CreedRecord): void {
  db.prepare(
    `INSERT INTO creeds (id, title, text, source) VALUES (?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET title = excluded.title, text = excluded.text, source = excluded.source`
  ).run(c.id, c.title, c.text, EDITED)
}

/** Settings the library UI needs (the per-screen limit for previews). */
export function settings(db: SqlDatabase): { screenCharLimit: number } {
  const row = get<{ value: string }>(db, 'SELECT value FROM settings WHERE key = ?', SETTINGS.screenCharLimit)
  return { screenCharLimit: row ? clampMax(Number(row.value)) : DEFAULT_MAX }
}

/** Writes one setting (`settings` table). */
export function saveSetting(db: SqlDatabase, key: string, value: string): void {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value').run(key, value)
}

/** Port of the LAN server (OBS and UI), or the default. */
export function httpPort(db: SqlDatabase): number {
  const row = get<{ value: string }>(db, 'SELECT value FROM settings WHERE key = ?', SETTINGS.httpPort)
  const port = Number(row?.value)
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : DEFAULT_HTTP_PORT
}

export const saveHttpPort = (db: SqlDatabase, port: number): void => saveSetting(db, SETTINGS.httpPort, String(port))
