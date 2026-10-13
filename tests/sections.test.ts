import { describe, expect, it } from 'vitest'
import { HEBREW_LETTERS, SUGGESTED_SECTIONS, bibleUnits, fitSections, sectionOfSlide, sectionUnits } from '../src/shared/sections'
import { slidesOf, type LibraryEntry } from '../src/shared/slides'

/** `n` verses of one screen each. */
const ones = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => ({ number: from + i, weight: 1 }))
const titles = (s: { title: string }[]) => s.map((x) => x.title)

/** Every weight unit is in exactly one section, in order. */
function expectCover(sections: { start: number; end: number }[], total: number) {
  expect(sections[0].start).toBe(0)
  sections.slice(1).forEach((s, i) => expect(s.start).toBe(sections[i].end))
  expect(sections[sections.length - 1].end).toBe(total)
}

describe('sections fitted to the screen (E11)', () => {
  const ps119 = bibleUnits('Sl', 119, ones(1, 176))

  it('Psalm 119: one letter per section (1–8, 9–16…), whatever fits', () => {
    for (const c of [5, 8, 20, 24, 60]) {
      const s = fitSections(ps119, c)
      expect(titles(s)).toEqual(HEBREW_LETTERS)
      expect(s[1]).toMatchObject({ title: 'Bete', detail: '9–16', from: 9, to: 16, start: 8, end: 16 })
      expectCover(s, 176)
    }
  })

  it('a passage keeps only the parts it covers, cut to it', () => {
    const s = fitSections(bibleUnits('Sl', 119, ones(12, 40)), 8)
    expect(s.map((x) => `${x.title} ${x.detail}`)).toEqual(['Bete 12–16', 'Guímel 17–24', 'Dálete 25–32', 'He 33–40'])
  })

  it('Lamentations 3: multiples of 3 verses', () => {
    const s = fitSections(bibleUnits('Lm', 3, ones(1, 66)), 10)
    expect(s[0]).toMatchObject({ title: 'Álefe–Guímel', detail: '1–9' })
    for (const x of s) expect((x.to! - x.from! + 1) % 3).toBe(0)
    // A part bigger than the screen stays whole.
    expect(titles(fitSections(bibleUnits('Lm', 3, ones(1, 66)), 2)).slice(0, 2)).toEqual(['Álefe', 'Bete'])
  })

  it('other chapters: as many whole verses as fit', () => {
    const verses = Array.from({ length: 67 }, (_, i) => ({ number: i + 1, weight: (i + 1) % 2 ? 1 : 2 }))
    const s = fitSections(bibleUnits('Gn', 24, verses), 12)
    expect(s[0]).toMatchObject({ title: '1–8', from: 1, to: 8, detail: '' })
    for (const x of s) expect(x.end - x.start).toBeLessThanOrEqual(12)
    expectCover(s, verses.reduce((n, v) => n + v.weight, 0))
  })

  it('everything fits: one section, no title', () => {
    expect(fitSections(bibleUnits('Hb', 12, ones(1, 10)), 12)).toEqual([{ title: '', detail: '', start: 0, end: 10, from: 1, to: 10 }])
  })

  it('songs: stanzas joined while they fit', () => {
    const stanza = (n: number) => Array.from({ length: 8 }, (_, i) => `estrofe ${n}, verso ${i + 1}`)
    const entry: LibraryEntry = {
      kind: 'song',
      songbook: { itemLabel: '' },
      item: { format: 1, id: 'x', songbook: 'hnc', number: '1', version: '', title: 'Hino', versification: '', credits: { author: '', artist: '', copyright: '' }, stanzas: [1, 2, 3, 4, 5].map(stanza), source: { name: 'test' } }
    }
    const units = sectionUnits(entry)
    expect(units.reduce((n, u) => n + (u.kind === 'part' ? 0 : u.weight), 0)).toBe(slidesOf(entry).length)
    expect(titles(fitSections(units, 4))).toEqual(['Estrofe 1', 'Estrofe 2', 'Estrofe 3', 'Estrofe 4', 'Estrofe 5'])
    expect(titles(fitSections(units, 9))).toEqual(['Estrofes 1–2', 'Estrofes 3–4', 'Estrofe 5'])
  })

  it('Bible units weigh their screens', () => {
    const long = 'Um versículo comprido que passa do limite de caracteres de uma tela e por isso é quebrado em mais de uma parte.'
    const entry: LibraryEntry = { kind: 'bible', item: { book: 'Sl', chapter: 119, verses: [{ number: 1, text: long }, { number: 2, text: 'curto' }] } }
    const [part] = sectionUnits(entry)
    expect(part).toMatchObject({ kind: 'part', label: 'Álefe' })
    expect(part.kind === 'part' && part.verses.reduce((n, v) => n + v.weight, 0)).toBe(slidesOf(entry).length)
  })

  it('finds the section of a screen', () => {
    const s = fitSections(ps119, 8)
    expect([0, 8, 175].map((i) => sectionOfSlide(s, i))).toEqual([0, 1, 21])
    expect(sectionOfSlide([], 3)).toBe(0)
  })

  it('suggestions are contiguous parts from verse 1', () => {
    for (const d of SUGGESTED_SECTIONS) d.parts.forEach((p, i) => expect(p.from).toBe(i === 0 ? 1 : d.parts[i - 1].to + 1))
  })
})
