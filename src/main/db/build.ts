/**
 * Fills a freshly migrated database from the internal data format (`npm run data:build`).
 * Content tables are replaced wholesale; services, liturgy items and user settings are kept.
 */
import { DEFAULT_MAX } from '../../shared/autobreak'
import type { CanonicalData, SourceRef } from '../../shared/data-model'
import type { SqlDatabase } from './schema'

/** HTTP port when none is saved. */
export const DEFAULT_HTTP_PORT = 8484

/** Setting keys stored in the `settings` table. */
export const SETTINGS = {
  /** Characters per screen for autobreak (60–160). */
  screenCharLimit: 'screen_char_limit',
  /** Port of the HTTP server (UI and OBS). */
  httpPort: 'http_port',
  /** Presentation state (JSON, src/shared/presentation.ts), restored after a restart. */
  presentationState: 'presentation_state',
  /** Outputs for OBS: slug, name, collections and style of each (JSON, src/shared/outputs.ts). */
  outputs: 'outputs'
} as const

const src = (s: SourceRef) => (s.id ? `${s.name}:${s.id}` : s.name)

export interface BuildCounts {
  verses: number
  songs: number
  confessionSections: number
  catechismQuestions: number
  creeds: number
}

export function fillDatabase(db: SqlDatabase, data: CanonicalData): BuildCounts {
  const counts: BuildCounts = { verses: 0, songs: 0, confessionSections: 0, catechismQuestions: 0, creeds: 0 }
  db.exec('BEGIN')
  try {
    db.exec(`
      DELETE FROM bible_verses; DELETE FROM bible_versions;
      DELETE FROM songs; DELETE FROM songbooks;
      DELETE FROM confession_sections; DELETE FROM confessions;
      DELETE FROM catechism_questions; DELETE FROM catechisms;
      DELETE FROM creeds;
    `)

    const version = db.prepare('INSERT INTO bible_versions (code, name, copyright, source) VALUES (?, ?, ?, ?)')
    const verse = db.prepare('INSERT INTO bible_verses (version, book, chapter, verse, text) VALUES (?, ?, ?, ?, ?)')
    for (const { meta, books } of data.bibles) {
      version.run(meta.code, meta.name, meta.copyright ?? '', src(meta.source))
      for (const book of books)
        book.chapters.forEach((verses, c) =>
          verses.forEach((text, v) => {
            verse.run(meta.code, book.book, c + 1, v + 1, text)
            counts.verses++
          })
        )
    }

    const songbook = db.prepare('INSERT INTO songbooks (id, title, short_title, prefix, item_label, source) VALUES (?, ?, ?, ?, ?, ?)')
    const song = db.prepare(
      `INSERT INTO songs (id, songbook_id, number, version, title, versification, author, artist, copyright, lyrics, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    for (const { songbook: b, songs } of data.songbooks) {
      songbook.run(b.id, b.title, b.shortTitle, b.prefix, b.itemLabel, src(b.source))
      for (const s of songs) {
        const lyrics = s.stanzas.map((st) => st.join('\n')).join('\n\n')
        song.run(s.id, b.id, s.number, s.version, s.title, s.versification, s.credits.author, s.credits.artist, s.credits.copyright, lyrics, src(s.source))
        counts.songs++
      }
    }

    const confession = db.prepare('INSERT INTO confessions (id, title, short_title, prefix, source) VALUES (?, ?, ?, ?, ?)')
    const section = db.prepare(
      `INSERT INTO confession_sections (confession_id, position, chapter, chapter_title, section, section_title, text, refs)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    for (const c of data.confessions) {
      confession.run(c.id, c.title, c.shortTitle, c.prefix, src(c.source))
      let position = 0
      for (const ch of c.chapters)
        for (const s of ch.sections) {
          section.run(c.id, ++position, ch.id, ch.title, s.id, s.title ?? '', s.text, s.refs ?? '')
          counts.confessionSections++
        }
    }

    const catechism = db.prepare('INSERT INTO catechisms (id, title, short_title, prefix, source) VALUES (?, ?, ?, ?, ?)')
    const question = db.prepare('INSERT INTO catechism_questions (catechism_id, number, question, answer, refs) VALUES (?, ?, ?, ?, ?)')
    for (const c of data.catechisms) {
      catechism.run(c.id, c.title, c.shortTitle, c.prefix, src(c.source))
      for (const q of c.questions) {
        question.run(c.id, q.number, q.question, q.answer, q.refs ?? '')
        counts.catechismQuestions++
      }
    }

    if (data.creeds) {
      const creed = db.prepare('INSERT INTO creeds (id, title, text, source) VALUES (?, ?, ?, ?)')
      for (const c of data.creeds.creeds) {
        creed.run(c.id, c.title, c.text, src(data.creeds.source))
        counts.creeds++
      }
    }

    db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run(SETTINGS.screenCharLimit, String(DEFAULT_MAX))
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
  return counts
}
