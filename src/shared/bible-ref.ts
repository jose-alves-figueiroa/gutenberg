/**
 * Bible references for the picker (E5) and the quick search (E6): book lookup by abbreviation or
 * name, parsing of `hb 12`, `hb 12.14`, `hb 12.14-15` (also `:`), the stable liturgy `item_ref`
 * (`Hb:12:14-15`) and the display title (`Hebreus 12.14–15`). Ported from the prototype
 * (`norm`, `booksFor`, `parseBible`).
 */
import { BOOKS } from './collections'

/** Lowercase, without accents or spaces — `1 Coríntios` → `1corintios`. */
export const normalize = (s: string): string =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, '')

/**
 * Books matching what was typed: the abbreviation typed exactly (accents included) first, then
 * abbreviations equal without accents, then abbreviation or name prefixes. So `jo` is João and `jó`
 * is Jó — the prototype resolved `jo` to Jó, which comes first in canonical order.
 */
export function booksFor(query: string): (readonly [string, string])[] {
  const q = normalize(query)
  if (!q) return []
  const typed = (query || '').toLowerCase().replace(/\s+/g, '')
  const literal = BOOKS.filter(([abbrev]) => abbrev.toLowerCase() === typed)
  const exact = BOOKS.filter(([abbrev]) => normalize(abbrev) === q && !literal.includes(BOOKS.find(([a]) => a === abbrev)!))
  const seen = new Set([...literal, ...exact].map(([a]) => a))
  const prefix = BOOKS.filter(([abbrev, name]) => !seen.has(abbrev) && (normalize(abbrev).startsWith(q) || normalize(name).startsWith(q)))
  return [...literal, ...exact, ...prefix]
}

export interface BibleRef {
  /** Book abbreviation (`Hb`). */
  book: string
  chapter: number
  /** First verse; absent for a whole chapter. */
  from?: number
  /** Last verse; equal to `from` for a single verse. */
  to?: number
}

/** `hb 12.14-15` → `{ book: 'Hb', chapter: 12, from: 14, to: 15 }`; null when it is not a full reference. */
export function parseBibleRef(raw: string): BibleRef | null {
  const m = /^(\d?\s*[a-zà-úç]+)\s*(\d+)(?:\s*[.:]\s*(\d+)(?:\s*-\s*(\d+))?)?$/i.exec((raw || '').trim())
  if (!m) return null
  const book = booksFor(m[1])[0]
  if (!book) return null
  const chapter = Number(m[2])
  if (!m[3]) return { book: book[0], chapter }
  const from = Number(m[3])
  const to = Math.max(m[4] ? Number(m[4]) : from, from)
  return { book: book[0], chapter, from, to }
}

/** Stable liturgy reference: `Hb:12`, `Hb:12:14`, `Hb:12:14-15`. */
export function bibleItemRef(r: BibleRef): string {
  if (r.from === undefined) return `${r.book}:${r.chapter}`
  return r.to !== undefined && r.to !== r.from ? `${r.book}:${r.chapter}:${r.from}-${r.to}` : `${r.book}:${r.chapter}:${r.from}`
}

export function parseBibleItemRef(itemRef: string): BibleRef | null {
  const m = /^([^:]+):(\d+)(?::(\d+)(?:-(\d+))?)?$/.exec(itemRef)
  if (!m || !BOOKS.some(([abbrev]) => abbrev === m[1])) return null
  const chapter = Number(m[2])
  if (!m[3]) return { book: m[1], chapter }
  const from = Number(m[3])
  return { book: m[1], chapter, from, to: m[4] ? Number(m[4]) : from }
}

/** `Hebreus 12`, `Hebreus 12.14`, `Hebreus 12.14–15`. */
export function bibleRefTitle(r: BibleRef): string {
  const name = BOOKS.find(([abbrev]) => abbrev === r.book)?.[1] ?? r.book
  if (r.from === undefined) return `${name} ${r.chapter}`
  return r.to !== undefined && r.to !== r.from ? `${name} ${r.chapter}.${r.from}–${r.to}` : `${name} ${r.chapter}.${r.from}`
}
