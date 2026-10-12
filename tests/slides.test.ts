import { describe, expect, it } from 'vitest'
import { autobreak } from '@shared/autobreak'
import { BOOKS, bookName, DEFAULT_COLLECTIONS, GROUPS, groupLabel, groupOf } from '@shared/collections'
import type { Catechism, CatechismQuestion, Confession, ConfessionSection, Creed, Song, Songbook } from '@shared/data-model'
import { slidesOf, type BiblePassage } from '@shared/slides'
import { loadPrototype } from '../scripts/prototype.mjs'

// The prototype is the behavioral oracle; its sample library uses Portuguese keys,
// so it is adapted here to Gutenberg's English data model.
interface ProtoLib {
  biblia: { ab: string; ch: string; verses: { n: string; t: string }[] }[]
  breve: { q: string; pergunta: string; resposta: string }[]
  maior: { q: string; pergunta: string; resposta: string }[]
  cfw: { cap: string; sec: string; text: string }[]
  credos: { id: string; title: string; text: string }[]
  salmos: { id: string; num: string; ver: string; meta: string; text: string }[]
  hnc: { id: string; num: string; title: string; meta: string; text: string }[]
}

const proto = loadPrototype()
const lib = proto.LIB0 as unknown as ProtoLib
const PROTO_GROUP: Record<string, string> = { Bíblia: 'bible', 'Hinário e salmos': 'songs', Doutrina: 'doctrine' }

const stanzas = (text: string) =>
  text.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean).map((s) => s.split('\n'))

const hb: BiblePassage = {
  book: lib.biblia[0].ab,
  chapter: Number(lib.biblia[0].ch),
  verses: lib.biblia[0].verses.map((v) => ({ number: Number(v.n), text: v.t }))
}
const question = (q: ProtoLib['breve'][number]): CatechismQuestion => ({
  number: Number(q.q),
  question: q.pergunta,
  answer: q.resposta
})
const wsc: Pick<Catechism, 'shortTitle'> = { shortTitle: 'Breve Catecismo' }
const wlc: Pick<Catechism, 'shortTitle'> = { shortTitle: 'Catecismo Maior' }
const wcf: Pick<Confession, 'shortTitle'> = { shortTitle: 'CFW' }
const wcf11: ConfessionSection = { id: lib.cfw[0].sec, text: lib.cfw[0].text }
const creed = (c: { title: string; text: string }, id: Creed['id'] = 'apostles'): Creed => ({ id, title: c.title, text: c.text })
const apostles = creed(lib.credos.find((c) => c.id === 'ca')!)

const psalter: Pick<Songbook, 'itemLabel'> = { itemLabel: 'Salmo' }
const hnc: Pick<Songbook, 'itemLabel'> = { itemLabel: '' }
const song = (songbook: string, s: { id: string; num: string; meta: string; text: string }, extra: Partial<Song> = {}): Song => ({
  format: 1,
  id: s.id,
  songbook,
  number: s.num,
  version: '',
  title: '',
  versification: '',
  credits: { author: '', artist: s.meta, copyright: '' },
  stanzas: stanzas(s.text),
  source: { name: 'prototype', id: s.id },
  ...extra
})
const s133b = lib.salmos.find((s) => s.id === 's133b')!
const psalm133B = song('psalter', s133b, { version: s133b.ver })
const castleHymn = song('hnc', lib.hnc.find((h) => h.id === 'h1')!, { title: 'Castelo forte' })

describe('collections', () => {
  it('match the prototype books and menu (title, short title, prefix, group)', () => {
    expect(BOOKS).toEqual(proto.BOOKS)
    expect(BOOKS).toHaveLength(66)
    expect(DEFAULT_COLLECTIONS.map((c) => [c.title, c.shortTitle, c.prefix || undefined, groupOf(c.kind)])).toEqual(
      proto.COLS.map((c) => [c.label, c.short, c.key, PROTO_GROUP[c.g]])
    )
  })

  it('have unique ids', () => {
    const ids = DEFAULT_COLLECTIONS.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keep the Bible first in every menu', () => {
    expect(GROUPS[0]).toBe('bible')
    expect(DEFAULT_COLLECTIONS[0].kind).toBe('bible')
    expect(GROUPS.map(groupLabel)).toEqual(['Bíblia', 'Hinário e salmos', 'Doutrina'])
  })

  it('resolve book names from abbreviations', () => {
    expect(bookName('Hb')).toBe('Hebreus')
    expect(bookName('1Co')).toBe('1 Coríntios')
    expect(() => bookName('Xx')).toThrow(/Unknown/)
  })
})

describe('slidesOf — headers per collection', () => {
  it('Bible: "Hebreus 12.14" when the verse fits one screen', () => {
    expect(slidesOf({ kind: 'bible', item: hb }, 96)[0].header).toBe('Hebreus 12.14')
  })

  it('Bible: Hb 12.15 gets (i/n) when it spans several screens', () => {
    const slides = slidesOf({ kind: 'bible', item: hb }, 96).filter((s) => s.header.startsWith('Hebreus 12.15'))
    const n = autobreak(hb.verses[1].text, 96).length
    expect(n).toBeGreaterThan(1)
    expect(slides.map((s) => s.header)).toEqual(Array.from({ length: n }, (_, i) => `Hebreus 12.15 (${i + 1}/${n})`))
  })

  it('Confession: "CFW 1.1" from the confession short title', () => {
    const slides = slidesOf({ kind: 'confession', confession: wcf, chapter: lib.cfw[0].cap, item: wcf11 }, 96)
    expect(slides.length).toBe(autobreak(wcf11.text, 96).length)
    expect(new Set(slides.map((s) => s.header))).toEqual(new Set(['CFW 1.1']))
  })

  it('Confession: any document and label works (Canons of Dort, head 3/4)', () => {
    const slides = slidesOf({ kind: 'confession', confession: { shortTitle: 'Dort' }, chapter: '3/4', item: { id: 'R1', text: 'Texto.' } })
    expect(slides[0].header).toBe('Dort 3/4.R1')
  })

  it('Catechism: "· pergunta" on the question, plain "P. n" on the answer', () => {
    expect(slidesOf({ kind: 'catechism', catechism: wsc, item: question(lib.breve[0]) }, 96)).toEqual([
      { header: 'Breve Catecismo · P. 1 · pergunta', lines: ['Qual é o fim principal do homem?'] },
      { header: 'Breve Catecismo · P. 1', lines: ['O fim principal do homem é glorificar a Deus,', 'e gozá-lo para sempre.'] }
    ])
    expect(slidesOf({ kind: 'catechism', catechism: wlc, item: question(lib.maior[0]) }, 96)[0].header).toBe(
      'Catecismo Maior · P. 1 · pergunta'
    )
  })

  it('Creed: the creed title', () => {
    const slides = slidesOf({ kind: 'creed', item: apostles }, 96)
    expect(slides.length).toBeGreaterThan(1)
    expect(new Set(slides.map((s) => s.header))).toEqual(new Set(['Credo Apostólico']))
  })

  it('Psalter: "Salmo 133B", one stanza per screen, no autobreak', () => {
    const slides = slidesOf({ kind: 'song', songbook: psalter, item: psalm133B }, 60)
    expect(slides).toHaveLength(4)
    expect(slides[0]).toEqual({ header: 'Salmo 133B', lines: ['Oh! Como é bom e agradável,', 'bem suave, sim,'] })
  })

  it('Psalter: versions are kept apart (133B × 133C) and a lone psalm has no suffix', () => {
    expect(slidesOf({ kind: 'song', songbook: psalter, item: { ...psalm133B, version: 'C' } })[0].header).toBe('Salmo 133C')
    expect(slidesOf({ kind: 'song', songbook: psalter, item: { ...psalm133B, number: '23', version: '' } })[0].header).toBe('Salmo 23')
  })

  it('Hymnal: title, with the number when present', () => {
    expect(slidesOf({ kind: 'song', songbook: hnc, item: castleHymn }).map((s) => s.header)).toEqual(['Castelo forte', 'Castelo forte'])
    expect(slidesOf({ kind: 'song', songbook: hnc, item: { ...castleHymn, number: '155' } })[0].header).toBe('155 · Castelo forte')
  })

  it('the limit changes the screen count (except songs)', () => {
    expect(slidesOf({ kind: 'creed', item: apostles }, 160).length).toBeLessThan(slidesOf({ kind: 'creed', item: apostles }, 60).length)
    expect(slidesOf({ kind: 'song', songbook: psalter, item: psalm133B }, 60)).toEqual(
      slidesOf({ kind: 'song', songbook: psalter, item: psalm133B }, 160)
    )
  })

  it('running-text screens have at most 2 lines and no HTML', () => {
    const all = [
      ...slidesOf({ kind: 'bible', item: hb }),
      ...slidesOf({ kind: 'confession', confession: wcf, chapter: '1', item: wcf11 }),
      ...lib.breve.flatMap((q) => slidesOf({ kind: 'catechism', catechism: wsc, item: question(q) })),
      ...lib.credos.flatMap((c) => slidesOf({ kind: 'creed', item: creed(c) }))
    ]
    for (const s of all) {
      expect(s.lines.length).toBeGreaterThanOrEqual(1)
      expect(s.lines.length).toBeLessThanOrEqual(2)
      expect(s.lines.join(' ')).not.toMatch(/<[a-z/]|&nbsp;/i)
    }
  })
})
