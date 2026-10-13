/**
 * Sections of a long item (PLAN.md → E11): screens are shown one section at a time, with a strip
 * to jump between them. Two steps:
 * 1. `sectionUnits` cuts the item at suggested points only — the parts in `SUGGESTED_SECTIONS`
 *    (data: Ps 119 in blocks of 8 verses named after the Hebrew letters, Lam 3 in blocks of 3),
 *    else every verse; songs at every stanza. Each unit weighs its number of screens.
 * 2. `fitSections` joins consecutive units while they fit the screen (`capacity`, measured by the
 *    UI): Ps 119 gets sections of 8, 16 or 24 verses depending on the window. A unit bigger than
 *    the screen is split by verse, keeping its name. When everything fits, one section.
 */
import { t } from './i18n'
import { slidesOf, SONG_LINES_PER_SCREEN, type LibraryEntry } from './slides'

/** A suggested part of a chapter, by verse numbers. */
export interface SuggestedPart {
  label: string
  from: number
  to: number
}

export interface SuggestedSections {
  /** Book abbreviation (`Sl`). */
  book: string
  chapter: number
  parts: SuggestedPart[]
}

/** The Hebrew alphabet as Portuguese Bibles write it. */
export const HEBREW_LETTERS = [
  'Álefe', 'Bete', 'Guímel', 'Dálete', 'He', 'Vau', 'Zain', 'Hete', 'Tete', 'Iode', 'Cafe',
  'Lâmede', 'Mem', 'Num', 'Sâmeque', 'Aim', 'Pê', 'Tsadi', 'Cofe', 'Resh', 'Chin', 'Tau'
]

/** Parts of `size` verses named after the Hebrew letters. */
export const lettered = (size: number): SuggestedPart[] =>
  HEBREW_LETTERS.map((label, i) => ({ label, from: i * size + 1, to: (i + 1) * size }))

/** Where long chapters should be cut. Adding a chapter is data: book, chapter and named parts. */
export const SUGGESTED_SECTIONS: SuggestedSections[] = [
  { book: 'Sl', chapter: 119, parts: lettered(8) },
  { book: 'Lm', chapter: 3, parts: lettered(3) }
]

/** A piece of an item that is never cut, except by verse when it alone is bigger than the screen. */
export type SectionUnit =
  | { kind: 'part'; label: string; verses: { number: number; weight: number }[] }
  | { kind: 'verse'; number: number; weight: number }
  | { kind: 'stanza'; number: number; weight: number }

export interface Section {
  /** `Álefe`, `Álefe–Bete`, `Álefe 1–4`, `1–9`, `Estrofe 2`, `Estrofes 1–3`. */
  title: string
  /** Verses of a named section (`1–16`); empty otherwise. */
  detail: string
  /** First unit of weight (screen or row) and one past the last. */
  start: number
  end: number
  /** Bible: first and last verse. */
  from?: number
  to?: number
}

const range = (a: number, b: number) => (a === b ? String(a) : `${a}–${b}`)
const weight = (u: SectionUnit) => (u.kind === 'part' ? u.verses.reduce((n, v) => n + v.weight, 0) : u.weight)

/** Units of Bible verses, cut at the suggested parts of the chapter (if any). */
export function bibleUnits(book: string, chapter: number, verses: { number: number; weight: number }[]): SectionUnit[] {
  const suggested = SUGGESTED_SECTIONS.find((s) => s.book === book && s.chapter === chapter)
  const units: SectionUnit[] = []
  for (const v of verses) {
    const part = suggested?.parts.find((p) => v.number >= p.from && v.number <= p.to)
    const last = units[units.length - 1]
    if (part && last?.kind === 'part' && last.label === part.label) last.verses.push(v)
    else if (part) units.push({ kind: 'part', label: part.label, verses: [v] })
    else units.push({ kind: 'verse', ...v })
  }
  return units
}

/** Units of an item, weighed in screens (`slidesOf(entry, max)`). */
export function sectionUnits(entry: LibraryEntry, max?: number): SectionUnit[] {
  if (entry.kind === 'song')
    return entry.item.stanzas.map((stanza, i) => ({ kind: 'stanza', number: i + 1, weight: Math.ceil(stanza.length / SONG_LINES_PER_SCREEN) }))
  if (entry.kind === 'bible') {
    const { book, chapter, verses } = entry.item
    const screens = (v: (typeof verses)[number]) => slidesOf({ kind: 'bible', item: { book, chapter, verses: [v] } }, max).length
    return bibleUnits(book, chapter, verses.map((v) => ({ number: v.number, weight: screens(v) })))
  }
  return [{ kind: 'stanza', number: 1, weight: slidesOf(entry, max).length }]
}

function title(group: SectionUnit[], whole: boolean): Pick<Section, 'title' | 'detail' | 'from' | 'to'> {
  const first = group[0]
  const last = group[group.length - 1]
  if (first.kind === 'part' && last.kind === 'part') {
    const from = first.verses[0].number
    const to = last.verses[last.verses.length - 1].number
    const name = group.length === 1 ? first.label : `${first.label}–${last.label}`
    return whole ? { title: name, detail: range(from, to), from, to } : { title: `${name} ${range(from, to)}`, detail: '', from, to }
  }
  if (first.kind === 'stanza' && last.kind === 'stanza')
    return { title: group.length === 1 ? t('section.stanza', { n: first.number }) : t('section.stanzas', { range: range(first.number, last.number) }), detail: '' }
  const from = first.kind === 'part' ? first.verses[0].number : first.number
  const to = last.kind === 'part' ? last.verses[last.verses.length - 1].number : last.number
  return { title: range(from, to), detail: '', from, to }
}

/** Joins consecutive units while they fit `capacity`; one section when everything fits. */
export function fitSections(units: readonly SectionUnit[], capacity: number): Section[] {
  const total = units.reduce((n, u) => n + weight(u), 0)
  if (total <= capacity || units.length === 0) {
    const all = units.length ? title([...units], true) : { title: '', detail: '' }
    return [{ ...all, title: '', detail: '', start: 0, end: total, ...(all.from !== undefined ? { from: all.from, to: all.to } : {}) }]
  }
  // A unit bigger than the screen is split by verse (a named part keeps its name).
  const pieces: { units: SectionUnit[]; split: boolean }[] = []
  for (const u of units) {
    if (u.kind !== 'part' || weight(u) <= capacity) {
      pieces.push({ units: [u], split: false })
      continue
    }
    let chunk: typeof u.verses = []
    let size = 0
    for (const v of u.verses) {
      if (chunk.length && size + v.weight > capacity) {
        pieces.push({ units: [{ ...u, verses: chunk }], split: true })
        chunk = []
        size = 0
      }
      chunk.push(v)
      size += v.weight
    }
    pieces.push({ units: [{ ...u, verses: chunk }], split: true })
  }
  const groups: { units: SectionUnit[]; split: boolean; size: number }[] = []
  for (const p of pieces) {
    const w = weight(p.units[0])
    const last = groups[groups.length - 1]
    // Units of different kinds (named part / plain verse) and split parts are never joined.
    if (last && !last.split && !p.split && last.units[0].kind === p.units[0].kind && last.size + w <= capacity) {
      last.units.push(p.units[0])
      last.size += w
    } else groups.push({ units: [...p.units], split: p.split, size: w })
  }
  let start = 0
  return groups.map((g) => {
    const section = { ...title(g.units, !g.split), start, end: start + g.size }
    start += g.size
    return section
  })
}

/** Index of the section holding unit of weight `i` (a screen), 0 when none. */
export function sectionOfSlide(sections: readonly Pick<Section, 'start' | 'end'>[], i: number): number {
  const at = sections.findIndex((s) => i >= s.start && i < s.end)
  return at < 0 ? 0 : at
}
