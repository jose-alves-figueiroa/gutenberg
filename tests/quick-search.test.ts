import { describe, expect, it } from 'vitest'
import { DEFAULT_COLLECTIONS } from '@shared/collections'
import { parseQuickSearch } from '@shared/quick-search'

const cols = DEFAULT_COLLECTIONS
const q = (raw: string, book: string | null = null) => parseQuickSearch(raw, cols, book)

describe('quick search', () => {
  it('a full Bible reference is presented directly', () => {
    expect(q('hb 12.14')).toMatchObject({ type: 'bible', title: 'Hebreus 12.14', itemRef: 'Hb:12:14' })
    expect(q('1co 13.4-7')).toMatchObject({ type: 'bible', title: '1 Coríntios 13.4–7', itemRef: '1Co:13:4-7' })
    expect(q('sl 23')).toMatchObject({ type: 'bible', itemRef: 'Sl:23' })
  })

  it('a partial book name lists books (at most 10)', () => {
    const r = q('1')
    expect(r.type).toBe('books')
    if (r.type === 'books') {
      expect(r.books.length).toBeLessThanOrEqual(10)
      expect(r.books[0][0]).toBe('1Sm')
    }
    expect(q('hebr')).toEqual({ type: 'books', books: [['Hb', 'Hebreus']] })
  })

  it('with a chosen book, expects chapter.verse', () => {
    expect(q('', 'Hb')).toEqual({ type: 'chapter', book: 'Hb' })
    expect(q('12.', 'Hb')).toEqual({ type: 'chapter', book: 'Hb' })
    expect(q('12.14-15', 'Hb')).toMatchObject({ type: 'bible', itemRef: 'Hb:12:14-15' })
    expect(q('3', 'Jó')).toMatchObject({ type: 'bible', title: 'Jó 3' })
  })

  it.each([
    ['bc 1', 'catechism:wsc', '1'],
    ['cm 1', 'catechism:wlc', '1'],
    ['cfw 1.1', 'confession:wcf', '1.1'],
    ['sg 133', 'songbook:psalter', '133'],
    ['hnc', 'songbook:hnc', ''],
    ['HNC castelo', 'songbook:hnc', 'castelo'],
    ['credo', 'creeds', ''],
    ['credo nic', 'creeds', 'nic']
  ])('prefix %s → %s', (raw, collection, query) => {
    expect(q(raw)).toMatchObject({ type: 'collection', collection, query })
  })

  it('a prefix must not be followed by a letter', () => {
    expect(q('bcx').type).not.toBe('collection')
    expect(q('cmx').type).not.toBe('collection')
  })

  it('prefixes come from the data: a new collection brings its own', () => {
    const extra = [...cols, { kind: 'songbook' as const, id: 'harpa', title: 'Harpa Cristã', shortTitle: 'Harpa', prefix: 'hc' }]
    expect(parseQuickSearch('hc 15', extra)).toMatchObject({ type: 'collection', collection: 'songbook:harpa', title: 'Harpa Cristã', query: '15' })
  })

  it('nothing typed, or nothing found', () => {
    expect(q('   ').type).toBe('none')
    expect(q('zzz').type).toBe('none')
  })
})
