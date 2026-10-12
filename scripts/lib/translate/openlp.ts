/**
 * OpenLP Bible database → internal format. OpenLP schema: `book(id, book_reference_id,
 * testament_reference_id, name)`, `verse(book_id, chapter, verse, text)`, `metadata(key, value)`.
 * `book_reference_id` 1–66 follows the Protestant canon, matching `BOOKS`.
 */
import type { SqlDatabase } from '../../../src/main/db/schema'
import { toProse } from '../../../src/shared/clean'
import { BOOKS } from '../../../src/shared/collections'
import type { BibleBook, BibleVersionMeta } from '../../../src/shared/data-model'

export interface OpenLpTranslation {
  meta: BibleVersionMeta
  books: BibleBook[]
  /** Non-fatal notes (e.g. a book name that differs from `BOOKS`). */
  notes: string[]
}

export function translateOpenLpBible(db: SqlDatabase, code: string, sourceId: string): OpenLpTranslation {
  const notes: string[] = []
  const metadata = new Map(
    (db.prepare('SELECT key, value FROM metadata').all() as { key: string; value: string }[]).map((r) => [r.key, r.value])
  )
  const copyright = metadata.get('copyright') ?? ''
  const meta: BibleVersionMeta = {
    format: 1,
    code,
    name: copyright.replace(/\s*-\s*\d{4}\s*$/, '') || code,
    ...(copyright ? { copyright } : {}),
    source: { name: 'openlp', id: sourceId }
  }

  const rows = db
    .prepare('SELECT book_id, chapter, verse, text FROM verse ORDER BY book_id, chapter, verse')
    .all() as { book_id: number; chapter: number; verse: number; text: string }[]
  const byBook = Map.groupBy(rows, (r) => r.book_id)

  const books: BibleBook[] = []
  for (const b of db.prepare('SELECT id, book_reference_id, name FROM book ORDER BY book_reference_id').all() as {
    id: number
    book_reference_id: number
    name: string
  }[]) {
    const ref = BOOKS[b.book_reference_id - 1]
    if (!ref) throw new Error(`book ${b.name}: book_reference_id ${b.book_reference_id} is outside 1–66`)
    const [abbrev, expectedName] = ref
    if (b.name !== expectedName) notes.push(`book ${b.book_reference_id}: source name "${b.name}" ≠ "${expectedName}"`)

    const chapters: string[][] = []
    for (const v of byBook.get(b.id) ?? []) {
      const verses = (chapters[v.chapter - 1] ??= [])
      if (v.verse !== verses.length + 1) throw new Error(`${abbrev} ${v.chapter}.${v.verse}: verse numbering is not contiguous`)
      verses.push(toProse(v.text))
    }
    // Array.prototype.some skips holes, so check every index of the (possibly sparse) array.
    for (let c = 0; c < chapters.length; c++) if (!chapters[c]) throw new Error(`${abbrev}: missing chapters`)
    books.push({
      format: 1,
      book: abbrev,
      name: b.name,
      order: b.book_reference_id,
      testament: b.book_reference_id <= 39 ? 'OT' : 'NT',
      chapters
    })
  }
  return { meta, books, notes }
}
