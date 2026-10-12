import { describe, expect, it } from 'vitest'
import { bibleItemRef, bibleRefTitle, booksFor, normalize, parseBibleItemRef, parseBibleRef } from '@shared/bible-ref'
import { loadPrototype } from '../scripts/prototype.mjs'

const proto = loadPrototype()
const abbrevs = (q: string) => booksFor(q).map(([a]) => a)

describe('booksFor (README → Busca rápida)', () => {
  it('"1" lists the numbered books; "1c" lists 1Cr and 1Co', () => {
    expect(abbrevs('1')).toEqual(['1Sm', '1Rs', '1Cr', '1Co', '1Ts', '1Tm', '1Pe', '1Jo'])
    expect(abbrevs('1c')).toEqual(['1Cr', '1Co'])
  })

  it('matches abbreviation or name, without accents or case; exact abbreviation first', () => {
    expect(abbrevs('HEB')).toEqual(['Hb'])
    expect(abbrevs('exo')).toEqual(['Êx'])
    expect(abbrevs('jo').slice(0, 2)).toEqual(['Jo', 'Jó'])
    expect(abbrevs('jó')[0]).toBe('Jó')
    expect(abbrevs('')).toEqual([])
    expect(normalize('1 Coríntios')).toBe('1corintios')
  })

  it('matches the prototype for every prefix of every book, except the Jo/Jó fix', () => {
    const queries = new Set<string>()
    for (const [a, n] of proto.BOOKS) for (const s of [a, n]) for (let i = 1; i <= s.length; i++) queries.add(s.slice(0, i))
    const differ = [...queries].filter((q) => JSON.stringify(abbrevs(q)) !== JSON.stringify(proto.booksFor(q).map(([a]) => a)))
    // The prototype resolves "jo"/"Jo" to Jó (first in canonical order); we prefer the abbreviation typed exactly.
    expect(differ.sort()).toEqual(['Jo'])
    expect(proto.booksFor('Jo')[0][0]).toBe('Jó')
  })
})

describe('parseBibleRef', () => {
  it('accepts chapter, verse and range, with "." or ":"', () => {
    expect(parseBibleRef('hb 12')).toEqual({ book: 'Hb', chapter: 12 })
    expect(parseBibleRef('hb 12.14')).toEqual({ book: 'Hb', chapter: 12, from: 14, to: 14 })
    expect(parseBibleRef('hb 12.14-15')).toEqual({ book: 'Hb', chapter: 12, from: 14, to: 15 })
    expect(parseBibleRef('1co 13:4-7')).toEqual({ book: '1Co', chapter: 13, from: 4, to: 7 })
    expect(parseBibleRef('Hebreus 12.15-14')).toEqual({ book: 'Hb', chapter: 12, from: 15, to: 15 })
  })

  it('rejects incomplete or unknown references', () => {
    expect(parseBibleRef('hb')).toBeNull()
    expect(parseBibleRef('xyz 3')).toBeNull()
    expect(parseBibleRef('')).toBeNull()
  })

  it('agrees with the prototype parser', () => {
    expect(parseBibleRef('jo 3:16')?.book).toBe('Jo')
    for (const q of ['hb 12.14-15', 'hb 12', '1co 13.4', 'sl 23', 'jó 3', 'gn 1.1-3', 'ap 22.20-21']) {
      const p = proto.parseBible(q)!
      const r = parseBibleRef(q)!
      expect([r.book, r.chapter, r.from ?? 0], q).toEqual([p.ab, p.ch, p.v1])
    }
  })
})

describe('item_ref and title', () => {
  it('round-trips the stable reference', () => {
    for (const ref of ['Hb:12', 'Hb:12:14', 'Hb:12:14-15', '1Co:13:4-7']) expect(bibleItemRef(parseBibleItemRef(ref)!)).toBe(ref)
    expect(parseBibleItemRef('Xx:1')).toBeNull()
    expect(parseBibleItemRef('Hb')).toBeNull()
  })

  it('formats titles like the prototype (en dash for ranges)', () => {
    expect(bibleRefTitle({ book: 'Hb', chapter: 12, from: 14, to: 15 })).toBe('Hebreus 12.14–15')
    expect(bibleRefTitle({ book: 'Hb', chapter: 12, from: 15, to: 15 })).toBe('Hebreus 12.15')
    expect(bibleRefTitle({ book: 'Hb', chapter: 12 })).toBe('Hebreus 12')
  })
})
