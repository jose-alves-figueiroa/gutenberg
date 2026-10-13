/**
 * Content updates (PLAN.md → US8.3). The operator's database is a copy of the one shipped with the
 * app, made on first run. When a newer app ships different content (`content_version`), the
 * library is refreshed from it while keeping what the operator changed:
 * - songs and creeds saved in the app (`source = 'edited'`), confession sections and catechism
 *   questions marked `edited` — including records the operator created;
 * - services, liturgy items and settings are never touched.
 * The Bible is read only, so it is replaced as a whole.
 */
import { SETTINGS } from './build'
import type { SqlDatabase } from './schema'

const EDITED = 'edited'

interface SectionRow {
  confession_id: string
  position: number
  chapter: string
  chapter_title: string
  section: string
  section_title: string
  text: string
  refs: string
  edited: number
}

const version = (db: SqlDatabase, schema: 'main' | 'seed') =>
  (db.prepare(`SELECT value FROM ${schema}.settings WHERE key = ?`).get(SETTINGS.contentVersion) as { value: string } | undefined)?.value ?? null

/** Sorts after: the same rule the editor uses to place a new section (numeric chapter, then section). */
const before = (a: SectionRow, b: SectionRow) =>
  Number(a.chapter) < Number(b.chapter) || (a.chapter === b.chapter && Number(a.section) < Number(b.section))

/** Shipped sections in order, with the operator's version in place and the operator's new ones placed in order. */
export function mergeSections(shipped: SectionRow[], edited: SectionRow[]): SectionRow[] {
  const key = (r: SectionRow) => `${r.chapter}.${r.section}`
  const mine = new Map(edited.map((r) => [key(r), r]))
  const merged = shipped.map((r) => mine.get(key(r)) ?? r)
  const used = new Set(shipped.map(key))
  for (const r of edited.filter((x) => !used.has(key(x)))) {
    let at = 0
    merged.forEach((m, i) => {
      if (before(m, r)) at = i + 1
    })
    merged.splice(at, 0, r)
  }
  return merged
}

/** Refreshes the library from the shipped database when its content differs. Returns whether it ran. */
export function updateContent(db: SqlDatabase, seedFile: string): boolean {
  db.prepare('ATTACH DATABASE ? AS seed').run(seedFile)
  try {
    const shipped = version(db, 'seed')
    if (!shipped || shipped === version(db, 'main')) return false
    db.exec('BEGIN')
    try {
      db.exec(`
        DELETE FROM bible_verses; DELETE FROM bible_versions;
        INSERT INTO bible_versions (code, name, copyright, source) SELECT code, name, copyright, source FROM seed.bible_versions;
        INSERT INTO bible_verses (version, book, chapter, verse, text) SELECT version, book, chapter, verse, text FROM seed.bible_verses;

        INSERT INTO songbooks (id, title, short_title, prefix, item_label, source)
          SELECT id, title, short_title, prefix, item_label, source FROM seed.songbooks WHERE true
          ON CONFLICT (id) DO UPDATE SET title = excluded.title, short_title = excluded.short_title, prefix = excluded.prefix,
            item_label = excluded.item_label, source = excluded.source;
        DELETE FROM songs WHERE source <> '${EDITED}';
        INSERT OR IGNORE INTO songs (id, songbook_id, number, version, title, versification, author, artist, copyright, lyrics, source)
          SELECT id, songbook_id, number, version, title, versification, author, artist, copyright, lyrics, source FROM seed.songs;

        DELETE FROM creeds WHERE source <> '${EDITED}';
        INSERT OR IGNORE INTO creeds (id, title, text, source) SELECT id, title, text, source FROM seed.creeds;

        INSERT INTO confessions (id, title, short_title, prefix, source)
          SELECT id, title, short_title, prefix, source FROM seed.confessions WHERE true
          ON CONFLICT (id) DO UPDATE SET title = excluded.title, short_title = excluded.short_title, prefix = excluded.prefix, source = excluded.source;

        INSERT INTO catechisms (id, title, short_title, prefix, source)
          SELECT id, title, short_title, prefix, source FROM seed.catechisms WHERE true
          ON CONFLICT (id) DO UPDATE SET title = excluded.title, short_title = excluded.short_title, prefix = excluded.prefix, source = excluded.source;
        DELETE FROM catechism_questions WHERE edited = 0;
        INSERT OR IGNORE INTO catechism_questions (catechism_id, number, question, answer, refs)
          SELECT catechism_id, number, question, answer, refs FROM seed.catechism_questions;
      `)

      const sections = (schema: string, where: string, id: string) =>
        db.prepare(`SELECT * FROM ${schema}.confession_sections WHERE confession_id = ? ${where} ORDER BY position`).all(id) as unknown as SectionRow[]
      const ids = db.prepare('SELECT id FROM confessions').all() as { id: string }[]
      const insert = db.prepare(
        `INSERT INTO confession_sections (confession_id, position, chapter, chapter_title, section, section_title, text, refs, edited)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      for (const { id } of ids) {
        const merged = mergeSections(sections('seed', '', id), sections('main', 'AND edited = 1', id))
        db.prepare('DELETE FROM confession_sections WHERE confession_id = ?').run(id)
        merged.forEach((r, i) => insert.run(id, i + 1, r.chapter, r.chapter_title, r.section, r.section_title, r.text, r.refs, r.edited ?? 0))
      }

      db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value').run(
        SETTINGS.contentVersion,
        shipped
      )
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
    return true
  } finally {
    db.exec('DETACH DATABASE seed')
  }
}
