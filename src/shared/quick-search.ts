/**
 * Quick search in the nav bar (README → "Busca rápida"; prototype `suggestions`): what the operator
 * typed becomes a full Bible reference, a list of books (pick one, then type `capítulo.versículo`)
 * or a search inside the collection named by its prefix (`bc 1`, `sg 133`, `cfw 1.1`, `credo`…).
 * Prefixes come from the collections' data, so a new document brings its own.
 */
import { bibleItemRef, bibleRefTitle, booksFor, parseBibleRef, type BibleRef } from './bible-ref'

export interface PrefixedCollection {
  kind: string
  id: string
  title: string
  prefix: string
}

export type QuickQuery =
  | { type: 'none' }
  | { type: 'bible'; ref: BibleRef; title: string; itemRef: string }
  | { type: 'books'; books: (readonly [string, string])[] }
  /** A book was chosen but the chapter is still missing or incomplete. */
  | { type: 'chapter'; book: string }
  | { type: 'collection'; collection: string; title: string; query: string }

const MAX_BOOKS = 10
const CHAPTER_VERSE = /^(\d+)(?:\s*[.:]\s*(\d+)(?:\s*-\s*(\d+))?)?$/

/** Collection reference used by the API (`catechism:wsc`, `creeds`). */
export const collectionRef = (c: Pick<PrefixedCollection, 'kind' | 'id'>): string => (c.kind === 'creeds' ? 'creeds' : `${c.kind}:${c.id}`)

const bible = (ref: BibleRef): QuickQuery => ({ type: 'bible', ref, title: bibleRefTitle(ref), itemRef: bibleItemRef(ref) })

/**
 * Interprets the search field. `book` is the book already chosen (shown as a tag in the field);
 * then only `capítulo.versículo` is expected.
 */
export function parseQuickSearch(raw: string, collections: readonly PrefixedCollection[], book: string | null = null): QuickQuery {
  const q = raw.trim()
  if (book) {
    const m = CHAPTER_VERSE.exec(q)
    if (!m) return { type: 'chapter', book }
    const chapter = Number(m[1])
    if (!m[2]) return bible({ book, chapter })
    const from = Number(m[2])
    return bible({ book, chapter, from, to: Math.max(m[3] ? Number(m[3]) : from, from) })
  }
  if (!q) return { type: 'none' }
  // A collection prefix wins over a book abbreviation (`hc` for a hymnal, not Habacuque).
  // Longest prefix first, so `cfw` is not taken for a shorter one.
  const prefixed = collections.filter((c) => c.prefix).sort((a, b) => b.prefix.length - a.prefix.length)
  for (const c of prefixed) {
    const m = new RegExp(`^${c.prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z])\\s*(.*)$`, 'i').exec(q)
    if (m) return { type: 'collection', collection: collectionRef(c), title: c.title, query: m[1].trim() }
  }
  const ref = parseBibleRef(q)
  if (ref) return bible(ref)
  const books = booksFor(q).slice(0, MAX_BOOKS)
  return books.length ? { type: 'books', books } : { type: 'none' }
}
